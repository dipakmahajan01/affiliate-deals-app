import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Deal } from '../models/Deal';
import { Channel } from '../models/Channel';
import { Click } from '../models/Click';
import { AffiliateConfig } from '../models/AffiliateConfig';
import { requireAdmin } from '../middleware/auth';
import { pollChannel, getTelegramChannels } from '../services/poller';

const router = Router();

// POST /v1/admin/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminHash = process.env.ADMIN_PASSWORD_HASH ?? '';
  const adminPassword = process.env.ADMIN_PASSWORD;

  const emailOk = email === adminEmail;
  const passwordOk = adminHash
    ? await bcrypt.compare(password, adminHash)
    : password === adminPassword;

  if (!emailOk || !passwordOk) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET ?? 'secret', { expiresIn: '7d' });
  res.json({ token });
});

// All routes below require JWT
router.use(requireAdmin);

// GET /v1/admin/stats
router.get('/stats', async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total_deals, active_deals, total_clicks, total_views, clicks_today, top_deals] = await Promise.all([
    Deal.countDocuments(),
    Deal.countDocuments({ is_active: true }),
    Click.countDocuments(),
    Deal.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]).then((r) => r[0]?.total ?? 0),
    Click.countDocuments({ clicked_at: { $gte: today } }),
    Deal.find({ is_active: true }).sort({ clicks: -1 }).limit(5).select('product_title clicks views').lean(),
  ]);

  res.json({ total_deals, active_deals, total_clicks, total_views, clicks_today, top_deals });
});

// GET /v1/admin/deals — all deals (including inactive)
router.get('/deals', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Deal.find().sort({ posted_at: -1 }).skip(skip).limit(limit).lean(),
    Deal.countDocuments(),
  ]);
  res.json({ data, page, limit, total, hasMore: skip + data.length < total });
});

// PATCH /v1/admin/deals/:id
router.patch('/deals/:id', async (req: Request, res: Response) => {
  const allowed = ['product_title', 'price', 'coupon_text', 'category', 'is_active', 'image_url'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }

  const deal = await Deal.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
  if (!deal) return res.status(404).json({ error: 'Not found' });
  res.json(deal);
});

// POST /v1/admin/channels
router.post('/channels', async (req: Request, res: Response) => {
  const { channel_username, display_name } = req.body;
  const channel = await Channel.create({ channel_username, display_name });
  res.status(201).json(channel);
});

// PATCH /v1/admin/channels/:id
router.patch('/channels/:id', async (req: Request, res: Response) => {
  const update: Record<string, unknown> = {};
  if (req.body.is_active !== undefined) update.is_active = req.body.is_active;
  if (req.body.display_name !== undefined) update.display_name = req.body.display_name;
  if (req.body.channel_username !== undefined) update.channel_username = req.body.channel_username;
  const channel = await Channel.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true }
  ).lean();
  if (!channel) return res.status(404).json({ error: 'Not found' });
  res.json(channel);
});

// DELETE /v1/admin/channels/:id
router.delete('/channels/:id', async (req: Request, res: Response) => {
  await Channel.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// GET /v1/admin/affiliate-config
router.get('/affiliate-config', async (_req: Request, res: Response) => {
  const config = await AffiliateConfig.findOne().sort({ createdAt: -1 }).lean();
  res.json(config ?? {});
});

// PATCH /v1/admin/affiliate-config
router.patch('/affiliate-config', async (req: Request, res: Response) => {
  const { amazon_tag, flipkart_affid, myntra_affiliate_suffix } = req.body as {
    amazon_tag?: string;
    flipkart_affid?: string;
    myntra_affiliate_suffix?: string;
  };
  const $set: Record<string, string> = {};
  if (amazon_tag !== undefined) $set.amazon_tag = amazon_tag;
  if (flipkart_affid !== undefined) $set.flipkart_affid = flipkart_affid;
  if (myntra_affiliate_suffix !== undefined) $set.myntra_affiliate_suffix = myntra_affiliate_suffix;
  const config = await AffiliateConfig.findOneAndUpdate({}, { $set }, { upsert: true, new: true }).lean();
  res.json(config);
});

// GET /v1/admin/telegram-channels — list all channels the Telegram account has joined
router.get('/telegram-channels', async (_req: Request, res: Response) => {
  try {
    const channels = await getTelegramChannels();
    res.json({ data: channels });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /v1/admin/channels/import — bulk-add channels from Telegram into MongoDB
router.post('/channels/import', async (req: Request, res: Response) => {
  const { channels } = req.body as { channels: { username: string; title: string }[] };
  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({ error: 'channels array required' });
  }

  const results = await Promise.all(
    channels.map(async ({ username, title }) => {
      try {
        await Channel.updateOne(
          { channel_username: username },
          { $setOnInsert: { channel_username: username, display_name: title, is_active: true } },
          { upsert: true }
        );
        return { username, status: 'ok' };
      } catch {
        return { username, status: 'error' };
      }
    })
  );

  res.json({ results });
});

// POST /v1/admin/poll — manually trigger a poll
router.post('/poll', async (req: Request, res: Response) => {
  const { channel_username, limit } = req.body;
  const msgLimit = Math.min(500, Math.max(10, parseInt(limit) || 100));
  try {
    await pollChannel(channel_username, msgLimit);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
