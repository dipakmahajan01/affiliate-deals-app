import { useQuery } from '@tanstack/react-query';
import type { Deal } from '@deals/types';
import { api } from '../api/client';
import DealCard from '../components/DealCard';
import DealSkeleton from '../components/DealSkeleton';
import Seo from '../components/Seo';

export default function Trending() {
  const { data, isLoading } = useQuery<Deal[]>({
    queryKey: ['feed', 'trending'],
    queryFn: () => api.get('/feed/trending').then((r) => r.data.data),
  });

  return (
    <div>
      <Seo
        title="Trending Deals Today"
        description="The most popular Amazon & Flipkart deals right now, ranked by clicks and engagement on DealDost."
        path="/trending"
      />
      <h1 className="text-xl font-black text-slate-800 mb-4">🔥 Trending Today</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <DealSkeleton key={i} />)
          : (data ?? []).map((deal) => <DealCard key={deal._id} deal={deal} />)}
      </div>
    </div>
  );
}
