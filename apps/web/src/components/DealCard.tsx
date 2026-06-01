import { useState } from 'react';
import type { Deal } from '@deals/types';
import { useDealClick } from '../hooks/useDealClick';
import CompareModal from './CompareModal';

interface Props {
  deal: Deal;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-3 h-3 ${s <= full ? 'text-amber-400' : 'text-slate-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-[11px] text-slate-500 ml-1 font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    Amazon: 'bg-orange-100 text-orange-700 border-orange-200',
    Flipkart: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const cls = styles[source] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {source}
    </span>
  );
}

export default function DealCard({ deal }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const handleDealClick = useDealClick();

  async function handleBuy() {
    await handleDealClick(deal._id, deal.item_type === 'product' ? 'products' : 'deals');
  }

  const discount =
    deal.discount_percent ??
    (deal.original_price && deal.original_price > deal.price
      ? Math.round(((deal.original_price - deal.price) / deal.original_price) * 100)
      : null);

  const savings =
    deal.original_price && deal.original_price > deal.price
      ? deal.original_price - deal.price
      : null;

  const isHotDeal = discount != null && discount >= 40;

  const priceDrop =
    deal.previous_price && deal.previous_price > deal.price
      ? deal.price_drop_percent ??
        Math.round(((deal.previous_price - deal.price) / deal.previous_price) * 100)
      : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200 group">

      {/* ── Image section ─────────────────────────────── */}
      <div className="relative bg-gradient-to-b from-slate-50 to-white">
        {/* Discount badge — top left */}
        {discount != null && discount > 0 && (
          <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
            <span className={`text-white text-[11px] font-black px-2 py-0.5 rounded-lg shadow-sm ${isHotDeal ? 'bg-red-500' : 'bg-green-600'}`}>
              {discount}% OFF
            </span>
            {isHotDeal && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                🔥 Hot Deal
              </span>
            )}
          </div>
        )}

        {/* Source badge — top right */}
        <div className="absolute top-2 right-2 z-10">
          <SourceBadge source={deal.source} />
        </div>

        {deal.image_url && !imgFailed ? (
          <img
            src={deal.image_url}
            alt={deal.product_title}
            className="w-full h-48 object-contain p-4"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-48 flex flex-col items-center justify-center text-slate-300 gap-1">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px]">No image</span>
          </div>
        )}
      </div>

      {/* ── Card body ─────────────────────────────────── */}
      <div className="p-3 flex flex-col gap-2 flex-1">

        {/* Title */}
        <p className="text-[13px] font-semibold line-clamp-2 leading-snug text-slate-800">
          {deal.product_title}
        </p>

        {/* Rating */}
        {deal.rating != null && <StarRating rating={deal.rating} />}

        {/* Price block */}
        <div className="flex flex-col gap-0.5 mt-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-brand font-black text-xl leading-none">
              ₹{deal.price.toLocaleString('en-IN')}
            </span>
            {deal.original_price && (
              <span className="text-slate-400 text-xs line-through">
                ₹{deal.original_price.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {savings != null && savings > 0 && (
            <span className="text-green-600 text-[11px] font-bold">
              You save ₹{savings.toLocaleString('en-IN')}!
            </span>
          )}
        </div>

        {/* Price drop */}
        {priceDrop != null && priceDrop > 0 && (
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-[11px] font-semibold px-2 py-1.5 rounded-lg">
            <span className="shrink-0">📉</span>
            <span className="line-clamp-1">
              Price dropped {priceDrop}%
              {deal.previous_price && (
                <span className="font-normal text-green-600"> · was ₹{deal.previous_price.toLocaleString('en-IN')}</span>
              )}
            </span>
          </div>
        )}

        {/* Coupon */}
        {deal.coupon_text && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-dashed border-amber-300 text-amber-700 text-[11px] font-medium px-2 py-1.5 rounded-lg">
            <span className="shrink-0">🏷</span>
            <span className="line-clamp-1">{deal.coupon_text}</span>
          </div>
        )}

        {/* Bank offer */}
        {deal.bank_offers && deal.bank_offers.length > 0 && (
          <div className="flex items-start gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] px-2 py-1.5 rounded-lg">
            <span className="shrink-0">🏦</span>
            <span className="line-clamp-2 leading-snug">{deal.bank_offers[0]}</span>
          </div>
        )}

        {/* Category */}
        {deal.category && (
          <span className="text-[11px] text-slate-400">{deal.category}</span>
        )}

        {/* CTA button */}
        <button
          onClick={handleBuy}
          className="mt-auto w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] text-white font-bold text-sm py-3 rounded-xl transition-all duration-150 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Get This Deal
        </button>

        {/* Compare prices */}
        <button
          onClick={() => setShowCompare(true)}
          className="w-full text-[12px] font-semibold text-slate-500 hover:text-brand py-1.5 flex items-center justify-center gap-1 transition"
        >
          ⚖️ Compare prices
        </button>
      </div>

      {showCompare && (
        <CompareModal
          title={deal.product_title}
          category={deal.category}
          currentId={deal._id}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}
