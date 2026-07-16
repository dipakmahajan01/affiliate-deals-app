import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';
import { Click } from '../models/Click';
import { cache } from '../services/cache';
import { searchProducts } from '../services/productSearch';

const router = Router();

// Public listings only show items with a valid product image — items missing image_url look broken on the card.
const HAS_IMAGE = { image_url: { $exists: true, $nin: [null, ''] } } as const;

const LIST_TTL = 60;

// GET /v1/products
router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

  const payload = await cache.withCache(`products:list:p=${page}:l=${limit}`, LIST_TTL, async () => {
    const skip = (page - 1) * limit;

    // Deduplicate by affiliate_url — same ASIN/product always produces the same affiliate_url,
    // so this catches duplicates across all channels including old records without resolved_url.
    const [result] = await Product.aggregate([
      { $match: { is_active: true, ...HAS_IMAGE } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$affiliate_url',
          doc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      },
    ]);

    const data = result?.data ?? [];
    const total = result?.count?.[0]?.total ?? 0;
    return { data, page, limit, total, hasMore: skip + data.length < total };
  });

  res.json(payload);
});

// GET /v1/products/trending
router.get('/trending', async (_req: Request, res: Response) => {
  const payload = await cache.withCache('products:trending', LIST_TTL, async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const data = await Product.aggregate([
      { $match: { is_active: true, posted_at: { $gte: since }, ...HAS_IMAGE } },
      { $sort: { clicks: -1 } },
      {
        $group: {
          _id: '$affiliate_url',
          doc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
    ]);
    return { data };
  });
  res.json(payload);
});

// GET /v1/products/search?q=
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q) return res.json({ data: [] });

  const data = await searchProducts({ query: q, limit: 30 });
  res.json({ data });
});

// GET /v1/products/category/:cat
router.get('/category/:cat', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const cat = req.params.cat;

  const payload = await cache.withCache(`products:cat:${cat}:p=${page}:l=${limit}`, LIST_TTL, async () => {
    const [result] = await Product.aggregate([
      { $match: { is_active: true, category: cat, ...HAS_IMAGE } },
      { $sort: { posted_at: -1 } },
      {
        $group: {
          _id: '$affiliate_url',
          doc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { posted_at: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      },
    ]);

    const data = result?.data ?? [];
    const total = result?.count?.[0]?.total ?? 0;
    return { data, page, limit, total, hasMore: skip + data.length < total };
  });

  res.json(payload);
});

// GET /v1/products/by-ids?ids=a,b,c — fetches a specific set of products, preserving the given order.
// Used by the email digest landing page to show the same products that were emailed.
router.get('/by-ids', async (req: Request, res: Response) => {
  const ids = ((req.query.ids as string) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return res.json({ data: [] });

  const products = await Product.find({ _id: { $in: ids } }).lean();
  // Tag as 'product' so the client's buy-click handler hits /v1/products/:id/click, not /v1/deals/:id/click.
  const byId = new Map(products.map((p) => [String(p._id), { ...p, item_type: 'product' as const }]));
  const data = ids.map((id) => byId.get(id)).filter(Boolean);
  res.json({ data });
});

// GET /v1/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).lean();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /v1/products/:id/click
router.post('/:id/click', async (req: Request, res: Response) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } }, { new: true }).lean();
  if (!product) return res.status(404).json({ error: 'Product not found' });

  await Click.create({
    deal_id: product._id,
    user_id: req.body.user_id,
    platform: req.body.platform ?? 'web',
  });

  res.json({ affiliateUrl: product.affiliate_url });
});

export default router;
