import { Schema, model, Document } from 'mongoose';

export interface DealDoc extends Document {
  channel_id: string;
  message_id: number;
  product_title: string;
  normalized_title: string;
  price: number;
  original_price?: number;
  discount_percent?: number;
  coupon_text?: string;
  original_url: string;
  resolved_url?: string;
  affiliate_url: string;
  image_url?: string;
  rating?: number;
  bank_offers?: string[];
  category: string;
  source: 'Amazon' | 'Flipkart';
  posted_at: Date;
  views: number;
  clicks: number;
  is_active: boolean;
}

const DealSchema = new Schema<DealDoc>(
  {
    channel_id: { type: String, required: true },
    message_id: { type: Number, required: true },
    product_title: { type: String, required: true },
    normalized_title: { type: String },
    price: { type: Number, required: true },
    original_price: Number,
    discount_percent: Number,
    coupon_text: String,
    original_url: { type: String, required: true },
    resolved_url: { type: String },
    affiliate_url: { type: String, required: true },
    image_url: String,
    rating: Number,
    bank_offers: [String],
    category: { type: String, default: 'General' },
    source: { type: String, enum: ['Amazon', 'Flipkart'], required: true },
    posted_at: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique constraint to prevent duplicate messages within the same channel
DealSchema.index({ channel_id: 1, message_id: 1 }, { unique: true });
// Sparse unique index prevents the same product URL appearing from multiple channels
DealSchema.index({ resolved_url: 1 }, { unique: true, sparse: true });
// Fast lookup for affiliate_url deduplication across channels
DealSchema.index({ affiliate_url: 1 });
// Unique dedup index: normalized title + price prevents same product from being inserted twice
// sparse:true so existing docs without normalized_title are excluded (no migration needed)
DealSchema.index({ normalized_title: 1, price: 1 }, { unique: true, sparse: true });
DealSchema.index({ category: 1 });
DealSchema.index({ product_title: 'text' });
DealSchema.index({ clicks: -1, posted_at: -1 });

export const Deal = model<DealDoc>('Deal', DealSchema);
