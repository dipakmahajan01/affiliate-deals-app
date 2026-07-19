import mongoose from 'mongoose';
import { Product } from './models/Product';

export async function connectDB() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/affiliate-deals';
  await mongoose.connect(uri);
  await fixStaleProductIndexes();
}

// Self-healing index fix: {normalized_title, price} used to be a unique index. It was changed to
// non-unique in the schema (price mutates during refresh, so uniqueness caused spurious E11000s on
// Product.updateOne in refresh.ts), but Mongoose's autoIndex only creates missing indexes — it never
// alters/drops an existing one. Runs on every boot; no-ops once the stale index is gone.
async function fixStaleProductIndexes(): Promise<void> {
  try {
    const indexes = await Product.collection.indexes();
    const stale = indexes.find(
      (idx) => idx.key?.normalized_title === 1 && idx.key?.price === 1 && idx.unique
    );
    if (!stale) return;

    console.log(`[DB] Dropping stale unique index ${stale.name} on products...`);
    await Product.collection.dropIndex(stale.name!);
    await Product.syncIndexes();
    console.log('[DB] Rebuilt products indexes.');
  } catch (err) {
    console.error('[DB] Failed to fix stale product indexes:', err);
  }
}
