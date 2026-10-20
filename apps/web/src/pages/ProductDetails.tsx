import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Deal, Product } from '@deals/types';
import { api } from '../api/client';
import DealCard from '../components/DealCard';
import DealSkeleton from '../components/DealSkeleton';
import Seo, { SITE_URL, SITE_NAME } from '../components/Seo';
import { getProductIdFromSlug, getProductPath } from '../utils/productSlug';
import { useDealClick } from '../hooks/useDealClick';
import { cleanDisplayText, cleanOfferList } from '../utils/displayText';

type DetailItem = Deal | Product;
type FullDetailItem = DetailItem & {
  review_count?: number;
  brand?: string;
  availability?: string;
  asin?: string;
  product_details?: Record<string, string>;
  breadcrumbs?: string[];
  images?: string[];
  description?: string;
  features?: string[];
};

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

function getDiscount(deal: DetailItem): number | null {
  if (deal.discount_percent != null) return deal.discount_percent;
  if (deal.original_price && deal.original_price > deal.price) {
    return Math.round(((deal.original_price - deal.price) / deal.original_price) * 100);
  }
  return null;
}

function uniqueImages(deal: FullDetailItem | undefined): string[] {
  if (!deal) return [];
  return Array.from(new Set([deal.image_url, ...(deal.images ?? [])].filter(Boolean) as string[]));
}

function isUsefulText(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== 'na' && normalized !== 'n/a';
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}

function getAvailabilitySchema(deal: FullDetailItem): string {
  const text = deal.availability?.toLowerCase() ?? '';
  if (!deal.is_active || text.includes('unavailable') || text.includes('out of stock')) {
    return 'https://schema.org/OutOfStock';
  }
  if (text.includes('limited') || text.includes('left in stock')) {
    return 'https://schema.org/LimitedAvailability';
  }
  return 'https://schema.org/InStock';
}

function getSeoKeywords(deal: FullDetailItem): string[] {
  return Array.from(
    new Set(
      [
        deal.product_title,
        deal.brand,
        deal.asin,
        deal.category,
        deal.source,
        'Dealdost',
        'Amazon deal',
        'best online shopping deals',
        'coupons India',
      ].filter(isUsefulText)
    )
  );
}

function buildSpecificationRows(deal: FullDetailItem): [string, string][] {
  const rows: [string, string][] = [];
  const seen = new Set<string>();

  const add = (label: string, value: unknown) => {
    if (value == null) return;
    const text =
      typeof value === 'number'
        ? value.toLocaleString('en-IN')
        : value instanceof Date
          ? value.toLocaleString('en-IN')
          : String(value).trim();
    if (!isUsefulText(text)) return;

    const normalized = label.trim().toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    rows.push([label, text]);
  };

  add('Brand', deal.brand);
  add('ASIN', deal.asin);
  add('Source', deal.source);
  add('Category', deal.category);
  add('Availability', deal.availability);
  add('Current price', formatPrice(deal.price));
  add('Original price', deal.original_price ? formatPrice(deal.original_price) : undefined);
  add('Discount', getDiscount(deal) != null ? `${getDiscount(deal)}%` : undefined);
  add('Rating', deal.rating != null ? `${deal.rating.toFixed(1)} / 5` : undefined);
  add('Review count', deal.review_count);
  add('Posted at', deal.posted_at ? new Date(deal.posted_at).toLocaleString('en-IN') : undefined);

  for (const [label, value] of Object.entries(deal.product_details ?? {})) {
    add(label, value);
  }

  return rows;
}

async function fetchDetailItem(id: string): Promise<FullDetailItem> {
  try {
    const { data } = await api.get<Product>(`/products/${id}`);
    return { ...data, item_type: 'product' };
  } catch {
    const { data } = await api.get<Deal>(`/deals/${id}`);
    return { ...data, item_type: 'deal' };
  }
}

async function fetchRelatedDeals(deal: DetailItem): Promise<Deal[]> {
  const category = deal.category ? encodeURIComponent(deal.category) : '';
  const endpoint = category ? `/feed/category/${category}?page=1&limit=8` : '/feed?page=1&limit=8';
  const { data } = await api.get(endpoint);
  return (data.data as Deal[]).filter((item) => item._id !== deal._id).slice(0, 4);
}

export default function ProductDetails() {
  const { slug } = useParams();
  const id = getProductIdFromSlug(slug);
  const [imgFailed, setImgFailed] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const handleDealClick = useDealClick();

  const {
    data: deal,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['product-detail', id],
    queryFn: () => fetchDetailItem(id as string),
    enabled: !!id,
    retry: 1,
  });

  const { data: related = [], isLoading: isRelatedLoading } = useQuery({
    queryKey: ['product-related', deal?._id, deal?.category],
    queryFn: () => fetchRelatedDeals(deal as DetailItem),
    enabled: !!deal,
  });

  const discount = deal ? getDiscount(deal) : null;
  const galleryImages = uniqueImages(deal);
  const heroImage = selectedImage || galleryImages[0];
  const productDetails = deal ? buildSpecificationRows(deal) : [];
  const couponText = cleanDisplayText(deal?.coupon_text);
  const bankOffers = cleanOfferList(deal?.bank_offers);
  const savings =
    deal?.original_price && deal.original_price > deal.price ? deal.original_price - deal.price : null;

  async function handleGetDeal() {
    if (!deal) return;
    await handleDealClick(deal._id, deal.item_type === 'product' ? 'products' : 'deals');
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: deal?.product_title ?? SITE_NAME, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  if (isLoading) {
    return (
      <div>
        <Seo title="Loading Deal" path={slug ? `/product/${slug}` : '/product'} noindex />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6">
          <div className="h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          <DealSkeleton />
        </div>
      </div>
    );
  }

  if (!id || isError || !deal) {
    return (
      <div>
        <Seo title="Deal Not Found" path={slug ? `/product/${slug}` : '/product'} noindex />
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-black text-slate-800 mb-2">Deal not found</h1>
          <p className="text-slate-500 mb-6">
            This offer may have expired or moved. Browse the latest active deals instead.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-3 rounded-xl transition"
          >
            View latest deals
          </Link>
        </div>
      </div>
    );
  }

  const canonicalPath = getProductPath(deal);
  const seoTitle = truncateText(
    `${deal.product_title} Deal${deal.price ? ` at ${formatPrice(deal.price)}` : ''}`,
    68
  );
  const seoDescription = truncateText(
    [
      `${deal.product_title} available on ${deal.source}`,
      `for ${formatPrice(deal.price)}`,
      deal.original_price ? `MRP ${formatPrice(deal.original_price)}` : null,
      discount ? `${discount}% off` : null,
      deal.brand ? `Brand: ${deal.brand}` : null,
      deal.availability,
      'View images, specifications and offer details on DealDost.',
    ]
      .filter(Boolean)
      .join('. '),
    158
  );
  const seoKeywords = getSeoKeywords(deal);
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: deal.product_title,
    image: galleryImages.length ? galleryImages : undefined,
    description: seoDescription,
    sku: deal.asin ?? deal._id,
    mpn: deal.asin,
    category: deal.category,
    brand: { '@type': 'Brand', name: deal.brand ?? deal.source },
    aggregateRating:
      deal.rating != null
        ? {
            '@type': 'AggregateRating',
            ratingValue: deal.rating,
            reviewCount: deal.review_count ?? 1,
          }
        : undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${canonicalPath}`,
      priceCurrency: 'INR',
      price: deal.price,
      availability: getAvailabilitySchema(deal),
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: deal.source },
    },
  };

  return (
    <div>
      <Seo
        title={seoTitle}
        description={seoDescription}
        path={canonicalPath}
        image={heroImage}
        type="product"
        keywords={seoKeywords}
        jsonLd={productJsonLd}
      />

      <Link to="/" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-orange-600 mb-4">
        ← Back to latest deals
      </Link>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="relative bg-gradient-to-b from-slate-50 to-white min-h-[360px] md:min-h-[560px] flex items-center justify-center">
            {discount != null && discount > 0 && (
              <span className="absolute top-4 left-4 bg-red-500 text-white text-sm font-black px-3 py-1 rounded-xl shadow-sm">
                {discount}% OFF
              </span>
            )}
            {heroImage && !imgFailed ? (
              <img
                src={heroImage}
                alt={deal.product_title}
                className="w-full max-h-[560px] object-contain p-5 md:p-8"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-300 gap-2">
                <span className="text-5xl">□</span>
                <span className="text-sm">No image available</span>
              </div>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3 border-t border-slate-100">
              {galleryImages.map((img, index) => (
                <button
                  key={`${img}-${index}`}
                  onClick={() => {
                    setImgFailed(false);
                    setSelectedImage(img);
                  }}
                  className={`h-16 w-16 shrink-0 rounded-lg border bg-white p-1 transition ${
                    heroImage === img ? 'border-orange-500 ring-2 ring-orange-100' : 'border-slate-200 hover:border-orange-300'
                  }`}
                  aria-label={`View product image ${index + 1}`}
                >
                  <img src={img} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="bg-white rounded-2xl border border-slate-100 p-5 shadow-card">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-black uppercase tracking-wide text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
              {deal.source}
            </span>
            {deal.category && <span className="text-xs text-slate-400">{deal.category}</span>}
          </div>

          <h1 className="text-2xl font-black leading-tight text-slate-900 mb-4">
            {deal.product_title}
          </h1>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            {deal.brand && (
              <div>
                <p className="text-slate-400">Brand</p>
                <p className="font-bold text-slate-700">{deal.brand}</p>
              </div>
            )}
            {deal.asin && (
              <div>
                <p className="text-slate-400">ASIN</p>
                <p className="font-bold text-slate-700">{deal.asin}</p>
              </div>
            )}
            {deal.rating != null && (
              <div>
                <p className="text-slate-400">Rating</p>
                <p className="font-bold text-slate-700">
                  {deal.rating.toFixed(1)} / 5
                  {deal.review_count != null && (
                    <span className="font-medium text-slate-400"> ({deal.review_count.toLocaleString('en-IN')})</span>
                  )}
                </p>
              </div>
            )}
            {deal.rating == null && (
              <div>
                <p className="text-slate-400">Rating</p>
                <p className="font-bold text-slate-500">Not available</p>
              </div>
            )}
            {deal.availability && (
              <div>
                <p className="text-slate-400">Availability</p>
                <p className="font-bold text-green-600">{deal.availability}</p>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-black text-orange-600">{formatPrice(deal.price)}</span>
            {deal.original_price && (
              <span className="text-sm text-slate-400 line-through mb-1">
                {formatPrice(deal.original_price)}
              </span>
            )}
          </div>

          {savings != null && savings > 0 && (
            <p className="text-sm font-bold text-green-600 mb-4">
              You save {formatPrice(savings)}
            </p>
          )}

          <div className="space-y-2 mb-5">
            {couponText && (
              <div className="border border-dashed border-amber-300 bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-sm font-semibold">
                {couponText}
              </div>
            )}
            {bankOffers.slice(0, 3).map((offer) => (
              <div key={offer} className="border border-emerald-100 bg-emerald-50 text-emerald-700 rounded-xl px-3 py-2 text-sm">
                {offer}
              </div>
            ))}
          </div>

          <button
            onClick={handleGetDeal}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.99] text-white font-black py-3.5 rounded-xl transition shadow-sm hover:shadow-md"
          >
            Get Deal
          </button>

          <button
            onClick={handleShare}
            className="mt-3 w-full border border-slate-200 hover:border-orange-200 hover:text-orange-600 text-slate-600 font-bold py-3 rounded-xl transition"
          >
            Share deal
          </button>

          <dl className="grid grid-cols-2 gap-3 mt-5 text-sm">
            <div>
              <dt className="text-slate-400">Views</dt>
              <dd className="font-bold text-slate-700">{deal.views.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Clicks</dt>
              <dd className="font-bold text-slate-700">{deal.clicks.toLocaleString('en-IN')}</dd>
            </div>
            {deal.posted_at && (
              <div className="col-span-2">
                <dt className="text-slate-400">Posted</dt>
                <dd className="font-bold text-slate-700">
                  {new Date(deal.posted_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>

      {(isUsefulText(deal.description) || deal.features?.length || productDetails.length > 0 || deal.breadcrumbs?.length) && (
        <section className="mt-8 bg-white border border-slate-100 rounded-2xl p-5">
          <h2 className="text-lg font-black text-slate-800 mb-4">All specifications</h2>

          {deal.breadcrumbs && deal.breadcrumbs.length > 0 && (
            <p className="text-sm text-slate-500 mb-4">{deal.breadcrumbs.join(' / ')}</p>
          )}

          {isUsefulText(deal.description) && <p className="text-sm leading-6 text-slate-600 mb-5">{deal.description}</p>}

          {deal.features && deal.features.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-black text-slate-700 mb-2">Key features</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                {deal.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          )}

          {productDetails.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-slate-700 mb-3">Product specs</h3>
              <div className="overflow-hidden rounded-xl border border-slate-100">
              {productDetails.map(([label, value]) => (
                <div key={label} className="grid sm:grid-cols-[240px_minmax(0,1fr)] border-b border-slate-100 last:border-b-0 text-sm">
                  <div className="bg-slate-50 px-3 py-2 font-bold text-slate-700">{label}</div>
                  <div className="px-3 py-2 text-slate-600 break-words">{value}</div>
                </div>
              ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-800">Related deals</h2>
          <Link to="/" className="text-sm font-bold text-orange-600 hover:text-orange-700">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {isRelatedLoading
            ? Array.from({ length: 4 }).map((_, i) => <DealSkeleton key={i} />)
            : related.map((item) => <DealCard key={item._id} deal={item} />)}
        </div>
      </section>
    </div>
  );
}
