import cron from 'node-cron';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { sendMail, renderDigestEmail, DigestProduct } from './mailer';

const DIGEST_SIZE = 5;
const SEND_DELAY_MS = 300; // throttle to stay under Gmail's per-connection rate limit

// Mirrors the GET /v1/feed/price-drops query (apps/api/src/routes/feed.ts), then randomly
// samples DIGEST_SIZE from the deduped pool so each send features a different mix.
export async function getTopPriceDrops(limit = DIGEST_SIZE): Promise<DigestProduct[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  return Product.aggregate([
    {
      $match: {
        is_active: true,
        price_dropped_at: { $gte: since },
        previous_price: { $gt: 0 },
        $expr: { $lt: ['$price', '$previous_price'] },
      },
    },
    { $sort: { price_drop_percent: -1 } },
    // Dedup by affiliate_url — same product across channels.
    { $group: { _id: '$affiliate_url', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sample: { size: limit } },
  ]);
}

export async function sendDigestToAllUsers(): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const products = await getTopPriceDrops();
  if (products.length === 0) {
    console.log('[Digest] No price drops to send — skipping');
    return { sent: 0, failed: 0, skipped: true };
  }

  const html = renderDigestEmail(products);
  const users = await User.find().select('email').lean();

  let sent = 0;
  let failed = 0;
  for (const u of users) {
    const ok = await sendMail(u.email, "Today's Top Price Drops", html);
    console.log(`[Digest] ${ok ? '✅ sent' : '❌ failed'} → ${u.email}`);
    if (ok) sent++;
    else failed++;
    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  console.log(`[Digest] Sent ${sent}, failed ${failed}, total users ${users.length}`);
  return { sent, failed, skipped: false };
}

export function startDigestCron(): void {
  // 9 PM server local time
  cron.schedule('0 21 * * *', () => {
    sendDigestToAllUsers().catch((err) => console.error('[Digest] ❌ 9PM run failed:', err));
  });
  // 10 AM server local time
  cron.schedule('0 9 * * *', () => {
    sendDigestToAllUsers().catch((err) => console.error('[Digest] ❌ 9AM run failed:', err));
  });
}
