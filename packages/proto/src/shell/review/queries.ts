import { queryOptions, skipToken, type QueryClient } from "@tanstack/react-query";

import type { CommentFilter, ReviewApi } from "./api";

/** Canonical reads shared by cards, threads, counts, search and intent prefetch. */
export function createReviewQueries(api: ReviewApi | null, scope: string) {
  const root = ["review", scope] as const;
  return {
    root,
    comments: (filter: CommentFilter = {}) =>
      queryOptions({
        queryKey: [...root, "comments", filter] as const,
        queryFn: api ? ({ signal }) => api.listComments(filter, signal) : skipToken,
        staleTime: api?.writable ? 30_000 : Infinity,
      }),
    state: (key: string) =>
      queryOptions({
        queryKey: [...root, "state", key] as const,
        queryFn: api ? ({ signal }) => api.review(key, signal) : skipToken,
        staleTime: api?.writable ? 30_000 : Infinity,
      }),
  };
}

export type ReviewQueries = ReturnType<typeof createReviewQueries>;

/** Invalidate the changed review and comment lists that include it, retaining their last data. */
export function invalidateReview(client: QueryClient, queries: ReviewQueries, key?: string) {
  return client.invalidateQueries({
    queryKey: queries.root,
    predicate: query => {
      if (!key) return true;
      const [, , kind, target] = query.queryKey;
      if (kind === "state") return target === key;
      const filter = target as CommentFilter;
      return !filter.key || filter.key === key;
    },
  });
}
