import { Schema, model, Document, Types } from 'mongoose';

export interface ClickDoc extends Document {
  deal_id: Types.ObjectId;
  user_id?: string;
  clicked_at: Date;
  platform: 'ios' | 'android' | 'web';
}

const ClickSchema = new Schema<ClickDoc>({
  deal_id: { type: Schema.Types.ObjectId, ref: 'Deal', required: true },
  user_id: String,
  clicked_at: { type: Date, default: Date.now },
  platform: { type: String, enum: ['ios', 'android', 'web'], default: 'web' },
});

ClickSchema.index({ deal_id: 1 });
ClickSchema.index({ clicked_at: -1 });

export const Click = model<ClickDoc>('Click', ClickSchema);
