import { Schema, model, Document } from 'mongoose';

export interface MessageDoc extends Document {
  channel_id: string;
  message_id: number;
  channel_name: string;
  raw_text: string;
  posted_at: Date;
  has_url: boolean;
  processed: boolean;
}

const MessageSchema = new Schema<MessageDoc>(
  {
    channel_id: { type: String, required: true },
    message_id: { type: Number, required: true },
    channel_name: { type: String, required: true },
    raw_text: { type: String, required: true },
    posted_at: { type: Date, required: true },
    has_url: { type: Boolean, default: false },
    processed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MessageSchema.index({ channel_id: 1, message_id: 1 }, { unique: true });
MessageSchema.index({ processed: 1 });

export const Message = model<MessageDoc>('Message', MessageSchema);
