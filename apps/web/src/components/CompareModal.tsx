import { useQuery } from '@tanstack/react-query';
import type { Deal } from '@deals/types';
import { api } from '../api/client';
import { useDealClick } from '../hooks/useDealClick';

type Offer = Deal & { is_lowest?: boolean };

interface Props {
  title: string;
  category?: string;
  currentId: string;
  onClose: () => void;
}

const SOURCE_STYLES: Record<string, string> = {
  Amazon: 'bg-orange-100 text-orange-700',
  Flipkart: 'bg-blue-100 text-blue-700',
  Myntra: 'bg-pink-100 text-pink-700',
};

export default function CompareModal({ title, category, currentId, onClose }: Props) {
  const handleDealClick = useDealClick();
  const { data, isLoading } = useQuery<Offer[]>({
    queryKey: ['compare', title, category],
    queryFn: () =>
      api
        .get(`/feed/compare?q=${encodeURIComponent(title)}${category ? `&category=${encodeURIComponent(category)}` : ''}`)
        .then((r) => r.data.offers),
  });

  const offers = data ?? [];
  const hasComparison = offers.some((o) => o._id !== currentId);
  const prices = offers.map((o) => o.price);
  const maxSaving = offers.length > 1 ? Math.max(...prices) - Math.min(...prices) : 0;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">⚖️ Compare prices</h2>
            {maxSaving > 0 && (
              <p className="text-xs text-green-600 font-semibold mt-0.5">
                Save up to ₹{maxSaving.toLocaleString('en-IN')} by picking the cheapest
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 -mr-1 rounded-lg hover:bg-slate-100 transition shrink-0">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Offers */}
        <div className="overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))
          ) : !hasComparison ? (
            <p className="text-center text-sm text-slate-400 py-10">
              No other listings to compare right now — this is the only one we have.
            </p>
          ) : (
            offers.map((o) => {
              const drop =
                o.previous_price && o.previous_price > o.price
                  ? o.price_drop_percent ?? Math.round(((o.previous_price - o.price) / o.previous_price) * 100)
                  : null;
              return (
                <div
                  key={o._id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                    o.is_lowest ? 'border-green-300 bg-green-50' : 'border-slate-100'
                  }`}
                >
                  {o.image_url && (
                    <img src={o.image_url} alt="" className="w-14 h-14 object-contain rounded-lg bg-white shrink-0" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SOURCE_STYLES[o.source] ?? 'bg-slate-100 text-slate-600'}`}>
                        {o.source}
                      </span>
                      {o.is_lowest && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-600 text-white">Lowest price</span>
                      )}
                      {o._id === currentId && <span className="text-[10px] text-slate-400">· viewing</span>}
                    </div>
                    <p className="text-[12px] text-slate-700 line-clamp-1 mt-1">{o.product_title}</p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="font-black text-slate-900">₹{o.price.toLocaleString('en-IN')}</span>
                      {o.original_price && o.original_price > o.price && (
                        <span className="text-[11px] text-slate-400 line-through">₹{o.original_price.toLocaleString('en-IN')}</span>
                      )}
                      {o.rating != null && <span className="text-[11px] text-amber-500">★{o.rating.toFixed(1)}</span>}
                      {drop != null && drop > 0 && (
                        <span className="text-[10px] font-semibold text-green-700">📉 {drop}%</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDealClick(o._id, o.item_type === 'product' ? 'products' : 'deals')}
                    className="shrink-0 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-lg transition"
                  >
                    Buy
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
