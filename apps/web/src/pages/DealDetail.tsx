import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Deal } from '@deals/types';
import { api, trackClickAndRedirect } from '../api/client';

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: deal, isLoading } = useQuery<Deal>({
    queryKey: ['deal', id],
    queryFn: () => api.get(`/deals/${id}`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-card animate-pulse overflow-hidden">
        <div className="h-72 bg-slate-100" />
        <div className="p-6 flex flex-col gap-4">
          <div className="h-4 bg-slate-100 rounded-full w-4/5" />
          <div className="h-4 bg-slate-100 rounded-full w-3/5" />
          <div className="h-8 bg-slate-100 rounded-full w-2/5" />
          <div className="h-12 bg-slate-100 rounded-xl mt-4" />
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-4">Deal not found.</p>
        <Link to="/" className="text-brand font-semibold hover:underline">← Back to deals</Link>
      </div>
    );
  }

  const discount =
    deal.discount_percent ??
    (deal.original_price && deal.original_price > deal.price
      ? Math.round(((deal.original_price - deal.price) / deal.original_price) * 100)
      : null);

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand mb-4 transition">
        ← Back to deals
      </Link>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        {/* Product image */}
        {deal.image_url ? (
          <div className="relative bg-slate-50">
            <img
              src={deal.image_url}
              alt={deal.product_title}
              className="w-full h-72 object-contain p-6"
            />
            {discount != null && discount > 0 && (
              <span className="absolute top-3 right-3 bg-green-500 text-white text-sm font-bold px-3 py-1 rounded-full shadow">
                -{discount}% OFF
              </span>
            )}
          </div>
        ) : null}

        <div className="p-6 flex flex-col gap-4">
          <h1 className="font-bold text-lg leading-snug text-slate-900">{deal.product_title}</h1>

          {deal.rating != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">★</span>
              <span className="text-sm font-semibold text-slate-700">{deal.rating.toFixed(1)}</span>
              <span className="text-sm text-slate-400">/ 5</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-brand font-black text-3xl">₹{deal.price.toLocaleString('en-IN')}</span>
            {deal.original_price && (
              <span className="text-slate-400 text-base line-through">
                ₹{deal.original_price.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Coupon */}
          {deal.coupon_text && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2">
              <span>🏷</span>
              <span>{deal.coupon_text}</span>
            </div>
          )}

          {/* Bank offers */}
          {deal.bank_offers && deal.bank_offers.length > 0 && (
            <div className="border border-emerald-100 bg-emerald-50 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-emerald-800 mb-2 uppercase tracking-wide">Bank Offers</p>
              <ul className="text-sm text-emerald-900 space-y-1.5 list-disc list-inside">
                {deal.bank_offers.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{deal.source}</span>
            {deal.category && <><span>·</span><span>{deal.category}</span></>}
            <span>·</span>
            <span>{deal.clicks} clicks</span>
          </div>

          <button
            onClick={() => trackClickAndRedirect(deal._id, deal.item_type === 'product' ? 'products' : 'deals')}
            className="w-full bg-brand hover:bg-brand-600 text-white font-bold py-4 rounded-xl transition text-base shadow-sm"
          >
            Buy Now on {deal.source}
          </button>
        </div>
      </div>
    </div>
  );
}
