import 'dotenv/config';
import mongoose from 'mongoose';
import { Deal } from '../models/Deal';
import { Product } from '../models/Product';
import { scrapeProduct } from '../services/scraper';

async function backfillDeals() {
  const deals = await Deal.find({
    $or: [{ image_url: { $exists: false } }, { image_url: null }],
    is_active: true,
  });
  console.log(`\n[Deals] Found ${deals.length} deals without images`);

  let updated = 0;
  for (const deal of deals) {
    const pageUrl = deal.resolved_url || deal.affiliate_url;
    const scraped = await scrapeProduct(pageUrl, deal.source);
    const patch: Record<string, unknown> = {};
    if (scraped?.title?.trim()) patch.product_title = scraped.title.trim();
    if (scraped?.image_url) patch.image_url = scraped.image_url;
    if (scraped?.rating != null) patch.rating = scraped.rating;
    if (scraped?.bank_offers?.length) patch.bank_offers = scraped.bank_offers;

    if (Object.keys(patch).length > 0) {
      await Deal.updateOne({ _id: deal._id }, { $set: patch });
      console.log(`✅ [Deal] ${deal.product_title.slice(0, 50)} → updated`);
      updated++;
    } else {
      console.log(`⚠️  [Deal] ${deal.product_title.slice(0, 50)} → nothing found`);
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`[Deals] Done: ${updated}/${deals.length} updated`);
}

async function backfillProducts() {
  const products = await Product.find({
    $or: [
      { scrape_status: 'failed' },
      { image_url: { $exists: false } },
      { image_url: null },
    ],
    is_active: true,
  });
  console.log(`\n[Products] Found ${products.length} products to re-scrape`);

  let updated = 0;
  for (const product of products) {
    const pageUrl = product.resolved_url || product.affiliate_url;
    const scraped = await scrapeProduct(pageUrl, product.source);
    const patch: Record<string, unknown> = {};
    if (scraped?.title?.trim()) patch.product_title = scraped.title.trim();
    if (scraped?.image_url) patch.image_url = scraped.image_url;
    if (scraped?.rating != null) patch.rating = scraped.rating;
    if (scraped?.bank_offers?.length) patch.bank_offers = scraped.bank_offers;
    if (scraped?.description) patch.description = scraped.description;
    if (scraped?.features?.length) patch.features = scraped.features;
    patch.scrape_status = scraped ? 'success' : 'failed';
    patch.scraped_at = new Date();

    await Product.updateOne({ _id: product._id }, { $set: patch });
    if (scraped?.image_url) {
      console.log(`✅ [Product] ${product.product_title.slice(0, 50)} → updated`);
      updated++;
    } else {
      console.log(`⚠️  [Product] ${product.product_title.slice(0, 50)} → scrape failed`);
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`[Products] Done: ${updated}/${products.length} updated`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  await backfillDeals();
  await backfillProducts();

  await mongoose.disconnect();
  console.log('\nBackfill complete.');
}

run().catch(console.error);
