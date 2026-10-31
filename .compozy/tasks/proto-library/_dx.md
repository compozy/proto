# Developer Experience: @compozy/proto

Public-surface contract for `@compozy/proto`. Companion to `_spec.md` (Part II serves this surface) and
`_tests.md` (the CLI contract suite asserts the `--json` shapes and exit codes shown here against a seeded
fixture; human output below is illustrative and not frozen).

## Golden Path

```console
$ bun add -d @compozy/proto
$ bunx proto init
✓ proto.config.ts
✓ proto.canvas.tsx
✓ src/drafts/welcome/index.proto.tsx
✓ vite.config.ts (added proto())
✓ docs/design/prototyping.md
Next: bunx proto dev

$ bunx proto dev
proto  ready in 412 ms
  ➜  Gallery  http://127.0.0.1:4400/
  ➜  Render   http://127.0.0.1:4401/  (prototypes run here)
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

The gallery lists **Authentication → Sign in** with two states without a reload.

## Config files

`proto.config.ts` (app root; read by the Vite plugins, the CLI and `proto mcp`):

```ts
import { defineProtoConfig } from "@compozy/proto/config";

export default defineProtoConfig({
  title: "Acme",
  prototypes: "src/**/*.proto.tsx", // default
  drafts: "src/drafts", // default; drafts may use free markup
  flows: "flows", // default; *.flow.ts files
  canvas: "proto.canvas.tsx", // default
  specs: { auth: "Authentication", billing: "Billing" }, // or (root) => Record<string, string> | null
  roles: { member: "Member", admin: "Admin" },
  siteUrl: "https://acme.com", // resolves `site` nodes in flows
  locale: "en", // shell copy: "en" | "pt-BR"
  guards: {
    // module ids, globs or RegExp; checked only for graphs rooted at prototypes, drafts and stories
    forbidRuntimeImports: [
      "src/lib/api.ts",
      "src/lib/gateway-*.ts",
      /^@tanstack\/react-query$/,
      "better-auth",
    ],
    productionBoundary: true, // default
  },
  review: { remote: { url: "https://acme.com/proto/" } }, // optional; default `--remote` target for CLI/MCP
  evidence: { dir: "docs/design" }, // default, relative to the app root; files under docs/design/<slug>/
  build: { includeReview: false }, // default; true ships review history in static builds
  dev: { port: 4400, poll: false, allowedHosts: [] }, // render origin = port + 1; Host allowlist extras
});
```

`proto.canvas.tsx`:

```tsx
import type { CanvasProps, FrameProps } from "@compozy/proto";
import "./src/styles.css"; // the app's CSS loads inside the render origin only
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

`vite.config.ts` — one plugin; in the app's own `vite dev`/`vite build` it only enforces the production
boundary:

```ts
import { proto } from "@compozy/proto/vite";
export default defineConfig({ plugins: [react(), tailwindcss(), proto()] });
```

Storybook and Vitest keep the guards with `protoPresentation()`:

```ts
// .storybook/main.ts
import { protoPresentation } from "@compozy/proto/vite";
export default defineMain({
  framework: "@storybook/react-vite",
  viteFinal: config => ({ ...config, plugins: [...(config.plugins ?? []), protoPresentation()] }),
});

// vitest.config.ts
import { protoPresentation } from "@compozy/proto/vite";
export default defineConfig({
  plugins: [react(), protoPresentation({ sourceTags: false })] /* … */,
});
```

Effect: `vite build` of the app fails if a `.proto.tsx`, a prototype fixture or gallery code reaches the
production bundle; a story or prototype whose runtime imports reach `src/lib/api.ts` fails Storybook, Vitest
and `proto build`, while application routes may import it.

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

Shell origin (`http://127.0.0.1:4400` in dev):

| URL                                                         | Shows                                              |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `/`                                                         | Overview                                           |
| `/?spec=auth`                                               | Spec page                                          |
| `/?flow=sign-in&node=error`                                 | Flow canvas, step selected                         |
| `/?p=login-form&state=error&w=1440&theme=dark&role=admin`   | Screen view                                        |
| `/?p=login-form&state=error&compare=themes`                 | Compare                                            |
| `/?comments=open`                                           | Comments inbox (`open` \| `waiting` \| `resolved`) |
| `/?p=login-form&comment=login-form-7`                       | Screen view with thread #7 focused                 |
| `/?drafts` · `/?settings=credentials` · `/?settings=health` | Drafts · Settings sections                         |
| `/__proto/bootstrap.json`                                   | Runtime bootstrap for the shell                    |

Render origin (`http://127.0.0.1:4401` in dev; `renderOrigin` remotely):

| URL                                                                     | Shows                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `/__proto/render/login-form?state=error&theme=dark&role=admin&chrome=0` | The bare state (iframe, screenshot and evidence target) |

## CLI

Every command accepts `--app <dir>` (default: cwd), `--json`, `--verbose` and, where marked, `--remote`.
Exit codes: 0 ok · 1 problems/user error · 2 usage · 3 missing dependency · 4 remote/auth.

### proto list

```console
$ proto list
auth  login-form       Sign in       A1  /login  2 states
—     welcome (draft)  Welcome home  D1  /       2 states
2 prototypes · 1 flow

$ proto list --json
{"prototypes":[{"slug":"login-form","kind":"component","file":"src/components/login-form.proto.tsx","title":"Sign in","spec":"auth","surface":"A1","route":"/login","roles":[],"standalone":true,"states":[{"id":"sign-in","label":"Sign in"},{"id":"error","label":"Wrong password"}]},{"slug":"welcome","kind":"draft","file":"src/drafts/welcome/index.proto.tsx","title":"Welcome home","spec":null,"surface":"D1","route":"/","roles":[],"standalone":false,"states":[{"id":"default","label":"First steps"},{"id":"done","label":"All done"}]}],"flows":[{"id":"sign-in","title":"Sign in","spec":"auth","steps":4}]}
```

### proto check

```console
$ proto check
✗ src/systems/billing/invoice.proto.tsx:14:7  markup  Component prototypes compose views; move <div> into the view or use a draft.
✗ flows/checkout.flow.ts  unknown_state  Node "paid" uses state "done" that invoice has not declared.
! flows/sign-in.flow.ts  uncovered_state  welcome state "done" is in no flow.
2 problems · 1 warning
$ echo $?
1

$ proto check --json
{"problems":[{"code":"markup","file":"src/systems/billing/invoice.proto.tsx","line":14,"column":7,"message":"Component prototypes compose views; move <div> into the view or use a draft."},{"code":"unknown_state","file":"flows/checkout.flow.ts","node":"paid","message":"Node \"paid\" uses state \"done\" that invoice has not declared."}],"warnings":[{"code":"uncovered_state","file":"flows/sign-in.flow.ts","proto":"welcome","state":"done"}]}
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
{"id":"sign-in","title":"Sign in","steps":[{"id":"site","step":1,"kind":"external"},{"id":"sign-in","step":2,"kind":"prototype","proto":"login-form","state":"sign-in"},{"id":"error","step":3,"kind":"prototype","proto":"login-form","state":"error"},{"id":"home","step":4,"kind":"prototype","proto":"welcome","state":"default"}],"edges":[{"from":"site","to":"sign-in","on":"Sign in","kind":"navigate"},{"from":"sign-in","to":"error","on":"Wrong password","kind":"overlay"},{"from":"error","to":"home","on":"Signed in","kind":"redirect"}],"problems":[],"warnings":[]}

$ proto flow coverage --json
{"uncovered":[{"proto":"welcome","state":"done"}]}
```

### proto url

```console
$ proto url login-form --state error
http://127.0.0.1:4400/?p=login-form&state=error
$ proto url login-form --state error --bare
http://127.0.0.1:4401/__proto/render/login-form?state=error&chrome=0
```

### proto comments

Comment ids are `<key>-<n>` (key = slug or `flow-<id>`).

```console
$ proto comments list
login-form-7  error  reviewer  4m   The error should sit under the password field…   src/components/login-form.tsx:58:27
login-form-6  error  reviewer  12m  Keep the title as "Sign in" in the error state.    src/components/login-form.tsx:31:11
2 open

$ proto comments show login-form-7 --json
{"id":"login-form-7","slug":"login-form","status":"open","createdAt":"2026-10-30T22:41:03.000Z","updatedAt":"2026-10-30T22:41:03.000Z","resolvedAt":null,"context":{"commit":"a41c9e2f0b7d4c6e8a1b2c3d4e5f60718293a4b5","state":"error","theme":"dark","role":null,"viewport":{"width":1024,"height":640}},"target":{"kind":"element","selector":"[data-testid=login-error]","testId":"login-error","tag":"p","text":"Invalid email or password","source":"src/components/login-form.tsx:58:27","sourceChain":["src/components/login-form.tsx:58:27","src/components/login-form.proto.tsx:21:5"],"rect":{"x":360,"y":351,"width":178,"height":20},"rectNormalized":{"x":0.3516,"y":0.5484,"width":0.1738,"height":0.0313},"offset":null},"thread":[{"id":"6f1c2b0e-8a4d-4c1e-9b2f-1d3e5a7c9b10","at":"2026-10-30T22:41:03.000Z","editedAt":null,"author":"reviewer","body":"The error should sit under the password field, not above the button.","attachments":[]}]}

$ proto comments reply login-form-7 --note "Moved it into the password Field description."
✓ login-form-7 replied (agent)

$ proto comments resolve login-form-7 --note "Fixed in src/components/login-form.tsx."
✓ login-form-7 resolved

$ proto comments add login-form --state error --note "Spacing too tight" --selector "[data-testid=login-error]" --author reviewer
✓ login-form-8 open

$ proto comments attach login-form-7 shot.png
✓ attached a1 to login-form-7 message 2
$ proto comments detach login-form-7 a1
$ proto comments edit login-form-7 --note "Moved it into the Field description (aria-describedby)." --message 2
$ proto comments reopen login-form-7 --note "Still above the button at 390 px."
$ proto comments attachments login-form-7 --out .tmp/c7
✓ .tmp/c7/a1.png
$ proto comments delete login-form-8
$ proto comments list --status open --remote --json
{"comments":[{"id":"login-form-7","status":"open"}]}
```

Filters: `--slug`, `--spec`, `--state`, `--status open|resolved|all`, `--author-kind reviewer|agent`, `--waiting`.

### proto review

```console
$ proto review status login-form --json
{"key":"login-form","status":"in_review","open":2,"events":[]}
$ proto review approve login-form
✗ 2 comments are still open. Re-run with --confirm-open to approve anyway.
$ proto review approve login-form --confirm-open
✓ login-form approved at a41c9e2 (2 open comments recorded)
$ proto review reopen login-form
✓ login-form back in review
$ proto review approve login-form --remote     # credentials are always comment-scope
✗ Approval happens in the browser; credentials cannot approve. (scope_denied)
$ echo $?
4
$ proto review unlock login-form --force        # manual recovery: a lock left by another machine
✓ Removed lock held by host 4c1e…a9 (pid 81233)
```

Local approval is trust-based: anyone with the repository can run it. Agents never approve (skills). Local
review storage is single-host; `unlock` is only for a lock left by another machine or a crashed container.

### proto screenshot / evidence

```console
$ proto screenshot login-form --state error --theme dark --width 1440
✓ docs/design/login-form/error--dark--1440.png (1440×900)

$ proto evidence login-form --state error
✓ docs/design/login-form/index.html (static DOM, no scripts)

$ proto screenshot login-form
✗ Playwright Chromium is not installed. Run: bunx playwright install chromium
$ echo $?
3
```

When no dev server is running, both commands start a temporary one and stop it.

### proto migrate

```console
$ proto migrate --from apps/platform/gallery/comments --flow-prefix fluxo- --theme-map claro=light,escuro=dark --role-map membro=member --dry-run
key                     source  comments  messages  attachments  sequence  notes
assinatura              v1      12        31        4            12
fluxo-membership → flow-membership  v1  3  5  0  3  key renamed
8 keys · 41 comments · 96 messages · 9 attachments · no conflicts

$ proto migrate --from apps/platform/gallery/comments --flow-prefix fluxo- --theme-map claro=light,escuro=dark --role-map membro=member
✓ 8 keys written to apps/platform/proto/review (v3), verified
✓ proto-migration-report.json
Delete when ready: apps/platform/gallery/comments
Switch Storybook and Vitest to protoPresentation(), then delete: vite.presentation.ts, preview/

$ proto migrate --from apps/app/gallery/comments
✓ 1 key already verified, nothing to do

# maintenance window: reloaddev running with PROTOTYPES_READ_ONLY=1, in-flight requests drained
$ proto migrate remote --from-database "$RELOAD_DATABASE_URL" --to-database "$PROTO_DATABASE_URL" \
    --flow-prefix fluxo- --theme-map claro=light,escuro=dark --role-map membro=member --dry-run
source read-only: yes
table                 source  target  status
prototype_reviews     14      14      ok (2 keys renamed fluxo- → flow-)
prototype_comments    57      57      ok
prototype_messages    143     143     ok
attachments           22      22      ok (bytes hashed)
credentials           3       0       not copied — owners re-issue (rpc_ → pcr_)

$ proto migrate remote --from-database "$RELOAD_DATABASE_URL" --to-database "$PROTO_DATABASE_URL" \
    --flow-prefix fluxo- --theme-map claro=light,escuro=dark --role-map membro=member
✓ 14 keys copied and verified; source unchanged during the run
✓ proto-migration-report.json

$ proto migrate remote …        # reloaddev still accepting writes
✗ The source accepted a write probe. Set PROTOTYPES_READ_ONLY=1 and drain requests first. (source_not_read_only)
```

### proto dev / build / init / mcp / auth

```console
$ proto dev --port 4410 --open        # shell 4410, render 4411
$ proto build                         # → dist-proto/ ; exit 1 on any problem
$ proto init --skills                 # also installs author-prototype and apply-prototype-comments
$ proto mcp                           # stdio MCP server
$ proto auth login --remote https://acme.com/proto/
Open https://acme.com/proto/?settings=credentials&cli=1, create a credential and paste it:
✓ Saved credential "pedro-laptop" for https://acme.com/proto/ (scope: comment)
$ proto auth login --remote http://acme.com/proto/
✗ Remote URLs must use HTTPS (loopback excepted). (insecure_remote)
$ proto auth credentials --json      # credentials stored on this machine (no network call)
{"credentials":[{"remote":"https://acme.com/proto/","id":"cr_8f2","name":"pedro-laptop","scopes":["comment"]}]}
$ proto auth revoke cr_8f2 --remote https://acme.com/proto/
✗ Credentials are managed from a browser session: https://acme.com/proto/?settings=credentials
$ proto auth logout --remote https://acme.com/proto/
✓ Removed the local credential for https://acme.com/proto/
```

`auth credentials` lists what is stored locally (tokens never printed); creating, listing and revoking
server-side credentials happen in Settings → Credentials (browser session).

## Node API

```ts
import { loadProject } from "@compozy/proto/node";

const project = await loadProject("apps/app");
const registry = await project.registry();
registry.prototypes.map(p => p.slug); // ["login-form", "welcome"]
const store = project.store(); // { remote: true } → HttpStore
const open = await store.list({ status: "open", waiting: false });
await store.reply("login-form-7", { body: "Done." }, { kind: "agent" });
await project.screenshot({ slug: "login-form", state: "error", theme: "dark", width: 1440 });
```

## HTTP API

Dev: `http://127.0.0.1:4400/__proto/api/…` — every request needs an allowlisted `Host`; writes need
`Origin: http://127.0.0.1:4400` (`http://localhost:4400` redirects there). Remote (the deployment from
§ Server): `https://acme.com/proto/api/…` with either a session cookie — writes also need
`Origin: https://acme.com` and `X-Proto-Request: 1` — or `Authorization: Bearer pcr_…` (no extra headers),
never both.

```http
GET /proto/api/comments?key=login-form&status=open
200 {"comments":[{"id":"login-form-7","status":"open", …}]}

POST /proto/api/comments          (session, reviewer)
{"key":"login-form","target":{…},"context":{…},"body":"Spacing too tight","attachments":["at_01"]}
201 {"comment":{"id":"login-form-8","thread":[{"author":"reviewer","authorId":"usr_4f2","authorName":"Pedro Nauck", …}]}}

POST /proto/api/comments/login-form-7/replies      (bearer)
{"body":"Moved it into the Field description."}
201 {"comment":{"id":"login-form-7","thread":[…,{"author":"agent","authorId":"usr_4f2","authorName":"Pedro Nauck · codex-ci", …}]}}

POST /proto/api/comments          (target.source = "../../.github/workflows/ci.yml:1:1")
422 {"error":{"code":"invalid_source","message":"Source paths must stay inside the app's source roots."}}

PATCH /proto/api/comments/login-form-7/status   {"status":"resolved","note":"Fixed."}
200 {"comment":{"id":"login-form-7","status":"resolved", …}}

PATCH /proto/api/comments/login-form-7/messages/6f1c…   {"body":"edited"}
403 {"error":{"code":"message_not_owned","message":"Only the author can edit this message."}}

POST /proto/api/attachments?key=login-form   (multipart: file)
201 {"attachment":{"id":"at_01","name":"shot.png","type":"image/png","size":184220,"width":1440,"height":900,"expiresAt":"2026-10-31T22:41:00Z"}}
413 {"error":{"code":"attachment_too_large","message":"Images are limited to 5 MB."}}

POST /proto/api/reviews/login-form/transitions   {"to":"approved","confirmOpen":true}    (session, review)
200 {"review":{"status":"approved","events":[{"type":"approved","authorName":"Pedro Nauck","commit":"a41c9e2f…","openCount":2}]}}
403 {"error":{"code":"scope_denied","message":"Approval happens in the browser; credentials cannot approve."}}   (bearer)

POST /proto/api/credentials   {"name":"codex-ci"}     (session only; scope is always comment)
201 {"credential":{"id":"cr_9a1","name":"codex-ci","scopes":["comment"],"token":"pcr_3b1f9e07…(64 hex)"}}

GET /proto/api/comments   (no session, no bearer)
401 {"error":{"code":"auth_required","message":"Sign in to review.","signInUrl":"https://acme.com/proto/sign-in?returnTo=%2Fproto%2F"}}

GET /proto/?p=login-form&state=error     (document, no session)
302 Location: /proto/sign-in?returnTo=%2Fproto%2F%3Fp%3Dlogin-form%26state%3Derror

GET /proto/api/events   (text/event-stream, dev and remote)
event: comments   data: {"key":"login-form"}
```

## Server

```ts
// apps/api/src/proto.ts — gallery and API at https://acme.com/proto/, render at https://acme-proto.net
import { createReviewServer, postgresStorage } from "@compozy/proto/server";
import { sql } from "./db";
import { auth } from "./auth"; // better-auth; session cookie is host-only, Secure, HttpOnly

const storage = postgresStorage(sql);
await storage.migrate(); // shipped DDL; pg_advisory_lock makes concurrent deploys safe

const identity = (user: { id: string; name: string; isAdmin: boolean } | null) =>
  user?.isAdmin ? { id: user.id, name: user.name, scopes: ["review", "comment"] as const } : null;

export const protoReview = createReviewServer({
  storage,
  basePath: "/proto/",
  publicOrigin: "https://acme.com",
  renderOrigin: "https://acme-proto.net",
  ticketSecret: process.env.PROTO_TICKET_SECRET!,
  gallery: { dir: "../app/dist-proto" },
  // returnTo arrives as "/proto/?p=login-form&state=error" — forward it unchanged.
  signIn: (_request, returnTo) =>
    Response.redirect(`https://acme.com/login?next=${encodeURIComponent(returnTo)}`, 302),
  authorize: async request =>
    identity((await auth.api.getSession({ headers: request.headers }))?.user ?? null),
  credentialOwner: async ownerId => identity(await auth.api.getUser({ id: ownerId })),
});
// Hono on acme.com:        app.all("/proto/*", c => protoReview(c.req.raw));
// Hono on acme-proto.net:  app.all("*", c => protoReview(c.req.raw));   // the handler dispatches on Host
```

Requirements: the gallery and the API share `publicOrigin` (no CORS is offered); `renderOrigin` is a
different registrable domain (the server refuses `render.acme.com` unless `allowSameSiteRender: true`); the
session cookie has no `Domain` attribute. Sessions become `reviewer` principals; bearer credentials become
`agent` principals named `<owner> · <credential>` with scope `comment ∩ owner scopes`.

## MCP

`proto mcp` (stdio). Tools are generated from the capability catalog; results equal the CLI `--json`:

```json
{"name":"proto_comments_list","arguments":{"status":"open"}}
→ {"comments":[{"id":"login-form-7","status":"open","target":{"source":"src/components/login-form.tsx:58:27"}, …}]}

{"name":"proto_comments_attachments","arguments":{"id":"login-form-7"}}
→ {"files":[".tmp/proto/login-form-7/a1.png"]}

{"name":"proto_comments_resolve","arguments":{"id":"login-form-7","note":"Fixed.","remote":true}}
→ {"comment":{"id":"login-form-7","status":"resolved"}}
```

Tools: `proto_list`, `proto_check`, `proto_url`, `proto_flow_show`, `proto_flow_list`, `proto_flow_coverage`,
`proto_new`, `proto_flow_new`, `proto_comments_list`, `proto_comments_show`, `proto_comments_add`,
`proto_comments_reply`, `proto_comments_resolve`, `proto_comments_reopen`, `proto_comments_edit`,
`proto_comments_attach`, `proto_comments_detach`, `proto_comments_attachments`, `proto_comments_delete`,
`proto_review_status`, `proto_screenshot`, `proto_evidence`. Not exposed: review approve/reopen (agents never
approve), credentials (browser session only), migrate (operator action), init/dev/build/mcp (process
lifecycle).

## Errors

Generated from `src/model/errors.ts`:

| Code                                                                                   | CLI exit         | HTTP                  | Message points to                                       |
| -------------------------------------------------------------------------------------- | ---------------- | --------------------- | ------------------------------------------------------- |
| `invalid_config`                                                                       | 1                | —                     | the key path in `proto.config.ts`                       |
| `not_a_vite_app`                                                                       | 1                | —                     | `--app <dir>`                                           |
| `app_required`                                                                         | 2                | —                     | `--app`                                                 |
| `port_in_use`                                                                          | 1                | —                     | `--port` (moves shell and render ports)                 |
| `slug_taken`                                                                           | 1                | —                     | another slug                                            |
| `comment_not_found`                                                                    | 1                | 404                   | `proto comments list`                                   |
| `message_not_owned`                                                                    | 1                | 403                   | only the author edits                                   |
| `attachment_too_large` / `attachment_type` / `attachment_limit` / `attachment_expired` | 1                | 413 / 415 / 422 / 410 | limits                                                  |
| `key_busy`                                                                             | 1                | 409                   | retry                                                   |
| `cross_origin_write`                                                                   | —                | 403                   | open the gallery from its origin                        |
| `ambiguous_credentials`                                                                | 4                | 400                   | send a session or a bearer, not both                    |
| `auth_required` / `invalid_credential` / `credential_revoked`                          | 4                | 401                   | `proto auth login` / sign in                            |
| `scope_denied`                                                                         | 4                | 403                   | a reviewer approves                                     |
| `insecure_remote` / `redirect_refused`                                                 | 4                | —                     | HTTPS URL without redirects                             |
| `schema_mismatch`                                                                      | —                | 503                   | `postgresStorage(sql).migrate()`                        |
| `playwright_missing`                                                                   | 3                | —                     | `bunx playwright install chromium`                      |
| `migration_conflict` / `migration_unverified`                                          | 1                | —                     | the report                                              |
| `migration_source_changed` / `source_not_read_only`                                    | 1                | —                     | put the source in read-only mode, then re-run           |
| `invalid_source`                                                                       | 1                | 422                   | source paths inside the app's source roots              |
| `host_not_allowed`                                                                     | —                | 403                   | open the gallery at 127.0.0.1 or add `dev.allowedHosts` |
| warning `specs_unavailable`                                                            | 0                | —                     | the `specs` function returned null (e.g. in CI)         |
| problem codes (`markup`, `unknown_state`, `network_import`, …)                         | 1 in check/build | —                     | `proto check`                                           |
