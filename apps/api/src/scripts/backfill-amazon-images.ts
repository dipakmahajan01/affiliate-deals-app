/**
 * Re-scrape Amazon PDPs to fill missing product images (and refresh scrape metadata).
 * Targets active Deal + Product rows with source Amazon and no usable image_url.
 *
 * Usage (from repo root):
 *   pnpm --filter @deals/api run backfill:amazon
 *
 * Requires MONGODB_URI in apps/api/.env
 *
 * Optional env:
 *   AMAZON_BACKFILL_LIMIT=200   — max documents per collection (default: unlimited)
 *   AMAZON_BACKFILL_MS=1000     — delay between HTTP requests in ms (default: 900)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Deal } from '../models/Deal';
import { Product } from '../models/Product';
import { scrapeProduct } from '../services/scraper';

const missingImage = {
  $or: [{ image_url: { $exists: false } }, { image_url: null }, { image_url: '' }],
};

function ts(): string {
  return new Date().toISOString();
}

function log(line: string): void {
  process.stdout.write(`[${ts()}] ${line}\n`);
}

async function backfillAmazonDeals(limit?: number): Promise<{ total: number; updated: number; failed: number }> {
  let q = Deal.find({
    source: 'Amazon',
    is_active: true,
    ...missingImage,
  });
  if (limit != null && limit > 0) q = q.limit(limit);
  const deals = await q.lean();

  log(`Deals: ${deals.length} rows to process${limit ? ` (limit=${limit})` : ''}`);

  let updated = 0;
  let failed = 0;
  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    const pageUrl = deal.resolved_url || deal.affiliate_url;
    const idx = `${i + 1}/${deals.length}`;
    if (!pageUrl) {
      log(`  Deal ${idx} SKIP (no url) _id=${deal._id}`);
      continue;
    }

    const scraped = await scrapeProduct(pageUrl, 'Amazon');
    const patch: Record<string, unknown> = {};
    if (scraped?.title?.trim()) patch.product_title = scraped.title.trim();
    if (scraped?.image_url) patch.image_url = scraped.image_url;
    if (scraped?.rating != null) patch.rating = scraped.rating;
    if (scraped?.bank_offers?.length) patch.bank_offers = scraped.bank_offers;

    if (Object.keys(patch).length > 0) {
      await Deal.updateOne({ _id: deal._id }, { $set: patch });
      if (scraped?.image_url) {
        updated++;
        log(`  Deal ${idx} OK img=${scraped.image_url}`);
      } else {
        log(`  Deal ${idx} PARTIAL (no image) keys=${Object.keys(patch).join(',')} url=${pageUrl}`);
      }
    } else {
      failed++;
      log(`  Deal ${idx} FAIL (no data) url=${pageUrl}`);
    }
    await delay();
  }
  log(`Deals done: updated=${updated} failed=${failed} total=${deals.length}`);
  return { total: deals.length, updated, failed };
}

async function backfillAmazonProducts(limit?: number): Promise<{ total: number; updated: number; failed: number }> {
  let q = Product.find({
    source: 'Amazon',
    is_active: true,
    ...missingImage,
  });
  if (limit != null && limit > 0) q = q.limit(limit);
  const products = await q.lean();

  log(`Products: ${products.length} rows to process${limit ? ` (limit=${limit})` : ''}`);

  let updated = 0;
  let failed = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const pageUrl = p.resolved_url || p.affiliate_url;
    const idx = `${i + 1}/${products.length}`;
    if (!pageUrl) {
      log(`  Product ${idx} SKIP (no url) _id=${p._id}`);
      continue;
    }

    const scraped = await scrapeProduct(pageUrl, 'Amazon');
    const patch: Record<string, unknown> = {
      scrape_status: scraped ? 'success' : 'failed',
      scraped_at: new Date(),
    };
    if (scraped?.title?.trim()) patch.product_title = scraped.title.trim();
    if (scraped?.image_url) patch.image_url = scraped.image_url;
    if (scraped?.rating != null) patch.rating = scraped.rating;
    if (scraped?.bank_offers?.length) patch.bank_offers = scraped.bank_offers;
    if (scraped?.description) patch.description = scraped.description;
    if (scraped?.features?.length) patch.features = scraped.features;

    await Product.updateOne({ _id: p._id }, { $set: patch });
    if (scraped?.image_url) {
      updated++;
      log(`  Product ${idx} OK img=${scraped.image_url}`);
    } else if (scraped) {
      log(`  Product ${idx} PARTIAL (no image) url=${pageUrl}`);
    } else {
      failed++;
      log(`  Product ${idx} FAIL (scrape returned null) url=${pageUrl}`);
    }
    await delay();
  }
  log(`Products done: updated=${updated} failed=${failed} total=${products.length}`);
  return { total: products.length, updated, failed };
}

let delayMs = 900;
function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, delayMs));
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    log('MONGODB_URI is not set (apps/api/.env)');
    process.exit(1);
  }

  const limitRaw = process.env.AMAZON_BACKFILL_LIMIT;
  const parsedLimit = limitRaw ? parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
  const msEnv = process.env.AMAZON_BACKFILL_MS;
  if (msEnv != null && msEnv !== '') {
    const n = parseInt(msEnv, 10);
    if (!Number.isNaN(n) && n >= 200) delayMs = n;
  }

  log(`Starting Amazon image backfill (delay=${delayMs}ms, limit=${limit ?? 'none'})`);
  log(`Connecting to MongoDB...`);
  await mongoose.connect(uri);
  log(`Connected.`);

  const start = Date.now();
  const deals = await backfillAmazonDeals(limit);
  const products = await backfillAmazonProducts(limit);
  const elapsedSec = Math.round((Date.now() - start) / 1000);

  await mongoose.disconnect();
  log(`Disconnected from MongoDB.`);

  log(
    `Backfill finished in ${elapsedSec}s — ` +
    `Deals: ${deals.updated} updated / ${deals.failed} failed / ${deals.total} total; ` +
    `Products: ${products.updated} updated / ${products.failed} failed / ${products.total} total`
  );
}

run().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
