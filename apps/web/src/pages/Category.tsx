import { useParams } from 'react-router-dom';
import { useInfiniteDeals, fetchFeedByCategory } from '../hooks/useInfiniteDeals';
import InfiniteDealGrid from '../components/InfiniteDealGrid';
import Seo from '../components/Seo';

export default function Category() {
  const { name = '' } = useParams();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteDeals(
    ['feed', 'category', name],
    (page) => fetchFeedByCategory(name, page)
  );

  return (
    <div>
      <Seo
        title={`Best ${name} Deals Today`}
        description={`Latest ${name} deals and discounts from Amazon & Flipkart, updated daily on DealDost.`}
        path={`/category/${name}`}
      />
      <h1 className="text-xl font-black text-slate-800 mb-4">{name} Deals</h1>
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
