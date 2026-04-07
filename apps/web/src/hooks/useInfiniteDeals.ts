import { useInfiniteQuery } from '@tanstack/react-query';
import type { PaginatedResponse, Deal } from '@deals/types';
import { api } from '../api/client';

type FetchFn = (page: number) => Promise<PaginatedResponse<Deal>>;

export function useInfiniteDeals(key: string[], fetchFn: FetchFn) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchFn(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function fetchDeals(page: number): Promise<PaginatedResponse<Deal>> {
  return api.get(`/deals?page=${page}&limit=20`).then((r) => r.data);
}

export function fetchByCategory(category: string, page: number): Promise<PaginatedResponse<Deal>> {
  return api.get(`/deals/category/${category}?page=${page}&limit=20`).then((r) => r.data);
}

export function fetchSearch(q: string, page: number): Promise<PaginatedResponse<Deal>> {
  return api.get(`/deals/search?q=${encodeURIComponent(q)}&page=${page}`).then((r) => r.data);
}

export function fetchFeed(page: number): Promise<PaginatedResponse<Deal>> {
  return api.get(`/feed?page=${page}&limit=20`).then((r) => r.data);
}

export function fetchFeedByCategory(category: string, page: number): Promise<PaginatedResponse<Deal>> {
  return api.get(`/feed/category/${category}?page=${page}&limit=20`).then((r) => r.data);
}

export function fetchFeedSearch(q: string, page: number): Promise<PaginatedResponse<Deal>> {
  return api.get(`/feed/search?q=${encodeURIComponent(q)}&page=${page}`).then((r) => r.data);
}
