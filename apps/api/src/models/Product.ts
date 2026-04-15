import { Schema, model, Document } from 'mongoose';

export interface ProductDoc extends Document {
  channel_id: string;
  message_id: number;
  product_title: string;
  price: number;
  original_price?: number;
  discount_percent?: number;
  coupon_text?: string;
  original_url: string;
  resolved_url?: string;
  affiliate_url: string;
  image_url?: string;
  category: string;
  source: 'Amazon' | 'Flipkart';
  posted_at: Date;
  views: number;
  clicks: number;
  is_active: boolean;
  // Scraped fields
  description?: string;
  rating?: number;
  features?: string[];
  bank_offers?: string[];
  scrape_status: 'success' | 'failed' | 'pending';
  scraped_at?: Date;
}

const ProductSchema = new Schema<ProductDoc>(
  {
    channel_id: { type: String, required: true },
    message_id: { type: Number, required: true },
    product_title: { type: String, required: true },
    price: { type: Number, required: true },
    original_price: Number,
    discount_percent: Number,
    coupon_text: String,
    original_url: { type: String, required: true },
    resolved_url: { type: String },
    affiliate_url: { type: String, required: true },
    image_url: String,
    category: { type: String, default: 'General' },
    source: { type: String, enum: ['Amazon', 'Flipkart'], required: true },
    posted_at: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    // Scraped fields
    description: String,
    rating: Number,
    features: [String],
    bank_offers: [String],
    scrape_status: { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
    scraped_at: Date,
  },
  { timestamps: true }
);

ProductSchema.index({ channel_id: 1, message_id: 1 }, { unique: true });
// Sparse unique index prevents the same product URL appearing from multiple channels
ProductSchema.index({ resolved_url: 1 }, { unique: true, sparse: true });
// Fast lookup for affiliate_url deduplication across channels
ProductSchema.index({ affiliate_url: 1 });
// Fast lookup for title+price deduplication across channels
ProductSchema.index({ product_title: 1, price: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ product_title: 'text', description: 'text' });
ProductSchema.index({ clicks: -1, posted_at: -1 });

export const Product = model<ProductDoc>('Product', ProductSchema);
