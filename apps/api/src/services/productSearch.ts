import type { PipelineStage } from 'mongoose';
import { Product } from '../models/Product';

// Public listings only show items with a valid product image — items missing image_url look broken on the card.
const HAS_IMAGE = { image_url: { $exists: true, $nin: [null, ''] } } as const;

export interface ProductSearchParams {
  /** Free-text keywords. When present, results are scored by MongoDB text relevance. */
  query?: string;
  category?: string;
  /** Maximum price in INR. */
  maxPrice?: number;
  /** Minimum star rating (0–5). */
  minRating?: number;
  source?: 'Amazon' | 'Flipkart' | 'Myntra';
  limit?: number;
}

/**
 * Shared product search used by both the public `/v1/products/search` route and the
 * AI assistant's `search_products` tool. Mirrors the text-search + affiliate_url dedup
 * pipeline from routes/products.ts so behaviour stays consistent across both callers.
 *
 * Returns lean Product docs (full fields) — callers trim for their own needs (the route
 * returns them as-is; the assistant route serialises a compact summary for the model).
 */
export async function searchProducts(params: ProductSearchParams) {
  const { query, category, maxPrice, minRating, source } = params;
  const limit = Math.min(30, Math.max(1, params.limit ?? 8));

  const hasText = !!query?.trim();

  const match: Record<string, unknown> = { is_active: true, ...HAS_IMAGE };
  if (hasText) match.$text = { $search: query!.trim() };
  if (category) match.category = category;
  if (source) match.source = source;
  if (typeof maxPrice === 'number') match.price = { $lte: maxPrice };
  if (typeof minRating === 'number') match.rating = { $gte: minRating };

  // With a text query, sort by relevance; otherwise surface the most-clicked first.
  const sort: Record<string, unknown> = hasText ? { score: { $meta: 'textScore' } } : { clicks: -1 };

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $sort: sort },
    // Dedup by affiliate_url — same product always produces the same affiliate_url.
    { $group: { _id: '$affiliate_url', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: sort },
    { $limit: limit },
  ] as PipelineStage[];

  return Product.aggregate(pipeline);
}
