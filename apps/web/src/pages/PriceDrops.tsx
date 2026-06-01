import { useInfiniteDeals, fetchPriceDrops } from '../hooks/useInfiniteDeals';
import InfiniteDealGrid from '../components/InfiniteDealGrid';

export default function PriceDrops() {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteDeals(
    ['feed', 'price-drops'],
    fetchPriceDrops
  );

  const isEmpty = !isLoading && (data?.pages[0]?.data.length ?? 0) === 0;

  return (
    <div>
      <h1 className="text-xl font-black text-slate-800 mb-1">📉 Price Drops</h1>
      <p className="text-sm text-slate-500 mb-4">Products that just got cheaper — grab them before prices bounce back.</p>
      {isEmpty ? (
        <p className="text-center text-sm text-slate-400 py-12">No recent price drops right now. Check back soon!</p>
      ) : (
        <InfiniteDealGrid
          data={data}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={!!hasNextPage}
          fetchNextPage={fetchNextPage}
        />
      )}
    </div>
  );
}
