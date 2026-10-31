import { QueryClient } from "@tanstack/react-query";

/** The gallery owns this cache. Prototype frames never mount its provider. */
export const galleryQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
