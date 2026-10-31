import type { Database } from "@proto/db";
import * as schema from "@proto/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { ApiEnv } from "./env";

export function createAuth(db: Database, env: ApiEnv) {
  return betterAuth({
    baseURL: env.API_URL,
    basePath: "/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL, ...(env.PROTO_PUBLIC_ORIGIN ? [env.PROTO_PUBLIC_ORIGIN] : [])],
    // Better Auth defaults to host-only cookies; never enable crossSubDomainCookies.
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
  });
}

export type Auth = ReturnType<typeof createAuth>;
