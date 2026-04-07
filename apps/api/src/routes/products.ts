import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';
import { Click } from '../models/Click';

const router = Router();

// GET /v1/products
router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Product.find({ is_active: true }).sort({ posted_at: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments({ is_active: true }),
  ]);

  res.json({ data, page, limit, total, hasMore: skip + data.length < total });
});

// GET /v1/products/trending
router.get('/trending', async (_req: Request, res: Response) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const data = await Product.find({ is_active: true, posted_at: { $gte: since } })
    .sort({ clicks: -1 })
    .limit(20)
    .lean();
  res.json({ data });
});

// GET /v1/products/search?q=
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q) return res.json({ data: [] });

  const data = await Product.find({
    is_active: true,
    $text: { $search: q },
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(30)
    .lean();

  res.json({ data });
});

// GET /v1/products/category/:cat
router.get('/category/:cat', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Product.find({ is_active: true, category: req.params.cat }).sort({ posted_at: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments({ is_active: true, category: req.params.cat }),
  ]);

  res.json({ data, page, limit, total, hasMore: skip + data.length < total });
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
