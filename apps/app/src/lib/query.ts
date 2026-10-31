import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Client errors (4xx) are final; retry once on server or network failures.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
});
