import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useInfiniteDeals, fetchFeedSearch } from '../hooks/useInfiniteDeals';
import InfiniteDealGrid from '../components/InfiniteDealGrid';
import Seo from '../components/Seo';

// Module-level flag — only fires on the FIRST mount after document load.
// Subsequent in-app searches won't trigger the redirect.
let didCheckReload = false;

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') ?? '';

  // Clear search only when the document itself was reloaded on /search?q=...
  useEffect(() => {
    if (didCheckReload) return;
    didCheckReload = true;

    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries[0]?.type === 'reload') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteDeals(
    ['feed', 'search', q],
    (page) => fetchFeedSearch(q, page)
  );

  return (
    <div>
      <Seo title={`Search results for "${q}"`} path={`/search?q=${encodeURIComponent(q)}`} noindex />
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
