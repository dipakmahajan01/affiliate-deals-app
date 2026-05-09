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
  // 2. First ₹price not adjacent to MRP/cashback/off keywords. We check chars *before* ₹ for
  //    MRP-like keywords (the ₹ is the strike-through price) and *after* for coupon-like keywords
  //    (the ₹ is a discount amount). Whatever survives is the actual buy price.
  const atPriceMatch = rawText.match(/@(\d[\d,]+)/);
  const COUPON_AFTER = /^\s*(off|cashback|discount|coupon|extra|cb)\b/i;
  const MRP_BEFORE = /(?:\b(?:mrp|m\.r\.p\.?|original|originally|was|list\s*price)\b)\s*[:\-]?\s*$/i;
  const rupeeCandidates = [...rawText.matchAll(/₹\s*(\d[\d,]+)/gi)]
    .map((m) => {
      const idx = m.index ?? 0;
      const before = rawText.slice(Math.max(0, idx - 25), idx);
      const after = rawText.slice(idx + m[0].length, idx + m[0].length + 25);
      return {
        value: parseInt(m[1].replace(/,/g, ''), 10),
        isCouponLike: COUPON_AFTER.test(after),
        isMrpLike: MRP_BEFORE.test(before),
      };
    })
    .filter((c) => Number.isFinite(c.value) && c.value > 0);
  const cleanCandidates = rupeeCandidates.filter((c) => !c.isCouponLike && !c.isMrpLike);
  const pickFrom = cleanCandidates.length ? cleanCandidates : rupeeCandidates;
  const firstRupee = pickFrom[0] ?? null;
  const rawPrice = atPriceMatch
    ? parseInt(atPriceMatch[1].replace(/,/g, ''), 10)
    : firstRupee
    ? firstRupee.value
    : null;
  const price = rawPrice;

  // Try to find an original/MRP price.
  // Require an optional ₹/Rs prefix and forbid a `%` immediately after the digits, so
  // "MRP 50% Off ₹8000" captures 8000 (via ₹), not 50.
  const mrpMatch = rawText.match(/(?:mrp|original|was)[^\d]*?(?:₹|rs\.?\s*)\s*(\d[\d,]+)(?!\s*%)/i);
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
