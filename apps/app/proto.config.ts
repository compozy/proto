import { defineProtoConfig } from "@compozy/proto/config";

/** Prototype gallery of this app: `bun run proto dev` (see docs/design/prototyping.md). */
export default defineProtoConfig({
  title: "Proto",
  guards: {
    forbidRuntimeImports: [
      "src/lib/api.ts",
      "src/lib/query.ts",
      "src/lib/config.ts",
      "src/lib/auth-client.ts",
      "@tanstack/react-query",
      "better-auth",
      "openapi-fetch",
    ],
  },
  specs: { auth: "Authentication" },
  siteUrl: "https://example.com",
});
