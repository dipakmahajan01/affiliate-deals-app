import { Schema, model, Document } from 'mongoose';

export interface AffiliateConfigDoc extends Document {
  amazon_tag: string;
  flipkart_affid: string;
}

const AffiliateConfigSchema = new Schema<AffiliateConfigDoc>(
  {
    amazon_tag: { type: String, required: true },
    flipkart_affid: { type: String, required: true },
  },
  { timestamps: true }
);

export const AffiliateConfig = model<AffiliateConfigDoc>('AffiliateConfig', AffiliateConfigSchema);
