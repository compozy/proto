---
name: sentry
description: Error reporting with Sentry 11, with every PII collector switched off
shapes: [start, api]
skills: [sentry-cli]
env: [SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_RELEASE, VITE_SENTRY_DSN, VITE_SENTRY_ENVIRONMENT]
---

# Sentry

Reports unexpected errors with the stack, route and function, never the person. Sentry SDK v11
replaced `sendDefaultPii` with `dataCollection`, and its defaults collect cookies, headers, bodies,
query strings, AI prompts and local variables: every `init` below switches them off. An empty DSN
keeps Sentry off, so local dev and tests send nothing. Keep every `@sentry/*` package on one version.

## 1. Environment

Add to BOTH `.env.example` and `.env.local`:

```bash
# Error reporting (optional; empty DSN keeps Sentry off). Deploys set the stage and the commit.
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=development
```

## 2. Code

### api

`bun add --exact @sentry/bun@11.8.0` in `apps/api`, `bun add --exact @sentry/react@11.8.0` in
`apps/app`.

Add to `envSchema` in `apps/api/src/platform/env.ts`:

```ts
  SENTRY_DSN: z.union([z.url(), z.literal("")]).default(""),
  SENTRY_ENVIRONMENT: z.string().min(1).default("development"),
  SENTRY_RELEASE: z.string().default(""),
```

Create `apps/api/src/platform/sentry.ts`:

```ts
import * as Sentry from "@sentry/bun";

import type { ApiEnv } from "./env";

// Reports carry the stack, route and function, never the person: SDK v11 collects cookies,
// headers, bodies, query strings, AI prompts and local variables unless each is switched off.
export const dataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies NonNullable<Parameters<typeof Sentry.init>[0]>["dataCollection"];

export function initSentry(env: ApiEnv) {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    ...(env.SENTRY_RELEASE ? { release: env.SENTRY_RELEASE } : {}),
    dataCollection,
    tracesSampleRate: 0.1,
  });
}

export function reportError(error: unknown, tags: Record<string, string>) {
  Sentry.captureException(error, { tags });
}

export const flushSentry = (timeout = 2000) => Sentry.flush(timeout);
```

In `apps/api/src/server.ts` call `initSentry(env)` right after `loadEnv()` and
`await flushSentry()` in `shutdown()` before `process.exit(0)`. In `apps/api/src/app.ts`, report in
`app.onError` after the `DomainError` branch (a `DomainError` is an answer, not a defect), and let
the SPA propagate traces by adding `"sentry-trace", "baggage"` to the CORS `allowHeaders`:

```ts
console.error(error);
reportError(error, { route: c.req.routePath });
```

SPA: add to the zod object in `apps/app/src/lib/config.ts`:

```ts
    VITE_SENTRY_DSN: z.union([z.url(), z.literal("")]).default(""),
    VITE_SENTRY_ENVIRONMENT: z.string().min(1).default("development"),
```

Create `apps/app/src/lib/sentry.ts`:

```ts
import * as Sentry from "@sentry/react";
import type { AnyRouter } from "@tanstack/react-router";
import type { ErrorInfo } from "react";

import { ApiError } from "./api";
import { config } from "./config";

/** An `ApiError` is an answer the API chose (it reports its own 5xx); report only the unexpected. */
export function initSentry(router: AnyRouter) {
  if (!config.VITE_SENTRY_DSN) return;
  Sentry.init({
    dsn: config.VITE_SENTRY_DSN,
    environment: config.VITE_SENTRY_ENVIRONMENT,
    integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
    tracesSampleRate: 0.1,
    tracePropagationTargets: [config.VITE_API_URL],
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    // Connectivity drops are the user's network, not a defect.
    ignoreErrors: [/^Failed to fetch/, /^NetworkError when attempting to fetch/, /^Load failed/],
  });
}

export function reportReactError(error: unknown, info: ErrorInfo) {
  if (!(error instanceof ApiError)) Sentry.captureReactException(error, info);
}
```

In `apps/app/src/main.tsx` import them, call `initSentry(router);` before `createRoot`, and pass
`{ onUncaughtError: reportReactError, onCaughtError: reportReactError }` as the second argument
of `createRoot(...)`.

If the inngest recipe is applied, report a run only when it will not retry again: add
`middleware: [SentryInngestMiddleware]` to `new Inngest({ ... })` and append to `sentry.ts`
(with `import { Middleware } from "inngest";`):

```ts
export class SentryInngestMiddleware extends Middleware.BaseMiddleware {
  readonly id = "proto-sentry";
  override onRunError({ error, fn, isFinalAttempt }: Middleware.OnRunErrorArgs) {
    if (isFinalAttempt) reportError(error, { "inngest.function": fn.id() });
  }
}
```

### start

`bun add --exact @sentry/tanstackstart-react@11.8.0` in `apps/web`.

Create `apps/web/src/lib/sentry.ts` (shared by both inits):

```ts
import type { init } from "@sentry/tanstackstart-react";

// Reports carry the stack and route, never the person: SDK v11 collects cookies, headers,
// bodies, query strings, AI prompts and local variables unless each is switched off.
export const dataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies NonNullable<Parameters<typeof init>[0]>["dataCollection"];
```

Create `apps/web/src/instrument.server.ts`. The server entry imports it first, which also works on
Vercel where `--import` is unavailable. Keep `apps/web/package.json` free of a `"sideEffects"`
list, or the build drops this side-effect-only import silently:

```ts
import * as Sentry from "@sentry/tanstackstart-react";

import { dataCollection } from "./lib/sentry";

if (process.env.SENTRY_DSN)
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || "development",
    ...(process.env.SENTRY_RELEASE ? { release: process.env.SENTRY_RELEASE } : {}),
    dataCollection,
    tracesSampleRate: 0.1,
  });
```

Create `apps/web/src/server.ts`:

```ts
import "./instrument.server";

import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry(wrapFetchWithSentry({ fetch: request => handler.fetch(request) }));
```

Create `apps/web/src/start.ts` (server functions and requests report through these middlewares):

```ts
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  requestMiddleware: [sentryGlobalRequestMiddleware],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
```

Create `apps/web/src/client.tsx`:

```tsx
import * as Sentry from "@sentry/tanstackstart-react";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

import { dataCollection } from "./lib/sentry";

if (import.meta.env.VITE_SENTRY_DSN)
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
    dataCollection,
    tracesSampleRate: 0.1,
  });

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
});
```

In `apps/web/src/router.tsx` import `* as Sentry from "@sentry/tanstackstart-react"` and, before
`return router`, add browser tracing:

```ts
if (!router.isServer) Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router));
```

## 3. Source maps (optional)

Readable production stacks need an org token in CI as `SENTRY_AUTH_TOKEN` (never in `.env.local`):
`@sentry/vite-plugin@11.8.0` in `apps/app` (api) or `sentryTanstackStart` from
`@sentry/tanstackstart-react/vite` (start), added to the Vite plugins only when the token is set,
with `sourcemaps: { filesToDeleteAfterUpload: [...] }` so maps are not served.

## 4. CLAUDE.md

Add under Rules:

```md
- Errors reach Sentry only through `reportError`/the SDK init in `sentry.ts`; every init keeps
  `dataCollection` off (no user, cookies, headers, bodies, query strings or locals). Domain errors
  and expected API answers are not reported.
```

## Done when

`bun run format && bun run verify` passes, and with a real DSN in `.env.local` a thrown error
shows up in the Sentry project without user, cookies or headers. api: add a temporary
`app.get("/debug-sentry", () => { throw new Error("sentry check"); })`, `curl localhost:3001/debug-sentry`
returns `{"code":"internal_error"}`. start: a temporary server route that throws, called once
against the built server (`bun run build`, then `node .output/server/index.mjs` in `apps/web`).
Remove the temporary route afterwards. Without an account, point the DSN at
`http://public@127.0.0.1:9999/1` and run a `Bun.serve({ port: 9999 })` that writes each request
body: the envelope must hold the error and the route, and no cookie or header values.
