import { Router, Request, Response } from 'express';
import { Channel } from '../models/Channel';

const router = Router();

// GET /v1/channels
router.get('/', async (_req: Request, res: Response) => {
  const channels = await Channel.find({ is_active: true }).lean();
  res.json({ data: channels });
});

export default router;
