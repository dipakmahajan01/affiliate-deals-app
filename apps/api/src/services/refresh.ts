import cron from 'node-cron';
import { Product } from '../models/Product';
import { scrapeProduct } from './scraper';

const BATCH_SIZE = 50;
// If the live price is more than this fraction higher than the originally posted price,
// the deal is considered expired and flipped to is_active: false.
const EXPIRY_PRICE_INCREASE_THRESHOLD = 0.25;

export async function refreshActiveDeals(batchSize = BATCH_SIZE): Promise<{ refreshed: number; deactivated: number; failed: number }> {
  const deals = await Product.find({ is_active: true })
    .sort({ scraped_at: 1 })
    .limit(batchSize)
    .select('_id source resolved_url affiliate_url price original_price product_title')
    .lean();

  let refreshed = 0;
  let deactivated = 0;
  let failed = 0;

  for (const d of deals) {
    const url = d.resolved_url || d.affiliate_url;
    if (!url) continue;

    const scraped = await scrapeProduct(url, d.source).catch(() => null);
    const now = new Date();

    if (!scraped) {
      await Product.updateOne({ _id: d._id }, { $set: { scrape_status: 'failed', scraped_at: now } });
      failed += 1;
      continue;
    }

    const livePrice = scraped.price;
    const update: Record<string, unknown> = { scrape_status: 'success', scraped_at: now };
    if (scraped.rating != null) update.rating = scraped.rating;
    if (scraped.image_url) update.image_url = scraped.image_url;
    if (scraped.title?.trim()) update.product_title = scraped.title.trim();
    if (scraped.bank_offers?.length) update.bank_offers = scraped.bank_offers;
    if (scraped.features?.length) update.features = scraped.features;
    if (scraped.original_price != null) update.original_price = scraped.original_price;

    let shouldDeactivate = false;
    if (livePrice != null) {
      update.price = livePrice;
      if (d.price && livePrice > d.price * (1 + EXPIRY_PRICE_INCREASE_THRESHOLD)) {
        shouldDeactivate = true;
      }
    }
    if (shouldDeactivate) {
      update.is_active = false;
      deactivated += 1;
    } else {
      refreshed += 1;
    }

    await Product.updateOne({ _id: d._id }, { $set: update });
  }

  return { refreshed, deactivated, failed };
}

export function startRefreshCron(): void {
  // Every 30 min: refresh a batch of the oldest-scraped active deals.
  cron.schedule('*/30 * * * *', async () => {
    try {
      await refreshActiveDeals();
    } catch (err) {
      console.error('[Refresh] ❌ Error in refresh cron:', err);
    }
  });
}
