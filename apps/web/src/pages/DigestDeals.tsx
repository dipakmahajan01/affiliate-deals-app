import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Deal, PaginatedResponse } from '@deals/types';
import { api } from '../api/client';
import DealCard from '../components/DealCard';
import DealSkeleton from '../components/DealSkeleton';

export default function DigestDeals() {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get('ids') ?? '';

  const { data, isLoading } = useQuery<Pick<PaginatedResponse<Deal>, 'data'>>({
    queryKey: ['digest-deals', ids],
    queryFn: () => api.get('/products/by-ids', { params: { ids } }).then((r) => r.data),
    enabled: !!ids,
  });

  const deals = data?.data ?? [];

  return (
    <div>
      <div className="bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl px-6 py-8 mb-6 text-center text-white">
        <h1 className="text-2xl font-black mb-1">
          Deal<span className="text-orange-200">Dost</span> Picks
        </h1>
        <p className="text-orange-100 text-sm">Today's top price drops, handpicked just for you 🔥</p>
      </div>

      {!ids || (!isLoading && deals.length === 0) ? (
        <div className="text-center py-16">
          <p className="text-slate-500 mb-4">These deals are no longer available.</p>
          <Link to="/" className="text-brand font-semibold hover:underline">← Browse more deals</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <DealSkeleton key={i} />)
            : deals.map((deal) => <DealCard key={deal._id} deal={deal} />)}
        </div>
      )}
    </div>
  );
}
