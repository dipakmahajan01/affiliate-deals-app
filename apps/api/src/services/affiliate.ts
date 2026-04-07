import axios from 'axios';
import { AffiliateConfig } from '../models/AffiliateConfig';

/** Follow redirects to get the final URL (resolves amzn.to, etc.) */
export async function resolveShortUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      timeout: 8000,
      validateStatus: () => true,
    });
    return response.request?.res?.responseUrl ?? url;
  } catch {
    return url;
  }
}

/** Extract Amazon ASIN from a full amazon.in URL */
export function extractAsin(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return match ? match[1] : null;
}

/** Extract Flipkart product path (everything after flipkart.com) */
export function extractFlipkartPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('flipkart.com')) return null;
    return parsed.pathname + parsed.search;
  } catch {
    return null;
  }
}

/** Detect source platform from URL */
export function detectSource(url: string): 'Amazon' | 'Flipkart' | null {
  if (url.includes('amazon') || url.includes('amzn')) return 'Amazon';
  if (url.includes('flipkart')) return 'Flipkart';
  return null;
}

/** Build affiliate URL from a resolved product URL */
export async function buildAffiliateUrl(resolvedUrl: string): Promise<string | null> {
  const config = await AffiliateConfig.findOne().sort({ createdAt: -1 });
  const amazonTag = config?.amazon_tag ?? process.env.AMAZON_AFFILIATE_TAG ?? '';
  const flipkartAffid = config?.flipkart_affid ?? process.env.FLIPKART_AFFILIATE_ID ?? '';

  const source = detectSource(resolvedUrl);

  if (source === 'Amazon') {
    const asin = extractAsin(resolvedUrl);
    if (!asin) return null;
    return `https://www.amazon.in/dp/${asin}?tag=${amazonTag}`;
  }

  if (source === 'Flipkart') {
    const path = extractFlipkartPath(resolvedUrl);
    if (!path) return null;
    const separator = path.includes('?') ? '&' : '?';
    return `https://www.flipkart.com${path}${separator}affid=${flipkartAffid}`;
  }

  return null;
}
