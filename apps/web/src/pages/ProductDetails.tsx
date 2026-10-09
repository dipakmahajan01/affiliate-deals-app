import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Deal, Product } from '@deals/types';
import { api } from '../api/client';
import DealCard from '../components/DealCard';
import DealSkeleton from '../components/DealSkeleton';
import Seo, { SITE_URL, SITE_NAME } from '../components/Seo';
import { getProductIdFromSlug, getProductPath } from '../utils/productSlug';
import { useDealClick } from '../hooks/useDealClick';

type DetailItem = Deal | Product;

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

async function fetchDetailItem(id: string): Promise<DetailItem> {
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
  const savings =
    deal?.original_price && deal.original_price > deal.price ? deal.original_price - deal.price : null;

  const seoDescription = useMemo(() => {
    if (!deal) return 'View this latest deal on DealDost and grab the live offer before it expires.';
    const parts = [
      `${deal.product_title} deal on ${deal.source}`,
      `now at ${formatPrice(deal.price)}`,
      discount ? `${discount}% off` : null,
      deal.coupon_text,
    ].filter(Boolean);
    return `${parts.join(' - ')}.`;
  }, [deal, discount]);

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
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: deal.product_title,
    image: deal.image_url ? [deal.image_url] : undefined,
    category: deal.category,
    brand: { '@type': 'Brand', name: deal.source },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${canonicalPath}`,
      priceCurrency: 'INR',
      price: deal.price,
      availability: deal.is_active ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: deal.source },
    },
  };

  return (
    <div>
      <Seo
        title={`${deal.product_title} Deal`}
        description={seoDescription}
        path={canonicalPath}
        image={deal.image_url}
        jsonLd={productJsonLd}
      />

      <Link to="/" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-orange-600 mb-4">
        ← Back to latest deals
      </Link>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="relative bg-gradient-to-b from-slate-50 to-white min-h-[320px] flex items-center justify-center">
            {discount != null && discount > 0 && (
              <span className="absolute top-4 left-4 bg-red-500 text-white text-sm font-black px-3 py-1 rounded-xl shadow-sm">
                {discount}% OFF
              </span>
            )}
            {deal.image_url && !imgFailed ? (
              <img
                src={deal.image_url}
                alt={deal.product_title}
                className="w-full max-h-[460px] object-contain p-6"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-300 gap-2">
                <span className="text-5xl">□</span>
                <span className="text-sm">No image available</span>
              </div>
            )}
          </div>
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
            {deal.coupon_text && (
              <div className="border border-dashed border-amber-300 bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-sm font-semibold">
                {deal.coupon_text}
              </div>
            )}
            {deal.bank_offers?.slice(0, 2).map((offer) => (
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
