import 'dotenv/config';
import mongoose from 'mongoose';
import { Deal } from '../models/Deal';
import { scrapeProduct } from '../services/scraper';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const deals = await Deal.find({ image_url: { $exists: false }, is_active: true });
  console.log(`Found ${deals.length} deals without images`);

  let updated = 0;
  for (const deal of deals) {
    const scraped = await scrapeProduct(deal.affiliate_url, deal.source);
    if (scraped?.image_url) {
      await Deal.updateOne({ _id: deal._id }, { $set: { image_url: scraped.image_url } });
      console.log(`✅ ${deal.product_title.slice(0, 50)} → image saved`);
      updated++;
    } else {
      console.log(`⚠️  ${deal.product_title.slice(0, 50)} → no image found`);
    }
    // small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\nDone: ${updated}/${deals.length} deals updated with images`);
  await mongoose.disconnect();
}

run().catch(console.error);
