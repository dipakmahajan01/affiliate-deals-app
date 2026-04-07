export type DealSource = 'Amazon' | 'Flipkart';
export type Platform = 'ios' | 'android' | 'web';

export interface Deal {
  _id: string;
  item_type?: 'deal' | 'product';
  channel_id: string;
  message_id: number;
  product_title: string;
  price: number;
  original_price?: number;
  discount_percent?: number;
  coupon_text?: string;
  original_url: string;
  affiliate_url: string;
  image_url?: string;
  /** Present on scraped products (Amazon/Flipkart detail pages). */
  rating?: number;
  /** Short lines, e.g. Amazon bank discount cards. */
  bank_offers?: string[];
  category: string;
  source: DealSource;
  posted_at: string;
  views: number;
  clicks: number;
  is_active: boolean;
}

export interface Product extends Deal {
  item_type: 'product';
  description?: string;
  features?: string[];
  scrape_status: 'success' | 'failed' | 'pending';
  scraped_at?: string;
}

export interface Channel {
  _id: string;
  channel_username: string;
  display_name: string;
  is_active: boolean;
  last_polled_at?: string;
}

export interface Click {
  _id: string;
  deal_id: string;
  user_id?: string;
  clicked_at: string;
  platform: Platform;
}

export interface AffiliateConfig {
  _id: string;
  amazon_tag: string;
  flipkart_affid: string;
  updated_at: string;
}

// API response shapes
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface AdminStats {
  total_deals: number;
  active_deals: number;
  total_clicks: number;
  total_views: number;
  clicks_today: number;
  top_deals: Pick<Deal, '_id' | 'product_title' | 'clicks' | 'views'>[];
}
