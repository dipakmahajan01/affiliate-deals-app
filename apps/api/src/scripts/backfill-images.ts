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
      updated++;
    }
    await new Promise(r => setTimeout(r, 800));
  }
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
    if (scraped?.image_url) updated++;
    await new Promise(r => setTimeout(r, 800));
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);

  await backfillDeals();
  await backfillProducts();

  await mongoose.disconnect();
}

run().catch(console.error);
