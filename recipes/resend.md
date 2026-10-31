---
name: resend
description: Transactional email through Resend behind a small sendEmail adapter
shapes: [start, api]
env: [RESEND_API_KEY, EMAIL_FROM]
---

# Resend

Use this when the app sends transactional email (password reset, notifications). One adapter owns
the provider: callers get `{ id }` or `{ error, status }` and decide whether to retry. With no
`RESEND_API_KEY` the adapter returns `not_configured`, so local dev and tests never send.

## 1. Environment

Add to BOTH `.env.example` and `.env.local`:

```bash
# Email (optional; empty key disables sending). EMAIL_FROM must use a domain verified in Resend.
RESEND_API_KEY=
EMAIL_FROM="Proto <no-reply@example.com>"
```

## 2. Code

### api

`bun add --exact resend@6.33.0` in `apps/api`.

Add to `envSchema` in `apps/api/src/platform/env.ts`:

```ts
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("Proto <no-reply@example.com>"),
```

Create `apps/api/src/platform/email.ts`:

```ts
import { Resend } from "resend";

import type { ApiEnv } from "./env";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type SendEmail = (
  message: EmailMessage,
  idempotencyKey?: string
) => Promise<{ id: string } | { error: string; status: number }>;

/** 4xx other than 429 is permanent: do not retry it. */
export function createEmailSender(env: Pick<ApiEnv, "RESEND_API_KEY" | "EMAIL_FROM">): SendEmail {
  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  return async (message, idempotencyKey) => {
    if (!resend) return { error: "not_configured", status: 401 };
    const { data, error } = await resend.emails.send(
      { from: env.EMAIL_FROM, ...message },
      idempotencyKey ? { idempotencyKey } : undefined
    );
    if (error) return { error: error.name, status: error.statusCode ?? 500 };
    if (!data?.id) throw new Error("Missing provider acknowledgement");
    return { id: data.id };
  };
}
```

Build it once in `createApp` (`const sendEmail = createEmailSender(env);`) and pass it into the
modules that need it, the way `auth` is passed.

### start

`bun add --exact resend@6.33.0` in `apps/web`.

Create `apps/web/src/lib/email.ts`:

```ts
import { createServerOnlyFn } from "@tanstack/react-start";
import { Resend } from "resend";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };

let resend: Resend | null | undefined;

/** Server-only. Returns `not_configured` without RESEND_API_KEY; 4xx other than 429 is permanent. */
export const sendEmail = createServerOnlyFn(
  async (
    message: EmailMessage,
    idempotencyKey?: string
  ): Promise<{ id: string } | { error: string; status: number }> => {
    const apiKey = process.env.RESEND_API_KEY;
    resend ??= apiKey ? new Resend(apiKey) : null;
    if (!resend) return { error: "not_configured", status: 401 };
    const from = process.env.EMAIL_FROM || "Proto <no-reply@example.com>";
    const { data, error } = await resend.emails.send(
      { from, ...message },
      idempotencyKey ? { idempotencyKey } : undefined
    );
    if (error) return { error: error.name, status: error.statusCode ?? 500 };
    if (!data?.id) throw new Error("Missing provider acknowledgement");
    return { id: data.id };
  }
);
```

## 3. Wiring (optional)

Password reset with Better Auth: in `betterAuth({ emailAndPassword: { ... } })` (`apps/api/src/platform/auth.ts`
takes `sendEmail` as a parameter; start imports it from `@/lib/email`) add:

```ts
sendResetPassword: async ({ user, url }) => {
  await sendEmail({ to: user.email, subject: "Reset your password", text: `Reset it here: ${url}` });
},
```

and a page that calls `authClient.requestPasswordReset` / `authClient.resetPassword`. If the
inngest recipe is applied, send from an Inngest step with the event id as `idempotencyKey`, and
throw `NonRetriableError` on a permanent (4xx, not 429) result so retries never double-send.

## 4. CLAUDE.md

Add under Rules:

```md
- Email goes through `sendEmail` (Resend) only; no other module imports `resend`. An empty
  `RESEND_API_KEY` disables sending.
```

## Done when

`bun run format && bun run verify` passes, and with a real `RESEND_API_KEY` a send to Resend's test
inbox returns an id (api shape; run in `apps/api`):

```bash
bun --env-file=../../.env.local -e 'import { createEmailSender } from "./src/platform/email";
import { loadEnv } from "./src/platform/env";
console.log(await createEmailSender(loadEnv())({ to: "delivered@resend.dev", subject: "Hi", text: "Hi" }))'
```

Without a key the same command prints `{ error: "not_configured", status: 401 }`.
