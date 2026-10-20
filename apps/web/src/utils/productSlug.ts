import type { Deal } from '@deals/types';

const MONGO_ID_AT_END = /-([a-f0-9]{24})$/i;

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'deal';
}

export function getProductPath(deal: Pick<Deal, '_id' | 'product_title'>): string {
  return `/product/${slugifyTitle(deal.product_title)}-${deal._id}`;
}

export function getProductIdFromSlug(slug: string | undefined): string | null {
  if (!slug) return null;
  const mongoMatch = slug.match(MONGO_ID_AT_END);
  if (mongoMatch?.[1]) return mongoMatch[1];
  const parts = slug.split('-').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}
