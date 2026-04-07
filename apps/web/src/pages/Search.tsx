import { useSearchParams } from 'react-router-dom';
import { useInfiniteDeals, fetchFeedSearch } from '../hooks/useInfiniteDeals';
import InfiniteDealGrid from '../components/InfiniteDealGrid';

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteDeals(
    ['feed', 'search', q],
    (page) => fetchFeedSearch(q, page)
  );

  return (
    <div>
      <h1 className="text-xl font-black text-slate-800 mb-4">Results for &ldquo;{q}&rdquo;</h1>
      <InfiniteDealGrid
        data={data}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={!!hasNextPage}
        fetchNextPage={fetchNextPage}
      />
    </div>
  );
}
