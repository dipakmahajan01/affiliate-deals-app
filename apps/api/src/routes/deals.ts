import { Router, Request, Response } from 'express';
import { Deal } from '../models/Deal';
import { Click } from '../models/Click';

const router = Router();

// Public listings only show items with a valid product image — items missing image_url look broken on the card.
const HAS_IMAGE = { image_url: { $exists: true, $nin: [null, ''] } } as const;

// GET /v1/deals — paginated list
router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const filter = { is_active: true, ...HAS_IMAGE };
  const [data, total] = await Promise.all([
    Deal.find(filter).sort({ posted_at: -1 }).skip(skip).limit(limit).lean(),
    Deal.countDocuments(filter),
  ]);

  res.json({ data, page, limit, total, hasMore: skip + data.length < total });
});

// GET /v1/deals/trending — top clicked in last 24h
router.get('/trending', async (_req: Request, res: Response) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const data = await Deal.find({ is_active: true, posted_at: { $gte: since }, ...HAS_IMAGE })
    .sort({ clicks: -1 })
    .limit(20)
    .lean();
  res.json({ data });
});

// GET /v1/deals/search?q=
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q) return res.json({ data: [] });

  const data = await Deal.find({
    is_active: true,
    $text: { $search: q },
    ...HAS_IMAGE,
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(30)
    .lean();

  res.json({ data });
});

// GET /v1/deals/category/:cat
router.get('/category/:cat', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const filter = { is_active: true, category: req.params.cat, ...HAS_IMAGE };
  const [data, total] = await Promise.all([
    Deal.find(filter).sort({ posted_at: -1 }).skip(skip).limit(limit).lean(),
    Deal.countDocuments(filter),
  ]);

  res.json({ data, page, limit, total, hasMore: skip + data.length < total });
});

// GET /v1/deals/:id
router.get('/:id', async (req: Request, res: Response) => {
  const deal = await Deal.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).lean();
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  res.json(deal);
});

// POST /v1/deals/:id/click — returns affiliate URL and tracks click
router.post('/:id/click', async (req: Request, res: Response) => {
  const deal = await Deal.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } }, { new: true }).lean();
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  await Click.create({
    deal_id: deal._id,
    user_id: req.body.user_id,
    platform: req.body.platform ?? 'web',
  });

  res.json({ affiliateUrl: deal.affiliate_url });
});

export default router;
