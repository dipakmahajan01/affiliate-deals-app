/**
 * Normalize a product title for deduplication:
 * lowercase, replace all non-alphanumeric chars with spaces, collapse whitespace.
 * This handles emoji, punctuation, and formatting differences across channels.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedDeal {
  product_title: string;
  price: number | null;
  original_price: number | null;
  coupon_text: string | null;
  url: string | null;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Electronics: ['phone', 'mobile', 'laptop', 'earphone', 'headphone', 'speaker', 'charger', 'cable', 'tv', 'camera', 'tablet', 'ipad', 'smartwatch', 'powerbank', 'power bank', 'router', 'keyboard', 'mouse', 'monitor', 'ssd', 'hard disk', 'pendrive'],
  Kitchen: ['cooker', 'mixer', 'grinder', 'pan', 'kadai', 'oven', 'microwave', 'fridge', 'refrigerator', 'juicer', 'kettle', 'induction', 'pressure cooker'],
  Fashion: ['shirt', 'tshirt', 't-shirt', 'jeans', 'trouser', 'saree', 'kurta', 'dress', 'shoes', 'sandals', 'watch', 'bag', 'wallet', 'sneakers'],
  Beauty: ['shampoo', 'conditioner', 'face wash', 'moisturizer', 'sunscreen', 'perfume', 'deodorant', 'serum', 'cream', 'lotion'],
  Books: ['book', 'novel', 'textbook', 'paperback', 'hardcover'],
  Grocery: ['rice', 'dal', 'oil', 'ghee', 'flour', 'sugar', 'tea', 'coffee', 'chocolate', 'biscuit', 'snack'],
  Sports: ['gym', 'fitness', 'yoga', 'dumbbell', 'cycle', 'cricket', 'badminton', 'football', 'protein'],
  Home: ['sofa', 'mattress', 'pillow', 'curtain', 'lamp', 'table', 'chair', 'shelf', 'storage'],
};

export function categorize(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'General';
}

export function parseMessage(rawText: string): ParsedDeal {
  // Extract URL
  const urlMatch = rawText.match(/https?:\/\/\S+/);
  const url = urlMatch ? urlMatch[0].replace(/[)>\].,]+$/, '') : null;

  // Extract price — priority:
  // 1. @price (e.g. "Fan @2750") — most reliable in Telegram deal messages
  // 2. ₹price NOT followed by "off" (skip coupon discount amounts like "₹800 Off Coupon")
  const atPriceMatch = rawText.match(/@(\d[\d,]+)/);
  const rupeeMatches = [...rawText.matchAll(/₹(\d[\d,]+)/gi)];
  const nonCouponRupee = rupeeMatches.find((m) => {
    const after = rawText.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 15).toLowerCase();
    return !after.match(/^\s*off\b/);
  });
  const rawPrice = atPriceMatch
    ? parseInt(atPriceMatch[1].replace(/,/g, ''), 10)
    : nonCouponRupee
    ? parseInt(nonCouponRupee[1].replace(/,/g, ''), 10)
    : null;
  const price = rawPrice;

  // Try to find an original/MRP price
  const mrpMatch = rawText.match(/(?:mrp|original|was)[^\d]*(\d[\d,]+)/i);
  const original_price = mrpMatch ? parseInt(mrpMatch[1].replace(/,/g, ''), 10) : null;

  // Extract coupon text — grab the coupon instruction but strip the product name after "|"
  const couponMatch = rawText.match(/(?:apply|use|coupon)[^.!?\n]*/i);
  const coupon_text = couponMatch
    ? couponMatch[0].split('|')[0].trim().slice(0, 100)
    : null;

  // Title: first line, stripped of URL and special chars
  const firstLine = rawText.split('\n')[0] ?? rawText.slice(0, 120);
  const product_title = firstLine
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[₹@#*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  return { product_title, price, original_price, coupon_text, url };
}
