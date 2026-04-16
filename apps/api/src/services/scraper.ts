import axios from 'axios';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export interface ScrapedProduct {
  title?: string;
  image_url?: string;
  description?: string;
  rating?: number;
  features?: string[];
  bank_offers?: string[];
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

function buildHeaders(url: string) {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    // Omit br: Node axios often lacks Brotli decompression, which yields binary garbage and breaks Cheerio.
    'Accept-Encoding': 'gzip, deflate',
    'Referer': new URL(url).origin,
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };
}

async function fetchWithRetry(url: string, maxRetries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await axios.get(url, {
        headers: buildHeaders(url),
        timeout: 12000,
        maxRedirects: 5,
      });
      return resp.data as string;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const isRetryable = !status || status >= 500 || status === 429;
      if (attempt < maxRetries && isRetryable) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      return null;
    }
  }
  return null;
}

// Flipkart requires ses=1 cookie and specific headers to avoid bot-detection redirects
async function fetchFlipkart(url: string): Promise<string | null> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const resp = await axios.get(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-IN,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Cookie': 'ses=1; T=1',
          'Referer': 'https://www.flipkart.com/',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 15000,
        maxRedirects: 5,
      });
      return resp.data as string;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const isRetryable = !status || status >= 500 || status === 429;
      if (attempt < 2 && isRetryable) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      return null;
    }
  }
  return null;
}

function pickLargestDynamicImage(dataDynamic: string | undefined): string | undefined {
  if (!dataDynamic) return undefined;
  try {
    const map = JSON.parse(dataDynamic) as Record<string, [number, number]>;
    const urls = Object.keys(map).filter((u) => u.startsWith('http'));
    if (urls.length === 0) return undefined;
    return urls.reduce((best, u) => {
      const w = map[u]?.[0] ?? 0;
      const bw = map[best]?.[0] ?? 0;
      return w >= bw ? u : best;
    });
  } catch {
    return undefined;
  }
}

function parseAmazonRating($: CheerioAPI): number | undefined {
  const outOf = $('span[data-hook="rating-out-of-text"]').first().text().trim();
  if (outOf) {
    const n = parseFloat(outOf);
    if (!Number.isNaN(n)) return n;
  }

  const iconAlt = $('i[data-hook="average-star-rating"] .a-icon-alt').first().text().trim();
  const m = iconAlt.match(/([\d.]+)\s+out of\s+5/i);
  if (m) {
    const n = parseFloat(m[1]);
    if (!Number.isNaN(n)) return n;
  }

  const starClass = $('i[data-hook="average-star-rating"]').attr('class') ?? '';
  const cm = starClass.match(/a-star-medium-(\d)/);
  if (cm) {
    const n = parseInt(cm[1], 10);
    if (n >= 1 && n <= 5) return n;
  }

  return undefined;
}

function scrapeAmazonBankOffers($: CheerioAPI): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  $('#itembox-InstantBankDiscount .a-truncate-full, #itembox-InstantBankDiscount .offers-items-content')
    .each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 12 && !seen.has(t)) {
        seen.add(t);
        lines.push(t);
      }
    });

  $('.offers-items').each((_, block) => {
    const title = $(block).find('.offers-items-title').first().text().replace(/\s+/g, ' ').trim();
    const body = $(block).find('.a-truncate-full').first().text().replace(/\s+/g, ' ').trim();
    if (!title.toLowerCase().includes('bank')) return;
    const combined = body ? `${title}: ${body}` : title;
    if (combined.length > 8 && !seen.has(combined)) {
      seen.add(combined);
      lines.push(combined);
    }
  });

  return lines.slice(0, 8);
}

function scrapeAmazon(html: string): ScrapedProduct {
  const $ = cheerio.load(html);

  const title = $('#productTitle').text().trim() || undefined;

  const wrapper = $('#imgTagWrapperId');
  const imgEl = wrapper.find('img').first();
  const rawImageUrl =
    (imgEl.attr('data-old-hires') as string | undefined) ||
    (wrapper.find('[data-old-hires]').first().attr('data-old-hires') as string | undefined) ||
    pickLargestDynamicImage(imgEl.attr('data-a-dynamic-image')) ||
    ($('#landingImage').attr('data-old-hires') as string | undefined) ||
    ($('#landingImage').attr('src') as string | undefined) ||
    (imgEl.attr('src') as string | undefined) ||
    undefined;
  // Normalize: fix protocol-relative URLs (//m.media-amazon.com/...) and reject non-HTTP values
  const image_url = normalizeHttpUrl(rawImageUrl);

  const description = $('#productDescription p').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(' ') || undefined;

  const rating = parseAmazonRating($);

  const features = $('#feature-bullets ul li span.a-list-item')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 0)
    .slice(0, 10);

  const bank_offers = scrapeAmazonBankOffers($);

  return {
    title,
    image_url,
    description,
    rating,
    features: features.length ? features : undefined,
    bank_offers: bank_offers.length ? bank_offers : undefined,
  };
}

function normalizeHttpUrl(u: string | undefined): string | undefined {
  if (!u) return undefined;
  const t = u.trim();
  if (t.startsWith('//')) return `https:${t}`;
  return /^https?:\/\//i.test(t) ? t : undefined;
}

function normalizeSchemaImage(image: unknown): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return normalizeHttpUrl(image);
  if (Array.isArray(image)) {
    for (const item of image) {
      const u = normalizeSchemaImage(item);
      if (u) return u;
    }
    return undefined;
  }
  if (typeof image === 'object') {
    const url = (image as { url?: string }).url;
    return normalizeHttpUrl(url);
  }
  return undefined;
}

function isSchemaProductType(t: unknown): boolean {
  if (t === 'Product' || t === 'http://schema.org/Product' || t === 'https://schema.org/Product') return true;
  if (typeof t !== 'string') return false;
  const s = t.trim();
  return s === 'Product' || s.toLowerCase() === 'product' || /schema\.org\/Product$/i.test(s);
}

function isSchemaProduct(o: Record<string, unknown>): boolean {
  const t = o['@type'];
  if (isSchemaProductType(t)) return true;
  if (Array.isArray(t)) return t.some((x) => isSchemaProductType(x));
  return false;
}

function productHintsFromJsonLdObject(o: Record<string, unknown>): Partial<ScrapedProduct> {
  const hint: Partial<ScrapedProduct> = {};
  if (typeof o.name === 'string' && o.name.trim()) hint.title = o.name.trim();
  if (typeof o.description === 'string' && o.description.trim()) {
    hint.description = o.description.replace(/\s+/g, ' ').trim().slice(0, 2000);
  }
  const img = normalizeSchemaImage(o.image);
  if (img) hint.image_url = img;
  const ar = o.aggregateRating as Record<string, unknown> | undefined;
  if (ar) {
    const rv = ar.ratingValue;
    if (typeof rv === 'number' && !Number.isNaN(rv)) hint.rating = rv;
    else if (typeof rv === 'string') {
      const n = parseFloat(rv);
      if (!Number.isNaN(n)) hint.rating = n;
    }
  }
  return hint;
}

function collectJsonLdProductHints(node: unknown, out: Partial<ScrapedProduct>[]): void {
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (isSchemaProduct(o)) {
    const hint = productHintsFromJsonLdObject(o);
    if (hint.title || hint.image_url || hint.rating != null || hint.description) out.push(hint);
  }
  if (Array.isArray(o['@graph'])) {
    for (const g of o['@graph']) collectJsonLdProductHints(g, out);
  }
  if (o.mainEntity) collectJsonLdProductHints(o.mainEntity, out);
}

function parseFlipkartJsonLd($: CheerioAPI): Partial<ScrapedProduct>[] {
  const hints: Partial<ScrapedProduct>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw?.trim()) return;
    try {
      collectJsonLdProductHints(JSON.parse(raw.trim()), hints);
    } catch {
      /* invalid JSON block */
    }
  });
  return hints;
}

function scrapeFlipkartOpenGraph($: CheerioAPI): Partial<ScrapedProduct> {
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const ogImage = normalizeHttpUrl($('meta[property="og:image"]').attr('content'));
  const ogDesc = $('meta[property="og:description"]').attr('content')?.replace(/\s+/g, ' ').trim();
  const twImage = normalizeHttpUrl($('meta[name="twitter:image"]').attr('content'));
  return {
    title: ogTitle,
    image_url: ogImage || twImage,
    description: ogDesc,
  };
}

function flipkartImagePixelScore(url: string): number {
  let max = 0;
  const matches = url.matchAll(/\/(\d{2,4})\/(\d{2,4})\//g);
  for (const m of matches) {
    max = Math.max(max, parseInt(m[1], 10), parseInt(m[2], 10));
  }
  return max;
}

/** Flipkart serves images from rukminim*.flixcart.com; class-based img tags break often. */
function bestRukminimImageFromHtml(html: string): string | undefined {
  const re = /https?:\/\/rukminim\d+\.flixcart\.com\/image\/[^"'\\\s<>]+/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let u = m[0].replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
    u = u.split('?')[0];
    if (/placeholder|spinner|loading|icon-?only|logo|banner|sprite/i.test(u)) continue;
    seen.add(u);
  }
  let best: string | undefined;
  let bestScore = 0;
  for (const u of seen) {
    const s = flipkartImagePixelScore(u);
    if (s >= bestScore) {
      bestScore = s;
      best = u;
    }
  }
  return best;
}

function ratingFromFlipkartRawHtml(html: string): number | undefined {
  const patterns = [
    /"ratingValue"\s*:\s*"?([\d.]+)"?/,
    /"averageRating"\s*:\s*"?([\d.]+)"?/,
    /"average"\s*:\s*([\d.]+)/,
    /"rating"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)/,
    /"value"\s*:\s*([\d.]+)[^}]*"@type"\s*:\s*"AggregateRating"/i,
    // Flipkart API response pattern: "rating":{"average":4.2,...}
    /"rating"\s*:\s*\{"average"\s*:\s*([\d.]+)/,
    // Plain numeric rating embedded in JS: rating:4.2
    /\bratings?\s*["']?\s*:\s*["']?([\d.]+)["']?/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
    }
  }
  return undefined;
}

function mergeFlipkartPartial(parts: Partial<ScrapedProduct>[]): Partial<ScrapedProduct> {
  const merged: Partial<ScrapedProduct> = {};
  let bestTitleLen = 0;
  for (const p of parts) {
    if (p.title && p.title.length >= bestTitleLen) {
      merged.title = p.title;
      bestTitleLen = p.title.length;
    }
    if (p.image_url && !merged.image_url) merged.image_url = p.image_url;
    if (p.description && !merged.description) merged.description = p.description;
    if (p.rating != null && merged.rating == null) merged.rating = p.rating;
  }
  return merged;
}

function scrapeFlipkartBankOffers($: CheerioAPI, html: string): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    const s = t.replace(/\s+/g, ' ').trim();
    if (s.length < 14 || s.length > 280 || seen.has(s)) return;
    seen.add(s);
    lines.push(s);
  };

  // Extract offer descriptions from embedded JSON (most reliable source)
  const jsonOfferRe = /"(?:offerDescription|description|title)"\s*:\s*"([^"]{14,260})"/g;
  let jm: RegExpExecArray | null;
  while ((jm = jsonOfferRe.exec(html)) !== null) {
    const t = jm[1].replace(/\\n/g, ' ').replace(/\\u[\da-f]{4}/gi, '').replace(/\s+/g, ' ').trim();
    if (/(?:bank\s+offer|no\s+cost\s+emi|instant\s+discount|flat\s+[\d₹]|extra\s+[\d₹%]|cashback|flipkart\s+axis|hdfc|icici|sbi|axis\s+bank)/i.test(t)) {
      push(t);
    }
    if (lines.length >= 8) break;
  }

  // Fallback: raw HTML text patterns
  if (lines.length < 3) {
    const offerRe =
      /(?:Bank\s+Offer|No\s+Cost\s+EMI|Flat\s+(?:₹\s*)?[\d,]+\s*(?:off|Off)|Instant\s+(?:Discount|₹\s*[\d,]+)|Extra\s+(?:₹\s*)?[\d,]+%?\s*(?:Off|off|Cashback)|Flipkart\s+Axis|HDFC\s+Bank|ICICI\s+Bank|SBI\s+Card)[^<\n]{6,160}/gi;
    let om: RegExpExecArray | null;
    while ((om = offerRe.exec(html)) !== null) push(om[0]);
  }

  // Fallback: DOM li items
  if (lines.length < 3) {
    $('li').each((i, el) => {
      if (i > 150 || lines.length >= 8) return false;
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length < 18 || t.length > 240) return;
      if (!/(?:bank|emi|discount|cashback|card|pay|instant|extra\s+off|flat\s+[\d₹])/i.test(t)) return;
      push(t);
    });
  }

  return lines.slice(0, 8);
}

/** Extract product data from Flipkart's embedded SSR JSON blobs in <script> tags */
function extractFlipkartEmbeddedJson(html: string): Partial<ScrapedProduct> {
  const out: Partial<ScrapedProduct> = {};

  // Flipkart embeds imageUrl arrays in JSON: "imageUrl":"https://rukminim..."
  const imgRe = /"imageUrl"\s*:\s*"(https?:\/\/rukminim\d*\.flixcart\.com\/[^"\\]+)"/i;
  const imgM = html.match(imgRe);
  if (imgM) out.image_url = imgM[1];

  // Title from JSON: "productTitle":"..." or "name":"..." near product context
  const titleRe = /"(?:productTitle|name)"\s*:\s*"([^"]{10,300})"/;
  const titleM = html.match(titleRe);
  if (titleM) out.title = titleM[1].replace(/\\u[\da-f]{4}/gi, '').replace(/\\n/g, ' ').trim();

  // Rating from JSON: "average":4.2 or "averageRating":4.2
  const ratingRe = /"(?:average|averageRating|ratingValue)"\s*:\s*([\d.]+)/;
  const ratingM = html.match(ratingRe);
  if (ratingM) {
    const n = parseFloat(ratingM[1]);
    if (!Number.isNaN(n) && n >= 1 && n <= 5) out.rating = n;
  }

  return out;
}

function scrapeFlipkartLegacyDom($: CheerioAPI): Partial<ScrapedProduct> {
  // Title — Flipkart class names change; try known variants in order
  const title =
    $('span.VU-ZEz').first().text().trim() ||       // 2024+ PDP title
    $('span.B_NuCI').first().text().trim() ||        // older PDP title
    $('h1._6EBuvT').first().text().trim() ||         // another 2024 variant
    $('h1.yhB1nd').first().text().trim() ||
    $('h1[class*="title"] span').first().text().trim() ||
    $('h1').first().text().trim() ||
    undefined;

  // Image — try current selectors; rukminim regex is the real fallback (handled above)
  const domImg =
    normalizeHttpUrl($('img.DByuf4').attr('src')) ||          // 2024+ main product img
    normalizeHttpUrl($('img._53J4C-').attr('src')) ||          // another 2024 variant
    normalizeHttpUrl($('img._396cs4').attr('src')) ||
    normalizeHttpUrl($('div._3kidJX img').attr('src')) ||
    normalizeHttpUrl($('img[loading="eager"]').first().attr('src')) ||
    normalizeHttpUrl($('picture source').first().attr('srcset')?.split(' ')[0]) ||
    normalizeHttpUrl($('picture img').first().attr('src'));

  const description =
    $('div._1mXcCf p').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(' ') ||
    $('div.yN+eNr p').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(' ') ||
    undefined;

  // Rating — try multiple class variants (Flipkart rotates these frequently)
  const ratingText =
    $('div.XQDdHH').first().text().trim() ||    // 2024+ rating badge
    $('span.Y1HWO0').first().text().trim() ||   // another 2024 variant
    $('div._3LWZlK').first().text().trim() ||   // older class
    $('span._2d4LTz').first().text().trim() ||
    $('div[class*="rating"] span').first().text().trim() ||
    '';
  const ratingDom = ratingText ? parseFloat(ratingText) : NaN;
  const rating = !Number.isNaN(ratingDom) && ratingDom >= 1 && ratingDom <= 5 ? ratingDom : undefined;

  return { title: title || undefined, image_url: domImg, description, rating };
}

function scrapeFlipkart(html: string): ScrapedProduct {
  const $ = cheerio.load(html);

  const jsonHints = parseFlipkartJsonLd($);
  const og = scrapeFlipkartOpenGraph($);
  const legacy = scrapeFlipkartLegacyDom($);
  const embedded = extractFlipkartEmbeddedJson(html);
  const rukminim = bestRukminimImageFromHtml(html);
  const ratingHtml = ratingFromFlipkartRawHtml(html);

  // Merge all sources; embedded JSON and JSON-LD are most reliable
  const base = mergeFlipkartPartial([...jsonHints, embedded, og, legacy]);

  // Always prefer the highest-res rukminim image found via regex scan
  if (rukminim) {
    if (!base.image_url) base.image_url = rukminim;
    else if (flipkartImagePixelScore(rukminim) > flipkartImagePixelScore(base.image_url)) {
      base.image_url = rukminim;
    }
  }
  if (base.rating == null && ratingHtml != null) base.rating = ratingHtml;

  const bank_offers = scrapeFlipkartBankOffers($, html);

  // Features — try current and legacy selectors
  const features = (
    $('ul._21Ahn- li').map((_, el) => $(el).text().trim()).get().filter(Boolean) ||
    $('div._2cM9lP li').map((_, el) => $(el).text().trim()).get().filter(Boolean) ||
    $('ul[class*="highlights"] li').map((_, el) => $(el).text().trim()).get().filter(Boolean)
  ).slice(0, 10);

  return {
    title: base.title,
    image_url: normalizeHttpUrl(base.image_url),
    description: base.description,
    rating: base.rating,
    features: features.length ? features : undefined,
    bank_offers: bank_offers.length ? bank_offers : undefined,
  };
}

export async function scrapeProduct(
  url: string,
  source: 'Amazon' | 'Flipkart'
): Promise<ScrapedProduct | null> {
  console.log(`[Scraper] Scraping ${source} page: ${url.slice(0, 80)}...`);
  const html = source === 'Flipkart' ? await fetchFlipkart(url) : await fetchWithRetry(url);
  if (!html) {
    console.log(`[Scraper] Failed to fetch page`);
    return null;
  }

  const result = source === 'Amazon' ? scrapeAmazon(html) : scrapeFlipkart(html);
  console.log(
    `[Scraper] title="${result.title?.slice(0, 50)}" image=${!!result.image_url} rating=${result.rating} bankOffers=${result.bank_offers?.length ?? 0}`
  );
  return result;
}
