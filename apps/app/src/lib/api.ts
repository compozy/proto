import createClient from "openapi-fetch";

import type { paths } from "@/generated/api";

import { config } from "./config";

/** Typed client generated from the API contract (`bun run codegen`). */
export const api = createClient<paths>({ baseUrl: config.VITE_API_URL, credentials: "include" });

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
  }
}

/** Unwraps an openapi-fetch result, throwing `ApiError` so TanStack Query sees a failure. */
export function result<T>(response: { data?: T; error?: { code: string }; response: Response }): T {
  if (response.error) throw new ApiError(response.error.code, response.response.status);
  if (response.data === undefined)
    throw new ApiError("unexpected_response", response.response.status);
  return response.data;
}
