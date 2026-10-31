import { createAuthClient } from "better-auth/react";

import { config } from "./config";

/** Better Auth lives on the API under `/auth`; cookies travel with `credentials: include`. */
export const authClient = createAuthClient({
  baseURL: config.VITE_API_URL,
  basePath: "/auth",
  fetchOptions: { credentials: "include" },
});
