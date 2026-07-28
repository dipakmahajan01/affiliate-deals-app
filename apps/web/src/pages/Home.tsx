import { Link } from 'react-router-dom';
import { useInfiniteDeals, fetchFeed } from '../hooks/useInfiniteDeals';
import InfiniteDealGrid from '../components/InfiniteDealGrid';
import Seo, { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from '../components/Seo';

export default function Home() {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteDeals(
    ['feed'],
    fetchFeed
  );

  return (
    <div>
      <Seo
        title={`${SITE_NAME} — Best Amazon & Flipkart Deals from Telegram`}
        description={DEFAULT_DESCRIPTION}
        path="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: `${SITE_URL}/icon-512.png`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: SITE_URL,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${SITE_URL}/search?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />
      {/* Hero banner */}
      <div className="relative bg-gradient-to-br from-orange-500 via-orange-500 to-rose-500 rounded-2xl p-6 mb-6 overflow-hidden">
        <div className="relative z-10">
          <p className="text-orange-100 text-xs font-semibold uppercase tracking-widest mb-1">
            Updated Daily
          </p>
          <h1 className="text-white text-2xl sm:text-3xl font-black leading-tight mb-2">
            Best Deals,<br />Handpicked For You 🛍
          </h1>
          <p className="text-orange-100 text-sm mb-4">
            Savings from Amazon, Flipkart &amp; more — all in one place
          </p>
          <Link
            to="/trending"
            className="inline-flex items-center gap-1.5 bg-white text-orange-600 text-sm font-bold px-5 py-2.5 rounded-full shadow-md hover:bg-orange-50 transition"
          >
            🔥 See Trending Deals
          </Link>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -right-2 w-48 h-48 bg-white/5 rounded-full" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">Latest Deals</h2>
      </div>

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
