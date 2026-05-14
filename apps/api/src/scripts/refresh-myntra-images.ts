import 'dotenv/config';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { scrapeProduct } from '../services/scraper';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const rows = await Product.find({
    source: 'Myntra',
    is_active: true,
    $or: [{ image_url: { $exists: false } }, { image_url: null }, { image_url: '' }],
  });

  let updated = 0;
  for (const r of rows) {
    const pageUrl = r.resolved_url || r.original_url;
    const scraped = await scrapeProduct(pageUrl, 'Myntra');
    const patch: Record<string, unknown> = {
      scrape_status: scraped ? 'success' : 'failed',
      scraped_at: new Date(),
    };
    if (scraped?.image_url) {
      patch.image_url = scraped.image_url;
      updated++;
    }

    await Product.updateOne({ _id: r._id }, { $set: patch });
    await new Promise((res) => setTimeout(res, 800));
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
