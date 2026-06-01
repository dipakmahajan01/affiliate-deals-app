/**
 * One-time backfill to correct ×100-inflated prices caused by the old parsePriceText bug
 * (which stripped the decimal point, turning "₹299.00" into 29900).
 *
 * SAFE by construction — only corrects a row when ALL hold:
 *   - original_price (MRP) exists and is > 0
 *   - price > original_price  (a selling price above MRP is impossible → definitely wrong)
 *   - price is a multiple of 100  (×100 inflation of an integer rupee value)
 *   - price / 100 <= original_price  (the corrected value is a sane ≤ MRP price)
 * Correct rows like "₹127" (not a multiple of 100, not above MRP) are never touched.
 * Anything ambiguous is left for the refresh cron to re-scrape with the fixed parser.
 *
 * Usage:  pnpm --filter @deals/api fix:prices            (dry-run, no writes)
 *         pnpm --filter @deals/api fix:prices -- --apply (apply the corrections)
 */
import 'dotenv/config';
import mongoose, { Model } from 'mongoose';
import { Product } from '../models/Product';
import { Deal } from '../models/Deal';

const APPLY = process.argv.includes('--apply');

function correctedPrice(price?: number, mrp?: number): number | null {
  if (price == null || mrp == null || mrp <= 0) return null;
  if (price <= mrp) return null; // selling price not above MRP — nothing wrong
  if (price % 100 !== 0) return null; // not a clean ×100 inflation
  const fixed = price / 100;
  if (fixed > mrp) return null; // dividing by 100 still above MRP — don't guess
  return fixed;
}

async function fixModel(model: Model<Record<string, unknown>>, name: string) {
  // Candidates: selling price above MRP (the only way ×100 inflation is detectable here).
  const docs = await model
    .find({ price: { $gt: 0 }, original_price: { $gt: 0 }, $expr: { $gt: ['$price', '$original_price'] } })
    .select('_id product_title price original_price discount_percent lowest_price previous_price')
    .lean();

  let fixed = 0;
  const samples: string[] = [];

  for (const d of docs as Array<Record<string, unknown>>) {
    const price = d.price as number;
    const mrp = d.original_price as number;
    const newPrice = correctedPrice(price, mrp);
    if (newPrice == null) continue;

    const set: Record<string, unknown> = { price: newPrice };
    set.discount_percent = Math.max(0, Math.round(((mrp - newPrice) / mrp) * 100));

    // Repair price-drop fields if they were inflated the same way.
    const low = d.lowest_price as number | undefined;
    if (low != null && low % 100 === 0 && low > mrp) set.lowest_price = low / 100;
    const prev = d.previous_price as number | undefined;
    if (prev != null && prev % 100 === 0 && prev > mrp) set.previous_price = prev / 100;

    if (samples.length < 8) {
      samples.push(`  ₹${price} → ₹${newPrice}  (MRP ₹${mrp})  ${String(d.product_title).slice(0, 45)}`);
    }
    fixed += 1;

    if (APPLY) await model.updateOne({ _id: d._id }, { $set: set });
  }

  console.log(`\n[${name}] candidates(price>MRP)=${docs.length}  correctable=${fixed}`);
  samples.forEach((s) => console.log(s));
  return fixed;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log(APPLY ? '=== APPLYING corrections ===' : '=== DRY RUN (no writes) — pass --apply to write ===');
  const p = await fixModel(Product as unknown as Model<Record<string, unknown>>, 'Product');
  const d = await fixModel(Deal as unknown as Model<Record<string, unknown>>, 'Deal');
  console.log(`\nTotal correctable: ${p + d}${APPLY ? ' (applied)' : ' (dry-run)'}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
