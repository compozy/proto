# Developer Experience: @compozy/proto

Public-surface contract for `@compozy/proto`. Companion to `_spec.md` (Part II serves this surface) and
`_tests.md` (E2E journeys use these exact invocations).

## Golden Path

```console
$ bun add -d @compozy/proto
$ bunx proto init
✓ proto.config.ts
✓ proto.canvas.tsx
✓ src/drafts/welcome/index.proto.tsx
✓ docs/design/prototyping.md
Next: bunx proto dev

$ bunx proto dev
proto  ready in 412 ms
  ➜  Gallery  http://127.0.0.1:4400/
  ➜  Welcome  http://127.0.0.1:4400/?p=welcome
  1 prototype · 0 flows · 0 problems
```

Write a prototype beside a view:

```tsx
// src/components/login-form.proto.tsx
import { definePrototype, setParam, type PrototypeProps } from "@compozy/proto";
import { LoginForm } from "./login-form";

export const meta = definePrototype({
  title: "Sign in",
  spec: "auth",
  surface: "A1",
  route: "/login",
  standalone: true,
  states: [
    { id: "sign-in", label: "Sign in" },
    { id: "error", label: "Wrong password" },
  ],
});

export default function Prototype({ state }: PrototypeProps) {
  return (
    <LoginForm
      mode="sign-in"
      error={state === "error" ? "Invalid email or password" : null}
      pending={false}
      onModeChange={() => {}}
      onSubmit={() => setParam("state", "error")}
    />
  );
}
```

The gallery lists **Authentication → Sign in** with two states, without a reload.

## Config files

`proto.config.ts` (app root, loaded by the Vite plugin, the CLI and `proto mcp`):

```ts
import { defineProtoConfig } from "@compozy/proto/config";

export default defineProtoConfig({
  title: "Acme",
  prototypes: "src/**/*.proto.tsx", // default
  drafts: "src/drafts", // default; drafts may use free markup
  flows: "flows", // default; *.flow.ts files
  canvas: "proto.canvas.tsx", // default
  specs: { auth: "Authentication", billing: "Billing" },
  roles: { member: "Member", admin: "Admin" },
  siteUrl: "https://acme.com", // resolves `site` nodes in flows
  locale: "en", // shell copy: "en" | "pt-BR"
  guards: {
    forbidRuntimeImports: ["src/lib/api.ts", "@tanstack/react-query", "better-auth"],
    productionBoundary: true, // default
  },
  review: { remote: { url: "https://proto.acme.com" } }, // optional; enables remote review in builds
  evidence: { dir: ".proto/evidence" }, // default
});
```

`proto.canvas.tsx`:

```tsx
import type { CanvasProps, FrameProps } from "@compozy/proto";
import { ThemeProvider } from "@acme/ui/theme";
import { AppShellView } from "./src/systems/shell/app-shell-view";

/** Providers around every rendered state. */
export function Canvas({ children, theme }: CanvasProps) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

/** Production chrome around component prototypes (not drafts, not `standalone`). */
export function Frame({ route, children }: FrameProps) {
  return <AppShellView activeRoute={route}>{children}</AppShellView>;
}
```

`vite.config.ts` gains one plugin (added by `proto init`):

```ts
import { proto } from "@compozy/proto/vite";
export default defineConfig({ plugins: [react(), tailwindcss(), proto()] });
```

Effect: `vite build` of the app fails if a prototype, fixture or gallery module enters the production
bundle; `proto dev`/`proto build` reuse this config for rendering prototypes.

Flow (`flows/sign-in.flow.ts`):

```ts
import { defineFlow } from "@compozy/proto/flow";

export const flow = defineFlow({
  title: "Sign in",
  spec: "auth",
  start: ["site"],
  nodes: {
    site: { external: "site", url: "/" },
    "sign-in": { proto: "login-form", state: "sign-in" },
    error: { proto: "login-form", state: "error" },
    home: { proto: "welcome", state: "default", end: true },
  },
  edges: [
    ["site", "sign-in", { on: "Sign in" }],
    ["sign-in", "error", { on: "Wrong password", kind: "overlay" }],
    ["error", "home", { on: "Signed in", kind: "redirect" }],
  ],
});
```

## URLs

| URL                                                                     | Shows                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| `/`                                                                     | Overview                                           |
| `/?spec=auth`                                                           | Spec page                                          |
| `/?flow=sign-in&node=error`                                             | Flow canvas, step selected                         |
| `/?p=login-form&state=error&w=1440&theme=dark&role=admin`               | Screen view                                        |
| `/?p=login-form&state=error&compare=themes`                             | Compare                                            |
| `/?comments=open`                                                       | Comments inbox (`open` \| `resolved` \| `waiting`) |
| `/?p=login-form&comment=7`                                              | Screen view with thread #7 focused                 |
| `/?drafts` · `/?settings=health`                                        | Drafts · Settings section                          |
| `/__proto/render/login-form?state=error&theme=dark&role=admin&chrome=0` | The bare state (iframe/screenshot target)          |

## CLI

Every command accepts `--app <dir>` (default: cwd), `--json`, `--remote` (where marked) and exits
0 ok · 1 problems/user error · 2 usage · 3 missing dependency · 4 remote/auth.

### proto list

```console
$ proto list
auth        login-form       Sign in          A1  /login   4 states
—           welcome (draft)  Welcome home     D1  /        2 states
2 prototypes · 1 flow

$ proto list --json
{"prototypes":[{"slug":"login-form","kind":"component","file":"src/components/login-form.proto.tsx","title":"Sign in","spec":"auth","surface":"A1","route":"/login","roles":[],"standalone":true,"states":[{"id":"sign-in","label":"Sign in"},{"id":"error","label":"Wrong password"}]}],"flows":[{"id":"sign-in","title":"Sign in","spec":"auth","steps":4}]}
```

### proto check

```console
$ proto check
✗ src/systems/billing/invoice.proto.tsx:14:7  markup  Component prototypes compose views; move <div> into the view or use a draft.
✗ flows/checkout.flow.ts  unknown_state  Node "paid" uses state "done" that invoice has not declared.
! flows/sign-in.flow.ts  uncovered_state  login-form state "pending" is in no flow.
2 problems · 1 warning
$ echo $?
1

$ proto check --json
{"problems":[{"code":"markup","file":"src/systems/billing/invoice.proto.tsx","line":14,"column":7,"message":"Component prototypes compose views; move <div> into the view or use a draft."},{"code":"unknown_state","file":"flows/checkout.flow.ts","node":"paid","message":"Node \"paid\" uses state \"done\" that invoice has not declared."}],"warnings":[{"code":"uncovered_state","file":"flows/sign-in.flow.ts","proto":"login-form","state":"pending"}]}
```

`proto check` also runs the network guard and a no-write render build.

### proto new / flow

```console
$ proto new review-digest --draft
✓ src/drafts/review-digest/index.proto.tsx
  http://127.0.0.1:4400/?p=review-digest

$ proto new --in src/systems/billing/invoice-view.tsx --spec billing
✓ src/systems/billing/invoice-view.proto.tsx

$ proto flow new checkout --spec billing
✓ flows/checkout.flow.ts

$ proto flow show sign-in --json
{"id":"sign-in","title":"Sign in","steps":[{"id":"site","step":1,"kind":"external"},{"id":"sign-in","step":2,"kind":"prototype","proto":"login-form","state":"sign-in"}],"edges":[{"from":"site","to":"sign-in","on":"Sign in","kind":"navigate"}],"problems":[],"warnings":[]}

$ proto flow coverage --json
{"uncovered":[{"proto":"login-form","state":"pending"}]}
```

### proto url

```console
$ proto url login-form --state error
http://127.0.0.1:4400/?p=login-form&state=error
$ proto url login-form --state error --bare --remote
https://proto.acme.com/__proto/render/login-form?state=error&chrome=0
```

### proto comments

```console
$ proto comments list --status open
login-form #7  error  Pedro Nauck  4m   The error should sit under the password field…   src/components/login-form.tsx:58:27
login-form #6  error  Pedro Nauck  12m  Keep the title as "Sign in" in the error state.    src/components/login-form.tsx:31:11
2 open

$ proto comments show login-form 7 --json
{"key":"login-form","id":7,"status":"open","target":{"kind":"element","selector":"[data-testid=login-error]","testId":"login-error","tag":"p","text":"Invalid email or password","source":"src/components/login-form.tsx:58:27","sourceChain":["src/components/login-form.tsx:58:27","src/components/login-form.proto.tsx:21:5"],"rect":{"x":360,"y":351,"width":178,"height":20},"rectNormalized":{"x":0.35,"y":0.548,"width":0.174,"height":0.031},"offset":null},"context":{"commit":"a41c9e2","state":"error","theme":"dark","role":null,"viewport":{"width":1024,"height":640}},"messages":[{"id":"m1","author":{"kind":"reviewer","name":"Pedro Nauck"},"body":"The error should sit under the password field, not above the button.","attachments":[],"createdAt":"2026-10-30T22:41:03Z"}]}

$ proto comments reply login-form 7 --body "Moved it into the password Field description."
✓ login-form #7 replied (agent)

$ proto comments resolve login-form 7 --note "Fixed in 3f2a1c0."
✓ login-form #7 resolved

$ proto comments add login-form --state error --body "Spacing too tight" --selector "[data-testid=login-error]"
✓ login-form #8 open

$ proto comments attachments login-form 7 --out .tmp/c7
✓ .tmp/c7/a1.png

$ proto comments list --remote --status open --json
{"comments":[…]}
```

Other verbs: `reopen`, `edit <key> <id> <messageId> --body`, `delete <key> <id>`, `attach <file>` (returns a
pending attachment id for `--attach` on `reply`/`add`), `detach`.

### proto review

```console
$ proto review status login-form
login-form  in review  2 open
$ proto review approve login-form
✗ approval needs a reviewer: agent credentials cannot approve (scope_denied)   # with an agent credential, exit 4
$ proto review approve login-form --yes        # as a reviewer locally
✓ login-form approved at a41c9e2 (2 open comments)
$ proto review reopen login-form
✓ login-form back in review
```

### proto screenshot / evidence

```console
$ proto screenshot login-form --state error --theme dark --width 1440
✓ .proto/evidence/login-form--error--dark--1440.png (1440×900)

$ proto evidence login-form --state error
✓ docs/design/login-form/index.html (static DOM, no scripts)

$ proto screenshot login-form
✗ Playwright Chromium is not installed. Run: bunx playwright install chromium
$ echo $?
3
```

### proto dev / build / init / migrate / mcp / auth

```console
$ proto dev --port 4410 --open
$ proto build                       # → dist-proto/ ; exit 1 on any problem
$ proto init --skills               # also installs skills
$ proto migrate                     # from gallery.config.ts + preview/canvas.tsx
✓ proto.config.ts (from gallery.config.ts)
✓ proto.canvas.tsx (from preview/canvas.tsx)
✓ git mv gallery/comments proto/comments (13 files)
Delete when ready: gallery.config.ts, vite.presentation.ts, preview/
$ proto mcp                         # stdio MCP server
$ proto auth login --remote https://proto.acme.com
Open https://proto.acme.com/settings/credentials?cli=1 and paste the token:
✓ Saved credential "pedro-laptop" for https://proto.acme.com (scopes: review, comment)
$ proto auth credentials --remote https://proto.acme.com --json
{"credentials":[{"id":"cr_8f2","name":"pedro-laptop","scopes":["review","comment"],"lastUsedAt":"2026-10-30T22:50:00Z"}]}
$ proto auth revoke cr_8f2 --remote https://proto.acme.com
✓ Revoked cr_8f2
$ proto auth logout --remote https://proto.acme.com
```

## Node API

```ts
import { loadProject } from "@compozy/proto/node";

const project = await loadProject("apps/app");
const registry = await project.registry();
registry.prototypes.map(p => p.slug); // ["login-form", "welcome"]
registry.problems; // []
const store = project.store(); // { remote: true } → HttpStore
const open = await store.list({ status: "open" });
await store.reply("login-form", 7, { author: { kind: "agent", name: "codex" }, body: "Done." });
await project.screenshot({ slug: "login-form", state: "error", theme: "dark", width: 1440 });
```

## HTTP API

Dev: `http://127.0.0.1:4400/__proto/api/…` (same-origin writes only). Remote: `https://proto.acme.com/api/…`
with a session cookie or `Authorization: Bearer pcr_…`.

```http
GET /api/comments?key=login-form&status=open
200 {"comments":[{"key":"login-form","id":7,"status":"open", …}]}

POST /api/comments
{"key":"login-form","target":{…},"context":{…},"body":"Spacing too tight","attachments":["at_01"]}
201 {"comment":{"key":"login-form","id":8, …}}

PATCH /api/comments/login-form/7/status   {"status":"resolved","note":"Fixed in 3f2a1c0."}
200 {"comment":{… "status":"resolved"}}

POST /api/attachments  (multipart: file)
201 {"attachment":{"id":"at_01","mime":"image/png","bytes":184220,"expiresAt":"2026-10-31T22:41:00Z"}}
413 {"error":{"code":"attachment_too_large","message":"Images are limited to 5 MB."}}

PUT /api/reviews/login-form   {"status":"approved"}
200 {"review":{"status":"approved","author":"Pedro Nauck","commit":"a41c9e2","openAtApproval":2}}
403 {"error":{"code":"scope_denied","message":"This credential cannot approve."}}

POST /api/credentials   {"name":"codex-ci","scopes":["comment"]}
201 {"credential":{"id":"cr_9a1","name":"codex-ci","scopes":["comment"],"token":"pcr_3b1f…"}}

GET /api/events   (text/event-stream)
event: comments   data: {"key":"login-form"}
```

## Server

```ts
// apps/api/src/proto.ts
import { createReviewServer, postgresStorage } from "@compozy/proto/server";
import { sql } from "./db";
import { auth } from "./auth";

export const protoReview = createReviewServer({
  storage: postgresStorage(sql),
  authorize: async request => {
    const session = await auth.api.getSession({ headers: request.headers });
    return session
      ? { kind: "reviewer", name: session.user.name, scopes: ["review", "comment"] }
      : null;
  },
  gallery: { dir: "../app/dist-proto" },
});
// Hono: app.all("/proto/*", c => protoReview(c.req.raw));
```

## MCP

`proto mcp` (stdio). Tools and results mirror `--json`:

```json
{"name":"proto_comments_list","arguments":{"status":"open"}}
→ {"comments":[{"key":"login-form","id":7,"status":"open","source":"src/components/login-form.tsx:58:27", …}]}

{"name":"proto_comments_resolve","arguments":{"key":"login-form","id":7,"note":"Fixed in 3f2a1c0."}}
→ {"comment":{"key":"login-form","id":7,"status":"resolved"}}

{"name":"proto_screenshot","arguments":{"slug":"login-form","state":"error","theme":"dark","width":1440}}
→ {"path":".proto/evidence/login-form--error--dark--1440.png","width":1440,"height":900}
```

Tools: `proto_list`, `proto_check`, `proto_url`, `proto_flow_show`, `proto_comments_list`,
`proto_comments_show`, `proto_comments_reply`, `proto_comments_resolve`, `proto_review_status`,
`proto_screenshot`, `proto_evidence`. MCP never approves.

## Errors

| Condition                         | Code                                       | Surface output                                            | Points to                          |
| --------------------------------- | ------------------------------------------ | --------------------------------------------------------- | ---------------------------------- |
| Config invalid                    | `invalid_config`                           | `✗ proto.config.ts: specs.auth must be a string` (exit 1) | fix the key                        |
| Not a Vite app                    | `not_a_vite_app`                           | exit 1                                                    | `--app <dir>`                      |
| Monorepo root without app         | `app_required`                             | exit 2                                                    | `--app`                            |
| Port busy                         | `port_in_use`                              | exit 1                                                    | `--port`                           |
| Slug taken                        | `slug_taken`                               | exit 1                                                    | choose another slug                |
| Comment missing                   | `comment_not_found`                        | exit 1 / 404                                              | `proto comments list`              |
| Attachment too large / wrong type | `attachment_too_large` / `attachment_type` | 413 / 415                                                 | limits                             |
| Cross-origin dev write            | `cross_origin_write`                       | 403                                                       | open the gallery from its origin   |
| No credential                     | `auth_required`                            | exit 4 / 401                                              | `proto auth login`                 |
| Revoked credential                | `credential_revoked`                       | exit 4 / 401                                              | new credential                     |
| Scope denied                      | `scope_denied`                             | exit 4 / 403                                              | reviewer approves                  |
| Playwright missing                | `playwright_missing`                       | exit 3                                                    | `bunx playwright install chromium` |
| Discovery/flow/guard problem      | problem code                               | exit 1 in check/build                                     | `proto check`                      |
