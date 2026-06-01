import { Router, Request, Response } from 'express';
import { Deal } from '../models/Deal';
import { Product } from '../models/Product';
import { cache } from '../services/cache';

const router = Router();

type FeedItem = Record<string, unknown> & { posted_at: Date; clicks: number };

// Public listings only show items with a valid product image — items missing image_url look broken on the card.
const HAS_IMAGE = { image_url: { $exists: true, $nin: [null, ''] } } as const;

// Listing TTL — short enough that staleness is invisible (poller refreshes every 10 min),
// long enough to absorb homepage traffic.
const LIST_TTL = 60;

function tag(items: FeedItem[], type: 'deal' | 'product') {
  return items.map((i) => ({ ...i, item_type: type }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Generic shopping words → catalog category. Product titles rarely contain words like
// "mobile" or "ac", so these terms are mapped to the category they belong to and matched
// against `category` instead of `product_title`. Brand/model words fall through to title search.
const CATEGORY_SYNONYMS: Record<string, string> = {
  mobile: 'Electronics', mobiles: 'Electronics', phone: 'Electronics', phones: 'Electronics',
  smartphone: 'Electronics', smartphones: 'Electronics', laptop: 'Electronics', laptops: 'Electronics',
  tablet: 'Electronics', tv: 'Electronics', television: 'Electronics', headphone: 'Electronics',
  headphones: 'Electronics', earphone: 'Electronics', earphones: 'Electronics', earbuds: 'Electronics',
  ac: 'Electronics', fridge: 'Electronics', refrigerator: 'Electronics', camera: 'Electronics',
  speaker: 'Electronics', speakers: 'Electronics', smartwatch: 'Electronics', charger: 'Electronics',
  shoes: 'Fashion', shoe: 'Fashion', sneaker: 'Fashion', sneakers: 'Fashion', footwear: 'Fashion',
  jeans: 'Fashion', jean: 'Fashion', denim: 'Fashion', shirt: 'Fashion', shirts: 'Fashion',
  tshirt: 'Fashion', tshirts: 'Fashion', clothes: 'Fashion', clothing: 'Fashion', dress: 'Fashion',
  dresses: 'Fashion', kurta: 'Fashion', saree: 'Fashion', jacket: 'Fashion', sandals: 'Fashion',
  watch: 'Fashion', bag: 'Fashion', handbag: 'Fashion', wallet: 'Fashion',
  makeup: 'Beauty', lipstick: 'Beauty', perfume: 'Beauty', skincare: 'Beauty', cream: 'Beauty',
  shampoo: 'Beauty', book: 'Books', books: 'Books', novel: 'Books',
  grocery: 'Grocery', snacks: 'Grocery', coffee: 'Grocery', tea: 'Grocery', chocolate: 'Grocery',
  cookware: 'Kitchen', mixer: 'Kitchen', cooker: 'Kitchen', kettle: 'Kitchen', kitchen: 'Kitchen',
  cricket: 'Sports', football: 'Sports', fitness: 'Sports', gym: 'Sports', yoga: 'Sports', dumbbell: 'Sports',
  furniture: 'Home', sofa: 'Home', bedsheet: 'Home', curtain: 'Home', mattress: 'Home',
};

const VALID_CATEGORIES = new Set(['Electronics', 'Kitchen', 'Fashion', 'Beauty', 'Books', 'Grocery', 'Sports', 'Home']);

// For generic terms, the category match casts a wide net; these keywords let us rank the items
// that actually look like what was asked for (a phone for "mobile", a split AC for "ac") above
// the rest of the category.
const SYNONYM_KEYWORDS: Record<string, string[]> = {
  mobile: ['smartphone', '5g', 'phone', 'redmi', 'galaxy', 'realme', 'oppo', 'vivo', 'iphone', 'poco', 'motorola', 'infinix', 'narzo'],
  mobiles: ['smartphone', '5g', 'phone', 'redmi', 'galaxy', 'realme', 'iphone'],
  phone: ['smartphone', '5g', 'phone', 'redmi', 'galaxy', 'realme', 'oppo', 'vivo', 'iphone', 'poco'],
  smartphone: ['smartphone', '5g', 'phone', 'redmi', 'galaxy', 'iphone'],
  ac: ['air conditioner', 'inverter', 'split ac', 'window ac', ' ton', 'air cond'],
  laptop: ['laptop', 'notebook', 'intel', 'ryzen', 'core i', 'thinkpad', 'ideapad', 'omnibook'],
  tv: ['tv', 'television', 'led', 'smart tv'],
  headphones: ['headphone', 'earphone', 'earbuds', 'wireless', 'tws', 'neckband'],
  earbuds: ['earbuds', 'tws', 'airdopes', 'wireless'],
  shoes: ['shoe', 'sneaker', 'running', 'loafer', 'footwear'],
  shoe: ['shoe', 'sneaker', 'running', 'loafer'],
  jeans: ['jeans', 'denim', 'jean'],
  clothes: ['shirt', 'tshirt', 't-shirt', 'kurta', 'dress', 'top', 'jacket', 'trouser'],
  clothing: ['shirt', 'tshirt', 'kurta', 'dress', 'top', 'jacket'],
  watch: ['watch', 'smartwatch'],
};

/**
 * Catalog search across Deals + Products. Splits the query into tokens: generic words map to a
 * category (matched on `category`), the rest match the title (AND, substring, case-insensitive).
 * Results from both paths are merged, deduped by affiliate_url, and ranked title-matches first.
 * Returns a capped, ranked list; callers paginate or take the top N.
 */
async function searchFeed(qRaw: string): Promise<FeedItem[]> {
  const q = qRaw.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const categories = new Set<string>();
  const titleTokens: string[] = [];
  const boostKeywords: string[] = [];
  for (const t of tokens) {
    const cat = CATEGORY_SYNONYMS[t] ?? (VALID_CATEGORIES.has(t[0].toUpperCase() + t.slice(1)) ? t[0].toUpperCase() + t.slice(1) : null);
    if (cat) {
      categories.add(cat);
      if (SYNONYM_KEYWORDS[t]) boostKeywords.push(...SYNONYM_KEYWORDS[t]);
    } else {
      titleTokens.push(t);
    }
  }

  const conditions: Record<string, unknown>[] = [];
  if (titleTokens.length > 0) {
    conditions.push({ $and: titleTokens.map((t) => ({ product_title: new RegExp(escapeRegex(t), 'i') })) });
  }
  if (categories.size > 0) conditions.push({ category: { $in: [...categories] } });
  // Pure stopword/short query — fall back to a raw substring match on the whole string.
  if (conditions.length === 0) conditions.push({ product_title: new RegExp(escapeRegex(q), 'i') });

  const base = { is_active: true, ...HAS_IMAGE };
  const filter = conditions.length > 1 ? { ...base, $or: conditions } : { ...base, ...conditions[0] };

  const [deals, products] = await Promise.all([
    Deal.find(filter).limit(80).lean() as Promise<FeedItem[]>,
    Product.find(filter).limit(80).lean() as Promise<FeedItem[]>,
  ]);

  const merged = [...tag(deals, 'deal'), ...tag(products, 'product')] as Record<string, unknown>[];
  const byUrl = new Map<string, Record<string, unknown>>();
  for (const it of merged) {
    const url = String(it.affiliate_url);
    if (!byUrl.has(url)) byUrl.set(url, it);
  }

  // Relevance tier: 2 = title matches the typed terms, 1 = looks like the asked-for category
  // (boost keyword), 0 = category-only. Higher tiers rank first, ties broken by popularity.
  const tier = (it: Record<string, unknown>) => {
    const title = String(it.product_title ?? '').toLowerCase();
    if (titleTokens.length > 0 && titleTokens.every((t) => title.includes(t))) return 2;
    if (boostKeywords.length > 0 && boostKeywords.some((k) => title.includes(k))) return 1;
    return 0;
  };

  const items = [...byUrl.values()].sort((a, b) => {
    const diff = tier(b) - tier(a);
    if (diff !== 0) return diff;
    return (Number(b.clicks) || 0) - (Number(a.clicks) || 0);
  });

  return items.slice(0, 100) as FeedItem[];
}

// GET /v1/feed — merged paginated feed
router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

  const payload = await cache.withCache(`feed:list:p=${page}:l=${limit}`, LIST_TTL, async () => {
    const fetch = page * limit;
    const base = { is_active: true, ...HAS_IMAGE };
    const [deals, products, dealCount, productCount] = await Promise.all([
      Deal.find(base).sort({ posted_at: -1 }).limit(fetch).lean() as Promise<FeedItem[]>,
      Product.find(base).sort({ posted_at: -1 }).limit(fetch).lean() as Promise<FeedItem[]>,
      Deal.countDocuments(base),
      Product.countDocuments(base),
    ]);

    const merged = [...tag(deals, 'deal'), ...tag(products, 'product')]
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());

    const skip = (page - 1) * limit;
    const data = merged.slice(skip, skip + limit);
    const total = dealCount + productCount;

    return { data, page, limit, total, hasMore: skip + data.length < total };
  });

  res.json(payload);
});

// GET /v1/feed/trending
router.get('/trending', async (_req: Request, res: Response) => {
  const payload = await cache.withCache('feed:trending', LIST_TTL, async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filter = { is_active: true, posted_at: { $gte: since }, ...HAS_IMAGE };

    const [deals, products] = await Promise.all([
      Deal.find(filter).sort({ clicks: -1 }).limit(20).lean() as Promise<FeedItem[]>,
      Product.find(filter).sort({ clicks: -1 }).limit(20).lean() as Promise<FeedItem[]>,
    ]);

    const data = [...tag(deals, 'deal'), ...tag(products, 'product')]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);

    return { data };
  });

  res.json(payload);
});

// GET /v1/feed/price-drops — products whose live price recently fell.
// Only Products carry price-drop data (the refresh cron rescrapes their live price);
// Deals are never refreshed, so they have no drops to show.
router.get('/price-drops', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

  const payload = await cache.withCache(`feed:price-drops:p=${page}:l=${limit}`, LIST_TTL, async () => {
    const skip = (page - 1) * limit;
    // Window of "recent" drops — keeps the feed fresh and bounded.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [result] = await Product.aggregate([
      {
        $match: {
          is_active: true,
          ...HAS_IMAGE,
          price_dropped_at: { $gte: since },
          previous_price: { $gt: 0 },
          // Still below the pre-drop price (a later increase removes it from the feed).
          $expr: { $lt: ['$price', '$previous_price'] },
        },
      },
      { $sort: { price_dropped_at: -1 } },
      // Dedup by affiliate_url — same product across channels.
      { $group: { _id: '$affiliate_url', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { price_dropped_at: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      },
    ]);

    const data = tag(result?.data ?? [], 'product');
    const total = result?.count?.[0]?.total ?? 0;
    return { data, page, limit, total, hasMore: skip + data.length < total };
  });

  res.json(payload);
});

// Marketplace boilerplate that pollutes scraped titles ("Buy X Online at Best Price ... | Flipkart.com").
// Stripped before search so $text matches the real product, not high-frequency filler words.
const COMPARE_STOPWORDS = new Set([
  'buy', 'online', 'best', 'price', 'shop', 'for', 'the', 'with', 'and', 'in', 'at', 'of', 'on',
  'india', 'com', 'flipkart', 'amazon', 'myntra', 'store', 'shopping',
]);

// Build a comparison search string from a noisy product title. The leading tokens (usually the
// brand / product line) are quoted as a $text phrase — MongoDB then *requires* that phrase, which
// keeps matches on-brand instead of OR-matching stray words like "soft" or "red". Remaining tokens
// are added as optional terms to rank closer variants higher.
function compareQuery(title: string): string {
  // Drop everything after common marketplace separators ("- Buy ...", "| Flipkart.com", "Online at Best Price").
  const head = title.split(/ - buy | \| |online at best price/i)[0] || title;
  const words = head
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !COMPARE_STOPWORDS.has(w));
  if (words.length === 0) return '';
  const phrase = words.slice(0, 2).join(' ');
  const rest = words.slice(2, 6).join(' ');
  return `"${phrase}" ${rest}`.trim();
}

// GET /v1/feed/compare?q=<title>&category=<cat> — find other listings of the same product to compare prices.
// Text-searches both collections and across stores, dedups by affiliate_url, sorts by price,
// flags the cheapest, and carries price-drop fields so the UI can show drops inline.
router.get('/compare', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q) return res.json({ offers: [] });

  const category = (req.query.category as string)?.trim();
  const keywords = compareQuery(q) || q;

  const filter: Record<string, unknown> = { is_active: true, $text: { $search: keywords }, ...HAS_IMAGE };
  // Keep comparisons apples-to-apples — same category (skip the catch-all 'General').
  if (category && category !== 'General') filter.category = category;
  const proj = { score: { $meta: 'textScore' } };

  const [deals, products] = await Promise.all([
    Deal.find(filter, proj).sort({ score: { $meta: 'textScore' } }).limit(20).lean() as Promise<FeedItem[]>,
    Product.find(filter, proj).sort({ score: { $meta: 'textScore' } }).limit(20).lean() as Promise<FeedItem[]>,
  ]);

  // Merge, keep the most relevant listing per affiliate_url (same product/store collapses to one).
  const merged = [...tag(deals, 'deal'), ...tag(products, 'product')] as Record<string, unknown>[];
  merged.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  const byUrl = new Map<string, Record<string, unknown>>();
  for (const it of merged) {
    const url = String(it.affiliate_url);
    if (!byUrl.has(url)) byUrl.set(url, it);
  }

  const offers = Array.from(byUrl.values())
    .sort((a, b) => Number(a.price) - Number(b.price))
    .slice(0, 8);

  // Sorted ascending, so the first offer is the cheapest — flag just that one.
  if (offers.length > 0) offers[0].is_lowest = true;

  res.json({ offers });
});

// GET /v1/feed/suggest?q=  — autocomplete suggestions
router.get('/suggest', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) return res.json({ suggestions: [] });

  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const filter = { is_active: true, product_title: regex };

  const [deals, products] = await Promise.all([
    Deal.find(filter).select('product_title').limit(6).lean(),
    Product.find(filter).select('product_title').limit(6).lean(),
  ]);

  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const item of [...deals, ...products]) {
    const t = (item as { product_title?: string }).product_title;
    if (t && !seen.has(t) && suggestions.length < 8) {
      seen.add(t);
      suggestions.push(t);
    }
  }

  res.json({ suggestions });
});

// GET /v1/feed/search?q= — category-aware, multi-word search across Deals + Products.
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

  if (!q) return res.json({ data: [], page, limit, total: 0, hasMore: false });

  const all = await searchFeed(q);
  const skip = (page - 1) * limit;
  const data = all.slice(skip, skip + limit);

  res.json({ data, page, limit, total: all.length, hasMore: skip + data.length < all.length });
});

// GET /v1/feed/live?q= — real-time search results (full items) for the navbar dropdown.
router.get('/live', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) return res.json({ items: [] });

  const all = await searchFeed(q);
  res.json({ items: all.slice(0, 8) });
});

// GET /v1/feed/category/:cat
router.get('/category/:cat', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const cat = req.params.cat;

  const payload = await cache.withCache(`feed:cat:${cat}:p=${page}:l=${limit}`, LIST_TTL, async () => {
    const fetch = page * limit;
    const catFilter = { is_active: true, category: cat, ...HAS_IMAGE };
    const [deals, products, dealCount, productCount] = await Promise.all([
      Deal.find(catFilter).sort({ posted_at: -1 }).limit(fetch).lean() as Promise<FeedItem[]>,
      Product.find(catFilter).sort({ posted_at: -1 }).limit(fetch).lean() as Promise<FeedItem[]>,
      Deal.countDocuments(catFilter),
      Product.countDocuments(catFilter),
    ]);

    const merged = [...tag(deals, 'deal'), ...tag(products, 'product')]
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());

    const skip = (page - 1) * limit;
    const data = merged.slice(skip, skip + limit);
    const total = dealCount + productCount;

    return { data, page, limit, total, hasMore: skip + data.length < total };
  });

  res.json(payload);
});

export default router;
