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
  return invalidateReviews(client, queries, new Set([key]));
}

function invalidateReviews(
  client: QueryClient,
  queries: ReviewQueries,
  keys: ReadonlySet<string | undefined>
) {
  return client.invalidateQueries({
    queryKey: queries.root,
    predicate: query => {
      if (keys.has(undefined)) return true;
      const [, , kind, target] = query.queryKey;
      if (kind === "state") return keys.has(target as string);
      const filter = target as CommentFilter;
      return !filter.key || keys.has(filter.key);
    },
  });
}

/** One owner per provider. Join paired SSE events and mutation settlement into one read.
 * Serialize later batches: an event received during a read must refresh after that read,
 * rather than canceling it repeatedly or treating its older result as current.
 */
export function createReviewInvalidator(client: QueryClient, queries: ReviewQueries) {
  let batch: { keys: Set<string | undefined>; done: Promise<void> } | null = null;
  let previous = Promise.resolve();
  return (key?: string) => {
    if (!batch) {
      const keys = new Set<string | undefined>();
      const earlier = previous;
      const done = new Promise<void>(resolve => setTimeout(resolve, 50)).then(async () => {
        batch = null;
        await earlier;
        await invalidateReviews(client, queries, keys);
      });
      previous = done.catch(() => {});
      batch = { keys, done };
    }
    batch.keys.add(key);
    return batch.done;
  };
}
