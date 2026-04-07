import { Schema, model, Document } from 'mongoose';

export interface ChannelDoc extends Document {
  channel_username: string;
  display_name: string;
  is_active: boolean;
  last_polled_at?: Date;
}

const ChannelSchema = new Schema<ChannelDoc>(
  {
    channel_username: { type: String, required: true, unique: true },
    display_name: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    last_polled_at: Date,
  },
  { timestamps: true }
);

export const Channel = model<ChannelDoc>('Channel', ChannelSchema);
