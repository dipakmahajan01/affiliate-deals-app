import axios from 'axios';
import type { DealSource } from '@deals/types';
import { AffiliateConfig } from '../models/AffiliateConfig';

/** Follow redirects to get the final URL (resolves amzn.to, myntr.in, etc.) */
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

/** Strip zero-width / BOM characters that sometimes appear in copied Telegram URLs */
function sanitizeUrlString(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

/** Append tracking query string to a URL (suffix without leading `?`) */
export function appendQuerySuffix(url: string, suffix: string): string {
  const part = sanitizeUrlString(suffix).replace(/^\?/, '');
  if (!part) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}${part}`;
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

/** Detect source platform from URL (resolved or short) */
export function detectSource(url: string): DealSource | null {
  const u = url.toLowerCase();
  if (u.includes('amazon') || u.includes('amzn')) return 'Amazon';
  if (u.includes('flipkart')) return 'Flipkart';
  if (u.includes('myntra') || u.includes('myntr.in')) return 'Myntra';
  return null;
}

function isMyntraShortAffiliateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'myntr.in' || h.endsWith('.myntr.in');
}

/** Build affiliate URL from a resolved product URL */
export async function buildAffiliateUrl(
  resolvedUrl: string,
  originalUrl?: string | null
): Promise<string | null> {
  const config = await AffiliateConfig.findOne().sort({ createdAt: -1 });
  const amazonTag = config?.amazon_tag ?? process.env.AMAZON_AFFILIATE_TAG ?? '';
  const flipkartAffid = config?.flipkart_affid ?? process.env.FLIPKART_AFFILIATE_ID ?? '';
  const myntraSuffix =
    config?.myntra_affiliate_suffix ?? process.env.MYNTRA_AFFILIATE_SUFFIX ?? '';

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

  if (source === 'Myntra') {
    const suffix = String(myntraSuffix).trim();
    if (suffix) {
      try {
        const canonical = new URL(resolvedUrl);
        const host = canonical.hostname.toLowerCase();
        if (!host.includes('myntra.')) return null;
        return appendQuerySuffix(canonical.toString(), suffix);
      } catch {
        return null;
      }
    }
    const cleanedOriginal = originalUrl ? sanitizeUrlString(originalUrl) : '';
    if (cleanedOriginal) {
      try {
        const orig = new URL(cleanedOriginal);
        if (isMyntraShortAffiliateHost(orig.hostname)) return cleanedOriginal;
      } catch {
        /* ignore */
      }
    }
    try {
      const r = new URL(resolvedUrl);
      const host = r.hostname.toLowerCase();
      if (host.includes('myntra.') || isMyntraShortAffiliateHost(host)) return resolvedUrl;
    } catch {
      return null;
    }
    return null;
  }

  return null;
}
