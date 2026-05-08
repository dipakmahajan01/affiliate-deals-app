import 'dotenv/config';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { scrapeProduct } from '../services/scraper';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const rows = await Product.find({
    source: 'Myntra',
    is_active: true,
    $or: [{ image_url: { $exists: false } }, { image_url: null }, { image_url: '' }],
  });
  console.log(`[Myntra] ${rows.length} products without image_url`);

  let updated = 0;
  for (const r of rows) {
    const pageUrl = r.resolved_url || r.original_url;
    const scraped = await scrapeProduct(pageUrl, 'Myntra');
    const patch: Record<string, unknown> = {
      scrape_status: scraped ? 'success' : 'failed',
      scraped_at: new Date(),
    };
    if (scraped?.image_url) patch.image_url = scraped.image_url;

    await Product.updateOne({ _id: r._id }, { $set: patch });
    if (scraped?.image_url) {
      console.log(`✅ ${r._id} → ${scraped.image_url.slice(0, 90)}`);
      updated++;
    } else {
      console.log(`❌ ${r._id} no image — ${pageUrl.slice(0, 90)}`);
    }
    await new Promise((res) => setTimeout(res, 800));
  }

  console.log(`\n[Myntra] Done: ${updated}/${rows.length} updated`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
