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

// GET /v1/feed/search?q=
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

  if (!q) return res.json({ data: [], page, limit, total: 0, hasMore: false });

  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const filter = { is_active: true, product_title: regex, ...HAS_IMAGE };
  const fetch = page * limit;

  const [deals, products, dealCount, productCount] = await Promise.all([
    Deal.find(filter).sort({ posted_at: -1 }).limit(fetch).lean() as Promise<FeedItem[]>,
    Product.find(filter).sort({ posted_at: -1 }).limit(fetch).lean() as Promise<FeedItem[]>,
    Deal.countDocuments(filter),
    Product.countDocuments(filter),
  ]);

  const merged = [...tag(deals, 'deal'), ...tag(products, 'product')]
    .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());

  const skip = (page - 1) * limit;
  const data = merged.slice(skip, skip + limit);
  const total = dealCount + productCount;

  res.json({ data, page, limit, total, hasMore: skip + data.length < total });
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
