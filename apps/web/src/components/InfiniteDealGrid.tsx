import { useEffect, useRef } from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedResponse, Deal } from '@deals/types';
import DealCard from './DealCard';
import DealSkeleton from './DealSkeleton';

interface Props {
  data: InfiniteData<PaginatedResponse<Deal>> | undefined;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

export default function InfiniteDealGrid({
  data,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting && hasNextPage) fetchNextPage(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  const deals = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <DealSkeleton key={i} />)
          : deals.map((deal) => <DealCard key={deal._id} deal={deal} />)}
      </div>

      {isFetchingNextPage && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => <DealSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && !isFetchingNextPage && !hasNextPage && deals.length > 0 && (
        <p className="text-center text-sm text-slate-400 py-8">You've seen all the deals!</p>
      )}

      <div ref={sentinelRef} className="h-4" />
    </>
  );
}
