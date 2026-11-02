import { QueryClient } from "@tanstack/react-query";

import { isReviewApiError } from "../review/api";

/** A cache per shell: server data never leaks between galleries or signed-in principals. */
export function createShellQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: (count, error) =>
          !(isReviewApiError(error) && error.status !== null && error.status < 500) && count < 1,
      },
      mutations: { retry: false },
    },
  });
}
