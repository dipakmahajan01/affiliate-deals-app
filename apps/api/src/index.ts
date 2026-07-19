import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db';
import dealRoutes from './routes/deals';
import channelRoutes from './routes/channels';
import adminRoutes from './routes/admin';
import productRoutes from './routes/products';
import feedRoutes from './routes/feed';
import authRoutes from './routes/auth';
import assistantRoutes from './routes/assistant';
import { startPoller } from './services/poller';
import { startRefreshCron } from './services/refresh';
import { startDigestCron } from './services/digest';

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

app.use('/v1/deals', dealRoutes);
app.use('/v1/channels', channelRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/products', productRoutes);
app.use('/v1/feed', feedRoutes);
app.use('/v1/auth', authRoutes);
app.use('/v1/assistant', assistantRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

connectDB().then(async () => {
  app.listen(PORT, () => {
    console.log(`server is running on ${PORT}`)
  });
  startPoller().catch((err) => {
    console.error('[Poller] failed to start — API will continue without it:', err);
  });
  startRefreshCron();
  startDigestCron();
});

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
