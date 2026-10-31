---
name: inngest
description: Durable background jobs and event-driven functions with Inngest, plus the local Dev Server
shapes: [start, api]
skills: [inngest]
env: [INNGEST_DEV, INNGEST_BASE_URL, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, INNGEST_PORT]
services: [inngest]
---

# Inngest

Use Inngest when work must survive a request: retries, fan-out, cron, sleeps, or slow third-party
calls. Events are typed with zod via `eventType`; functions are served from one HTTP endpoint that
the Inngest Dev Server (local) or Inngest Cloud (deploy) calls back.

## 1. Environment

Add to BOTH `.env.example` and `.env.local`:

```bash
# Inngest. Locally the Dev Server from docker compose; deploys set INNGEST_DEV=0 and both keys.
INNGEST_DEV=1
INNGEST_BASE_URL=http://localhost:8288
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
INNGEST_PORT=8288
```

In `.env.local` pick a free `INNGEST_PORT` when another project already uses 8288, and set
`INNGEST_BASE_URL` to the same port.

## 2. Dev Server

Add under `services:` in `docker-compose.yml` (`bun run db:up` starts it with Postgres). Use port
3001 and path `/inngest` for the api shape, 3000 and `/api/inngest` for start:

```yaml
services:
  # postgres: ... (unchanged)
  inngest:
    image: inngest/inngest:v1.46.0@sha256:9c4a2413bdbfa31a94ff54c32ae2dcc6613dbee84bc76db6cf6644d19e357e3e
    container_name: proto-inngest
    command: "inngest dev -u http://host.docker.internal:3001/inngest"
    extra_hosts: ["host.docker.internal:host-gateway"]
    ports: ["127.0.0.1:${INNGEST_PORT:-8288}:8288"]
```

## 3. Code

### api

`bun add --exact inngest@4.24.0` in `apps/api`.

Add to `envSchema` in `apps/api/src/platform/env.ts`:

```ts
  INNGEST_DEV: z.enum(["0", "1"]).default("0"),
  INNGEST_BASE_URL: z.union([z.url(), z.literal("")]).default(""),
  INNGEST_EVENT_KEY: z.string().default(""),
  INNGEST_SIGNING_KEY: z.string().default(""),
```

Create `apps/api/src/platform/inngest.ts`:

```ts
import { eventType, Inngest } from "inngest";
import { z } from "zod";

import type { ApiEnv } from "./env";

export const helloRequested = eventType("app/hello.requested", {
  schema: z.object({ name: z.string() }),
});

export function createInngest(env: ApiEnv) {
  return new Inngest({
    id: env.NODE_ENV === "test" ? "proto-api-test" : "proto-api",
    baseUrl: env.INNGEST_BASE_URL || undefined,
    isDev: env.INNGEST_DEV === "1",
    eventKey: env.INNGEST_EVENT_KEY || undefined,
    signingKey: env.INNGEST_SIGNING_KEY || undefined,
  });
}

export type InngestClient = ReturnType<typeof createInngest>;
```

Create `apps/api/src/modules/hello/functions.ts` (one `functions.ts` per module):

```ts
import { helloRequested, type InngestClient } from "../../platform/inngest";

export function helloFunctions(inngest: InngestClient) {
  return [
    inngest.createFunction(
      { id: "say-hello", triggers: [helloRequested], retries: 3 },
      async ({ event, step }) => step.run("greet", () => ({ greeting: `Hello ${event.data.name}` }))
    ),
  ];
}
```

In `apps/api/src/app.ts`, import `serve` from `"inngest/hono"`, `createInngest` and `helloFunctions`,
create the client next to `auth`, and mount the endpoint after the `/auth/*` line:

```ts
const inngest = createInngest(env);
// ...
app.on(
  ["GET", "POST", "PUT"],
  "/inngest",
  serve({
    client: inngest,
    functions: [...helloFunctions(inngest)],
    // The dockerized Dev Server reaches the API as host.docker.internal, not API_URL.
    serveOrigin: env.INNGEST_DEV === "1" ? undefined : env.API_URL,
  })
);
```

Send events from routes with `await inngest.send(helloRequested.create({ name }))`; pass the
client into module routes the way `auth` is passed.

### start

`bun add --exact inngest@4.24.0` in `apps/web`. Change the compose `command` to
`inngest dev -u http://host.docker.internal:3000/api/inngest`.

The Dev Server container can only reach Vite on IPv4 and Vite rejects unknown `Host` headers, so
add to the object returned in `apps/web/vite.config.ts`:

```ts
    // The Inngest Dev Server (docker compose) calls back through host.docker.internal.
    server: { host: "127.0.0.1", allowedHosts: ["host.docker.internal"] },
```

Create `apps/web/src/inngest/client.ts`:

```ts
import { eventType, Inngest } from "inngest";
import { z } from "zod";

export const helloRequested = eventType("app/hello.requested", {
  schema: z.object({ name: z.string() }),
});

export const inngest = new Inngest({
  id: "proto-web",
  baseUrl: process.env.INNGEST_BASE_URL || undefined,
  isDev: process.env.INNGEST_DEV === "1",
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
  signingKey: process.env.INNGEST_SIGNING_KEY || undefined,
});
```

Create `apps/web/src/inngest/functions.ts`:

```ts
import { helloRequested, inngest } from "./client";

export const functions = [
  inngest.createFunction(
    { id: "say-hello", triggers: [helloRequested], retries: 3 },
    async ({ event, step }) => step.run("greet", () => ({ greeting: `Hello ${event.data.name}` }))
  ),
];
```

Create `apps/web/src/routes/api/inngest.ts` (`inngest/edge` takes a fetch `Request`):

```ts
import { createFileRoute } from "@tanstack/react-router";
import { serve } from "inngest/edge";

import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

const handler = serve({ client: inngest, functions });

/** Inngest calls this endpoint to sync and run functions. Requests are signed outside dev. */
export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      PUT: ({ request }) => handler(request),
    },
  },
});
```

Send events only from server code (server functions after `requireUser()`, server routes):
`await inngest.send(helloRequested.create({ name }))`.

## 4. CLAUDE.md

Add under Rules:

```md
- Background work runs in Inngest functions (`inngest/*`). Events are declared with `eventType`
  and a zod schema; the serve endpoint is the one route outside the OpenAPI contract besides auth.
```

(start shape: drop the OpenAPI clause.)

## Done when

`bun run format && bun run verify` passes, and with `bun run db:up` and `bun dev` running, the app listed at
http://localhost:8288/apps, sending
`curl -s -X POST localhost:8288/e/test -d '{"name":"app/hello.requested","data":{"name":"Ada"}}'`
shows a completed `say-hello` run at http://localhost:8288/runs (or
`curl -s localhost:8288/v1/events/<id>/runs` returns `"status":"Completed"`). Deploy: set
`INNGEST_DEV=0`, the event and signing keys, and sync the app URL in Inngest Cloud.
