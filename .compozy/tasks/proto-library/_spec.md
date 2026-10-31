---
slug: proto-library
title: "@compozy/proto — prototypes from real components, reviewed by people and agents"
status: draft
created: 2026-10-30
owner: Pedro Nauck
slice_budget: 8
---

# @compozy/proto

# Part I — Product

## Overview

**Motivating Problem.** The `*.proto.tsx` gallery exists today as three hand-maintained copies (reloaddev
`apps/platform/gallery`, the stack template `packages/gallery`, CompozyOS `web/gallery`), ~11–12.5k lines
each, drifting apart: remote comments and approval only in reloaddev, the network guard and PNG
screenshots only in CompozyOS, configurable specs/roles and multi-app support only in stack, tests in two
of three. Every fix is ported by hand, and a new project can only get the tool by copying a folder whose
shell imports that project's own design system. The simplest end-to-end outcome that solves it:
**a project installs one package, adds one config file and one canvas file, runs `proto dev`, and reviews
a `*.proto.tsx` prototype built from its own components in a gallery whose UI it never wrote** — the same
package then replaces all three copies.

- **Who it is for.** Product engineers and designers who prototype with their real components before
  wiring data; coding agents (the CompozyOS `open-design` profile first) that author prototypes, read
  review comments and answer them through the CLI; reviewers (often the product owner) who comment and
  approve from a browser, locally or on a deployed gallery.
- **Why it is valuable.** Prototypes built from production views are reviewable artifacts that become the
  shipped UI instead of throwaway HTML; comments anchored to JSX source let an agent fix the exact line;
  one maintained package ends the three-way drift and makes the workflow available to every project.

## Goals

- A project goes from `bun add -d @compozy/proto` to a running gallery with `proto init` + `proto dev`,
  without writing gallery UI or importing the gallery's design system.
- Prototypes, states, roles, specs and flows are declared in typed literals that are validated without
  executing them; a broken literal is reported by `proto check` with a stable problem code.
- Reviewers pin comments to an element or region of a rendered state, attach images, reply, resolve and
  approve; every comment records the commit, state, theme, role, viewport and the JSX source chain.
- Agents operate the whole review loop through structured surfaces (`--json` CLI, MCP server, shipped
  skills) with deterministic error codes; nothing requires the browser.
- A deployed, read-only gallery can take remote comments and approvals behind authentication, and the
  same CLI answers them with `--remote`.
- Prototypes cannot reach the data layer and gallery code cannot reach the production bundle: both are
  build failures, not conventions.
- Evidence of a rendered state is reproducible: `proto screenshot` (PNG) and `proto evidence` (static
  DOM snapshot) from the same URL contract.
- The three existing copies are deleted after their projects migrate to the package.

## User Stories

- US-001–US-004 — Adoption: install, init, dev, build ([catalog](_user_stories.md#adoption))
- US-005–US-009 — Authoring: prototypes, states, roles, drafts, flows
- US-010–US-015 — Browsing: overview, spec page, flow canvas, screen view, compare, search
- US-016–US-021 — Review: pin, thread, attachments, resolve, approval, inbox
- US-022–US-026 — Agents: CLI JSON, MCP, skills, evidence, open-design record
- US-027–US-030 — Remote review: deploy, sign-in, credentials, remote CLI
- US-031–US-033 — Safety: guards, problems, render failures
- US-034 — Migration of the three existing copies

[Full user stories](_user_stories.md)

## Core Features

1. **Authoring contract** — `definePrototype`, `defineFlow`, `defineProtoConfig`, `PrototypeProps`, URL
   helpers. Literals are read statically (TypeScript AST), never executed by discovery. Prototype kinds:
   _component_ (beside the view it composes, no intrinsic markup allowed) and _draft_
   (`<drafts>/<slug>/index.proto.tsx`, free markup).
2. **Gallery shell** — a prebuilt, self-styled review UI (rail, top bar, sub-header, inspector) with
   areas Overview, Specs, Flows, Screens, Comments, Drafts, Settings; flow canvas with live previews;
   screen canvas with viewport, theme and role controls; compare; ⌘K search; keyboard shortcuts. The
   visual contract is the dark/pink exploration (ADR-006, `_uiux.md`).
3. **Render host** — each state renders in its own iframe from the consumer's Vite pipeline, wrapped in
   the consumer's `Canvas` providers and optional `Frame` chrome; a postMessage handshake reports
   ready/error to the shell, trusted only from its own iframe.
4. **Review comments** — element/region/flow-step targets, threads, author kinds `reviewer`/`agent`,
   image attachments, open/resolved status, source mapping via `data-proto-src`. Local store = versioned
   JSON files in the repo; remote store = the review server.
5. **Approval** — per prototype and per flow: `in_review` → `approved` → (`reopened` → `in_review`).
   Approval is recorded with author, time and commit.
6. **CLI + Node API** — `proto init|dev|build|check|list|new|url|flow|comments|review|screenshot|evidence|
   auth|mcp`, human output by default and `--json` everywhere.
7. **Agent layer** — `proto mcp` (stdio MCP server over the Node API), skills shipped in the package
   (`author-prototype`, `apply-prototype-comments`), and the open-design `target: library` record
   written by `proto init`.
8. **Remote review server** — `@compozy/proto/server`: a fetch-handler that serves a built gallery and the
   comments/attachments/reviews/credentials API, with pluggable storage (filesystem, Postgres) and auth
   (session callback or bearer credential).
9. **Guards** — network guard (runtime imports from configured data modules fail the build), production
   boundary (prototype/fixture/gallery modules in a production bundle fail the build), markup check for
   component prototypes.

Interactions: discovery feeds the shell, CLI, MCP and guards from one registry; comments and approvals
flow through one store interface regardless of local/remote; the shell, CLI and MCP never write comment
files directly — only through the store.

## Business Rules

- **Identity.** A prototype slug is its file stem, or its folder name for `index.proto.tsx`; kebab-case
  (`^[a-z][a-z0-9-]*$`), unique per app, and never starts with `flow-` (reserved for flow comment keys).
  A flow id is its file stem under the flows directory, same pattern.
- **States.** Every prototype declares ≥ 1 state; state ids are unique within a prototype; the first state
  is the default when `?state=` is absent or unknown.
- **Specs and roles** come only from `proto.config.ts`. A prototype or flow naming an unknown spec or role
  is a problem (`unknown_spec`, `unknown_role`), not a silent "Unsorted".
- **Component prototypes** may not render intrinsic JSX (`<div>` …) — problem `markup`; drafts may.
- **Flows.** 14 problem codes: `flow_outside_root`, `invalid_flow_id`, `missing_flow`, `invalid_flow`,
  `unknown_spec`, `unknown_prototype`, `unknown_state`, `unknown_role`, `duplicate_node`, `invalid_node`,
  `unknown_node`, `duplicate_edge`, `unreachable`, `dead_end`; warning `uncovered_state` (a state of a
  prototype used by the flow that no node of any flow covers). Step numbers come from a breadth-first walk
  from `start`.
- **Builds fail** on any discovery or flow problem, any network-guard hit, and any production-boundary
  hit. Warnings never fail a build.
- **Comments.** Each comment has a per-key sequence id that is never reused (deleted ids stay retired);
  messages have ids and optional `editedAt`; status is `open` or `resolved`; resolving requires no reply
  but `--note` adds one. A new comment always records `context.commit` (null only outside git). Element
  targets carry `selector`, `testId`, `tag`, `text` (≤ 120 chars), `source`, `sourceChain` (≤ 8),
  `rect`, `rectNormalized`, `offset`.
- **Attachments.** PNG, JPEG, WebP or GIF; ≤ 5 MB each; ≤ 6 per message; uploads not attached to a sent
  message expire after 24 h.
- **Concurrency.** Writers to one comment key serialize through a per-key lock; a lock older than 10 s is
  stale and may be taken over. Writes are atomic (temp file + rename).
- **Approval.** Only a reviewer approves; approval of a prototype with open comments asks for
  confirmation and records the open count; a new comment on an approved prototype moves it back to
  `in_review` automatically and says so in the thread.
- **Permissions (remote).** Anonymous visitors see the sign-in page only. Reviewers (session or credential
  with `review` scope) read, comment, reply, resolve and approve. Agents use credentials with `comment`
  scope: read, reply, resolve — never approve. Credentials are revocable and shown once.
- **Read-only build.** A static `proto build` without a configured remote shows comments read-only and
  hides comment/approval affordances (absent, not disabled).
- **Viewport.** Width 320–3840 px; presets desktop 1440, tablet 834, phone 390; `fit` follows the canvas.
- **Defaults.** Dev host `127.0.0.1`, port `4400` (strict; `--port` overrides); default theme `system`;
  screenshot defaults width 1440, theme `light`, output `.proto/evidence/<slug>--<state>--<theme>--<width>.png`.

## User Experience

- **Personas.** Builder (engineer/designer authoring prototypes), Reviewer (product owner commenting and
  approving), Agent (coding agent through CLI/MCP), Operator (sets up the remote review server).
- **First run.** `bun add -d @compozy/proto` → `bunx proto init` (detects Vite app, writes
  `proto.config.ts`, `proto.canvas.tsx`, an example draft, the open-design record, installs skills on
  request) → `bunx proto dev` → the gallery opens on the example draft.
- **Daily loop.** Builder writes `*.proto.tsx` beside a view → gallery hot-reloads → Reviewer presses `C`,
  pins a comment → Agent runs `proto comments list --json`, edits the source line from `sourceChain`,
  runs `proto screenshot`, replies and resolves → Reviewer approves.
- **Remote loop.** Operator deploys `proto build` behind the review server → Reviewer signs in on the
  deployed URL → Agent runs `proto comments list --remote`.
- **Accessibility.** Shell meets WCAG 2.2 AA (contrast, focus-visible, keyboard for every action incl.
  pin placement via keyboard picker), respects reduced motion, ARIA landmarks for rail/top bar/inspector.
- **Discoverability.** `?` opens shortcuts; empty states teach the next command; ⌘K reaches every
  prototype, state, flow, comment and action. Surface map: [_uiux.md](_uiux.md).

## High-Level Technical Constraints

- React 19 and Vite ≥ 7 consumers; Node ≥ 22 or Bun ≥ 1.3 for the CLI. The shell must not depend on the
  consumer's styles, Tailwind setup or component library.
- Prototypes run the consumer's real code; the gallery never executes prototype or flow modules in Node.
- Local comments are plain files in the repository so they can be reviewed in PRs.
- Remote review stores user content (comments, images): authenticated access only, credentials hashed
  at rest, attachments served with `Content-Disposition` and no script execution.
- Agent manageability: every review action is available through CLI `--json` and MCP with the same
  error codes; the browser is never required.
- Extension ecosystem: none in v1 beyond the documented config hooks (`guards`, `canvas`, `frame`,
  storage/auth adapters for the server).

## Non-Goals (Out of Scope)

- Replacing Storybook in v1 (user decision 2026-10-30; may be revisited later).
- Syncing local comment files with a remote server; a project chooses where a review happens.
- Frameworks other than React + Vite (no Next.js/webpack render host in v1).
- Visual regression diffing and pixel baselines (screenshots are evidence, not assertions).
- Hosting a SaaS: the review server is self-hosted by the project.
- Roles/permissions beyond reviewer and agent scopes.

## Open Questions

- Q1: Publish under `@compozy/proto` on npm public as **experimental 0.x** until the three migrations
  land? (Assumed yes — ADR-001.)
- Q2: Should the remote server ship a Google OAuth helper (reloaddev uses better-auth + Google) or only
  the `authorize(request)` callback? (Assumed callback + bearer credentials in v1.)
- Q3: Is the shell copy English-only in v1 with a `locale` key reserved, given reloaddev reviews in PT-BR?
  (Assumed `en` + `pt-BR` bundles — ADR-006 notes.)

---

# Part II — Technical

## Executive Summary

One published package, `@compozy/proto`, built in this repository from the stack template's
`packages/gallery` (the most generic copy), absorbing CompozyOS's network guard, screenshot command,
trusted writes and tests, and reloaddev's remote comments, approval and credential flow. It exposes
subpath entries (`.`, `/flow`, `/config`, `/vite`, `/node`, `/server`, `/mcp`) and a `proto` bin. The
review shell becomes a **prebuilt, self-styled bundle** shipped inside the package and served by the Vite
plugin; prototypes render in iframes from the consumer's own Vite graph, so the shell never touches the
consumer's design system and the consumer never compiles the shell (ADR-002).

All consumers share one registry (discovery), one comment/review store interface with file and HTTP
implementations, and one Node API; CLI, MCP and the dev-server middleware are thin adapters over it
(ADR-003, ADR-005). Configuration collapses `gallery.config.ts`, `vite.presentation.ts` and
`preview/canvas.tsx` into `proto.config.ts` + `proto.canvas.tsx` (ADR-004). The remote server is a
fetch handler with storage/auth adapters; this repository's `apps/api` hosts the reference deployment
and `apps/app` is the dogfood consumer (the shell's own prototypes live there).

## MVP Boundary

MVP = slices 1–5: (1) package skeleton + contract + discovery + `proto dev` rendering a prototype in the
prebuilt shell inside `apps/app` — this alone solves the Motivating Problem; (2) flows + checks + guards;
(3) local comments + approval + CLI JSON; (4) screenshot/evidence + MCP + skills + `proto init`;
(5) shell parity with the visual contract. Post-MVP: (6) remote review server + auth + `--remote`;
(7) migration of CompozyOS, reloaddev and the stack template; (8) docs site. Out of scope: Non-Goals.

## Developer Experience

- [Developer experience contract](_dx.md) — config files, authoring API, CLI verbs and JSON, Vite plugin,
  Node API, MCP tools, server API, errors.
- [UI change map](_uiux.md) — every shell surface and state; visual contract = the `proto-shell` draft.

## System Architecture

```
consumer app ──(vite plugin @compozy/proto/vite)──┐
                                                  ├─ registry (discovery + flows + problems)  ← node API
proto.config.ts / proto.canvas.tsx ───────────────┘          │
                                                             ├── dev middleware  /__proto/api/*  (store, registry, events)
prebuilt shell (dist/shell) ── served at / ──────────────────┤
  └─ iframes → /__proto/render/<slug>?state=… (consumer Vite) ├── CLI `proto …` (human | --json)
                                                             ├── MCP `proto mcp` (stdio)
review store ── FileStore (repo files) | HttpStore (remote) ─┘
remote: @compozy/proto/server(fetch) → Storage (fs | postgres) + Auth (session callback | credential)
```

- **Registry** (`src/node/registry`): discovery of prototypes (AST literal reader), flows, specs/roles from
  config, problems/warnings; watch mode emits change events.
- **Vite plugin** (`src/vite`): virtual modules for the render host (`virtual:proto/registry`,
  `virtual:proto/canvas`), source-tags transform, guards, dev middleware mounting the API and serving
  the shell assets; build mode emits shell + render host to `outDir`.
- **Render host** (`src/render`): iframe entry inside the consumer graph: resolves the prototype lazily,
  wraps it in `Canvas`/`Frame`, theme/role/state from URL, error boundary, postMessage handshake.
- **Shell** (`src/shell`, built to `dist/shell`): the review UI; talks only to `/__proto/api` and to its
  iframes; owns its styles (Tailwind v4 compiled with a `proto-` scope) and its vendored BnUI components.
- **Store** (`src/store`): `ReviewStore` interface; `FileStore` (JSON v2 + attachments + locks + trusted
  writes) and `HttpStore` (remote API client with credentials).
- **CLI / MCP** (`src/cli`, `src/mcp`): adapters over the Node API.
- **Server** (`src/server`): fetch handler, routes, storage and auth adapters.

## Architectural Boundaries

- `src/contract`, `src/flow` (published `.` and `/flow`): React types and pure helpers only; no Node, no
  shell imports.
- `src/shell` may import `src/model` (pure comment/flow models) and its own `ui/`; never `src/node`,
  `src/store` file implementations, or anything from the consumer.
- `src/render` may import the consumer modules through virtual modules only; never `src/shell`.
- `src/node`, `src/store`, `src/cli`, `src/mcp` are Node-only; `src/server` is runtime-agnostic (fetch
  API) and imports `src/model` + storage adapters only.
- `apps/app` consumes the package only through its public entries (`@compozy/proto`, `/flow`, `/config`,
  `/vite`) — it is the contract test. `apps/api` mounts `@compozy/proto/server`.
- No import of `@proto/ui` from `packages/proto`: the shell vendors the components it needs (ADR-002).

## Implementation Design

### Core Interfaces

```ts
// @compozy/proto (authoring)
export type PrototypeState = { id: string; label: string };
export type PrototypeMeta = {
  title: string;
  spec?: string;
  surface?: string;
  route?: string;
  blocks?: readonly string[];
  states: readonly [PrototypeState, ...PrototypeState[]];
  roles?: readonly [string, ...string[]];
  standalone?: boolean;
};
export type PrototypeProps = { state: string; role: string | null };
export declare function definePrototype<const M extends PrototypeMeta>(meta: M): M;
export declare function useSearch(): string;
export declare function setParam(name: string, value: string | null): void;
export declare function setParams(
  values: Record<string, string | null>,
  options?: { push?: boolean }
): void;
export declare function protoHref(slug: string, state?: string): string;

// @compozy/proto/config
export type ProtoConfig = {
  title: string;
  prototypes?: string | readonly string[]; // default "src/**/*.proto.tsx"
  drafts?: string; // default "src/drafts"
  flows?: string; // default "flows"
  canvas?: string; // default "proto.canvas.tsx"
  specs?: Readonly<Record<string, string>>;
  roles?: Readonly<Record<string, string>>;
  siteUrl?: string;
  locale?: "en" | "pt-BR";
  guards?: { forbidRuntimeImports?: readonly string[]; productionBoundary?: boolean };
  review?: { remote?: { url: string } };
  evidence?: { dir?: string }; // default ".proto/evidence"
};
export declare function defineProtoConfig<const C extends ProtoConfig>(config: C): C;

// proto.canvas.tsx (consumer) exports
export type CanvasProps = { children: ReactNode; theme: "light" | "dark"; role: string | null };
export type FrameProps = { route: string; role: string | null; state: string; children: ReactNode };

// @compozy/proto/node
export interface ProtoProject {
  readonly root: string;
  readonly config: ResolvedProtoConfig;
  registry(): Promise<Registry>; // prototypes, flows, problems, warnings
  watch(onChange: (registry: Registry) => void): () => void;
  store(options?: { remote?: boolean }): ReviewStore;
  url(target: UrlTarget, options?: { remote?: boolean }): string;
  screenshot(target: CaptureTarget): Promise<{ path: string; width: number; height: number }>;
  evidence(target: CaptureTarget): Promise<{ path: string }>;
}
export declare function loadProject(cwd: string): Promise<ProtoProject>;

export interface ReviewStore {
  list(filter?: CommentFilter): Promise<CommentThread[]>;
  get(key: string, id: number): Promise<CommentThread>;
  add(key: string, input: NewComment): Promise<CommentThread>;
  reply(key: string, id: number, input: NewMessage): Promise<CommentThread>;
  setStatus(
    key: string,
    id: number,
    status: "open" | "resolved",
    note?: NewMessage
  ): Promise<CommentThread>;
  editMessage(key: string, id: number, messageId: string, body: string): Promise<CommentThread>;
  remove(key: string, id: number): Promise<void>;
  attach(file: AttachmentInput): Promise<PendingAttachment>;
  review(key: string): Promise<ReviewRecord>;
  setReview(
    key: string,
    input: { status: "approved" | "in_review"; author: Author; commit: string | null }
  ): Promise<ReviewRecord>;
}

// @compozy/proto/server
export type ReviewServerOptions = {
  storage: ReviewStorage; // fileStorage(dir) | postgresStorage(sql)
  authorize: (request: Request) => Promise<Principal | null>; // session callback; bearer handled internally
  gallery?: { dir: string }; // serves a `proto build` output
  basePath?: string; // default "/"
};
export declare function createReviewServer(
  options: ReviewServerOptions
): (request: Request) => Promise<Response>;
```

### Data Models

- **Comments file** `<app>/proto/comments/<key>/comments.json` (key = slug or `flow-<id>`), version 2:
  `{ version: 2, sequence: number, comments: Comment[] }`; `Comment = { id, status, target: ElementTarget |
  NodeTarget, context: CommentContext, messages: Message[], createdAt }`; `Message = { id, author:
  { kind: "reviewer" | "agent", name }, body, attachments: Attachment[], createdAt, editedAt? }`.
  Attachments beside it in `attachments/<id>.<ext>`. Pending uploads in `attachments/pending/` (gitignored).
- **Review file** `<app>/proto/reviews/<key>.json`: `{ status: "in_review" | "approved", author, commit,
  updatedAt, openAtApproval }`. JSON because it is one record per key, opaque to queries.
- **Postgres storage** (server): side-tables because filters match on them — `proto_comments(key, id,
  status, target jsonb, context jsonb, created_at)`, `proto_messages(comment_pk, id, author_kind,
  author_name, body, created_at, edited_at)`, `proto_attachments(id, message_pk null, mime, bytes, data
  bytea, created_at)`, `proto_reviews(key pk, status, author, commit, updated_at)`,
  `proto_credentials(id, name, scopes text[], hash, created_at, last_used_at, revoked_at)`. Target/context
  stay JSON: opaque anchors never filtered server-side.
- **Credentials file (CLI)** `~/.config/compozy-proto/credentials.json`, mode 0600, `{ [origin]: { token,
  name, scopes } }`; env `PROTO_REMOTE_URL`, `PROTO_REMOTE_TOKEN` override. Tokens `pcr_<32 hex>`, stored
  hashed (SHA-256) server-side.
- **Registry entry** (JSON from `proto list --json`): `{ slug, kind: "component" | "draft", file, title,
  spec, surface, route, roles, states, standalone }`.

### API Endpoints

Dev middleware and remote server expose the same API under `/__proto/api` (dev) or `<basePath>api`
(remote); handlers validate with zod, return `{ error: { code, message } }` on failure:

- `GET registry` · `GET comments?key=&status=&state=` · `POST comments` · `POST comments/:key/:id/replies`
  · `PATCH comments/:key/:id/status` · `PATCH comments/:key/:id/messages/:messageId` · `DELETE
  comments/:key/:id` · `POST attachments` (multipart, 413 `attachment_too_large`, 415
  `attachment_type`) · `GET attachments/:id` · `GET reviews/:key` · `PUT reviews/:key` · remote only:
  `POST credentials` (201, token shown once), `GET credentials`, `DELETE credentials/:id`, `GET session`.
- Dev middleware rejects writes whose `Origin` is not the dev server (403 `cross_origin_write`).
- Events: dev → Vite HMR `proto:registry` and `proto:comments`; remote → `GET events` (SSE) with the same
  payloads.

Client-visible examples: [_dx.md § HTTP API](_dx.md#http-api).

## Integration Points

- **Vite** (plugin API, `configureServer`, `transform`, `resolveId/load`, `generateBundle`).
- **Playwright Chromium** for `screenshot`/`evidence` (optional peer; `proto screenshot` explains how to
  install when missing: exit 3 `playwright_missing`).
- **git** for `context.commit` (`git rev-parse HEAD`; null when not a repo).
- **Postgres** through `postgres.js` for `postgresStorage` (optional peer).
- **MCP** stdio transport via `@modelcontextprotocol/sdk`.

## Impact Analysis

| Component                                                             | Impact Type                  | Description and Risk                                                                                                               | Required Action |
| --------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `proto/packages/gallery`                                              | modified → renamed           | Becomes `packages/proto` (`@compozy/proto`); shell decoupled from `@proto/ui`. Medium risk (largest refactor).                     | Slice 1–5       |
| `proto/apps/app`                                                      | modified                     | Dogfood consumer; hosts the shell's own prototypes (`drafts/proto-shell`, migrated from stack).                                    | Slice 1, 5      |
| `proto/apps/api`                                                      | modified                     | Mounts `@compozy/proto/server` as the reference remote.                                                                            | Slice 6         |
| `proto/packages/db`                                                   | modified                     | Postgres migrations for the review tables.                                                                                         | Slice 6         |
| CompozyOS `web/gallery`                                               | deleted (consumer migration) | Internal code: hard cut, `web` adopts the package; keep `network-graph` semantics via `guards`.                                    | Slice 7         |
| reloaddev `apps/platform/gallery` + `apps/api/src/modules/prototypes` | deleted (consumer migration) | Internal code: hard cut; existing remote comments exported to the new server tables.                                               | Slice 7         |
| stack `packages/gallery`                                              | deleted (template update)    | Template depends on `@compozy/proto`; `drafts/proto-shell` removed from the template.                                              | Slice 7         |
| Comment files v2 in consumers                                         | user state                   | Format unchanged (v2); path moves `gallery/comments` → `proto/comments` via `proto migrate comments` (lossless move, git-tracked). | Slice 7         |

Delete targets carry no compatibility shims: they are internal code of their repositories. The package's
own public surface is new and documented `experimental` until 1.0.

## Extensibility Integration Plan

Extension points are configuration, not plugins: `canvas`/`frame` exports, `guards`, `review.remote`,
and server `storage`/`authorize` adapters. CompozyOS integration: the open-design extension's
`target: library` record is written by `proto init` (`docs/design/prototyping.md`), its `evidence`
command becomes `proto evidence {slug} --state <id>` (HTML, accepted by `lint_artifact`) and
`screenshot` remains available. The `eng-prototype-comments` skill in CompozyOS is replaced by the
shipped `apply-prototype-comments` skill.

## Agent Manageability Plan

CLI verbs with `--json` for every read and write, stable exit codes (0 ok, 1 problems/user error, 2 usage,
3 missing dependency, 4 remote/auth), MCP tools mirroring them (`proto_list`, `proto_check`, `proto_url`,
`proto_comments_list`, `proto_comments_show`, `proto_comments_reply`, `proto_comments_resolve`,
`proto_review_status`, `proto_screenshot`, `proto_evidence`, `proto_flow_show`), and the skills
`author-prototype` + `apply-prototype-comments` installed by `proto init --skills`. Details: `_dx.md`.

## Config Lifecycle

`proto.config.ts` is the only config file; loaded by Vite (plugin), CLI and MCP through `loadProject`;
validated with zod at load (exit 1 `invalid_config` with the path of the bad key). No env-based config
beyond `PROTO_REMOTE_URL`/`PROTO_REMOTE_TOKEN`/`PROTO_PORT`. `proto init` writes it; `proto check`
validates it. No `config.toml` is involved.

## Testing Approach

Vitest for unit/integration (Node project for registry, store, CLI, server; browser project with
Playwright Chromium for shell and render host). Fixtures are small consumer apps under
`packages/proto/test/fixtures/*`. The E2E suite runs `apps/app` through `proto dev`/`proto build` and the
CLI transcripts of `_dx.md`; remote E2E runs `apps/api` against a per-suite Postgres database
(`TEST_DATABASE_URL`). Fakes only at I/O boundaries (git, Playwright in unit tests). Cases: [_tests.md](_tests.md).

## Development Sequencing

### Build Order

1. Package skeleton (`packages/proto`, exports, bin), contract + config types, `loadProject`, registry
   (port discovery/literal/flows from `packages/gallery`) — gate: registry unit suite.
2. Render host + Vite plugin (virtual modules, source tags, dev middleware) + prebuilt shell build
   pipeline with the current shell UI moved off `@proto/ui` — gate: `apps/app` `proto dev` E2E.
3. Guards (network guard from CompozyOS `network-graph.ts`, production boundary, markup) + `proto check`.
4. `ReviewStore` + `FileStore` (port comments/attachments stores + CompozyOS locks/trusted writes) +
   reviews + CLI `comments`/`review` + dev API — gate: store + CLI suites.
5. `screenshot`/`evidence` (Playwright), `proto init`, MCP, skills.
6. Shell redesign to the visual contract (S1–S19 in `_uiux.md`) — consumes 2 and 4.
7. Server (`createReviewServer`, storages, auth, credentials) + `HttpStore` + `--remote` + `apps/api`.
8. Migrations of consumers; template update; deletion of copies.

### Technical Dependencies

npm scope `@compozy` publishing rights; Playwright Chromium in CI; Postgres in CI for server suites
(already in the template's CI).

## Monitoring and Observability

CLI `--verbose` logs discovery timings and store operations; the server logs one structured line per
request `{ route, status, principal_kind, duration_ms }` and never logs comment bodies or tokens.

## Technical Considerations

### Key Decisions

- Single package with subpath exports instead of a package family — one version, one install (ADR-001).
- Prebuilt isolated shell (ADR-002). Shared store interface for local and remote (ADR-003).
- `proto.config.ts` + `proto.canvas.tsx` replace three files (ADR-004). CLI JSON is canonical, MCP and
  skills wrap it (ADR-005). Visual contract = dark/pink exploration (ADR-006).

### Known Risks

- **Shell CSS isolation**: the shell runs in the top document; consumer CSS loads only in iframes, so
  collisions are limited to the shell's own bundle — low.
- **React version skew**: the shell bundles its own React; the render host uses the consumer's — no shared
  instance, communication via postMessage only.
- **Vite major drift**: plugin tested against Vite 7 and 8 in CI.
- **macOS file watching**: polling stays opt-in (`PROTO_POLL=1`) instead of forced.

## Safety Invariants

1. A comment key has at most one writer at a time (lock); a stale lock (> 10 s) is taken over atomically.
2. Comment and review files are written via temp file + rename; a crash never leaves a partial file.
3. Comment ids per key are strictly increasing and never reused.
4. The shell trusts `proto:frame-status` messages only when `event.source` is the iframe it created and
   `event.origin` equals the render origin.
5. Dev writes are accepted only from the dev server origin; remote writes only with an authorized
   principal whose scopes include the action.
6. Discovery never imports or evaluates a prototype or flow module in Node.
7. Agents (credential scope `comment`) can never set a review to `approved`.

## File References

### Repo Files

- `packages/gallery/src/contract.ts:1-82` — today's authoring contract; becomes `@compozy/proto`.
- `packages/gallery/src/config.ts:1-37` — `GalleryConfig`; superseded by `ProtoConfig`.
- `packages/gallery/src/flow.ts:1-101`, `src/flow-graph.ts` — flow types, problem codes, BFS steps.
- `packages/gallery/src/node/discovery.ts`, `src/node/literal.ts` — AST discovery to port as the registry.
- `packages/gallery/src/node/comments-store.ts`, `attachments-store.ts`, `comments-plugin.ts` — FileStore
  and dev API origin.
- `packages/gallery/src/shell/comments/model.ts:1-341` — the comment model (v2) shared by all adapters.
- `packages/gallery/src/node/source-tags.ts` — `data-proto-src` transform.
- `packages/gallery/src/node/presentation-guard.ts`, `production-boundary.ts` — guards to generalize.
- `packages/gallery/src/shell/**` — current shell UI to move onto vendored components and redesign.
- `apps/app/proto…` (after slice 1): `gallery.config.ts`, `vite.presentation.ts`, `preview/canvas.tsx` —
  the three files `proto.config.ts` + `proto.canvas.tsx` replace.
- `docs/design/prototyping.md` — the open-design record format `proto init` writes.

### External Sources (other repositories, cited by path)

- `~/Dev/compozy/compozy/web/gallery/node/network-graph.ts` — runtime-import graph for the network guard.
- `~/Dev/compozy/compozy/web/gallery/node/trusted-write.ts`, `local-comments.ts` — atomic writes + locks.
- `~/Dev/compozy/compozy/web/gallery/cli/commands/screenshot.ts` — Playwright PNG capture.
- `~/Dev/compozy/compozy/web/gallery/__tests__/*` — the five existing suites to port.
- `~/Dev/courses/reloaddev/apps/api/src/modules/prototypes/{routes,reviews,credentials,attachment-routes,gallery}.ts`
  — remote API, approval, credentials, gallery serving.
- `~/Dev/courses/reloaddev/apps/platform/gallery/cli/remote-auth.ts`, `remote-comments.ts` — CLI remote flow.
- `~/Dev/courses/reloaddev/packages/db/src/schema/prototypes.ts` — remote schema to evolve.
- `~/Dev/courses/reloaddev/.agents/skills/apply-prototype-comments/SKILL.md` and CompozyOS
  `.agents/skills/eng/eng-prototype-comments/SKILL.md` — skills to merge.
- `~/Dev/compozy/compozy/extensions/open-design/skills/open-design/SKILL.md` — consumer of the record.

### Design and Analysis Sources

- `~/Dev/compozy/stack/apps/app/src/drafts/proto-shell/` — the shell visual contract (dark, pink primary),
  completed per `_uiux.md`; migrates into `apps/app/src/drafts/proto-shell/` here in slice 1.
- reui-blocks `flow-2` (AI Agent Builder), `flow-1`, `app-shell-1`, `whiteboard-1` — component references.

## Assumptions and Defaults

- Package name `@compozy/proto`, MIT, 0.x experimental; bin `proto`.
- Directory for review data `proto/` at the app root (`proto/comments`, `proto/reviews`); evidence
  `.proto/evidence` (gitignored).
- Dev port 4400 strict; render origin = dev origin (same-origin iframes under `/__proto/render`).
- Default `forbidRuntimeImports`: none (the consumer lists its data modules); `productionBoundary: true`.
- Shell locales `en` (default) and `pt-BR`.
- Remote auth: bearer credentials + `authorize(request)` callback for browser sessions.

## Architecture Decision Records

- [ADR-001: One package with subpath exports](adrs/adr-001.md) — `@compozy/proto` with `.`, `/flow`,
  `/config`, `/vite`, `/node`, `/server`, `/mcp` and a `proto` bin.
- [ADR-002: Prebuilt, isolated shell; prototypes in consumer iframes](adrs/adr-002.md)
- [ADR-003: One ReviewStore for local files and the remote server](adrs/adr-003.md)
- [ADR-004: proto.config.ts + proto.canvas.tsx replace three files](adrs/adr-004.md)
- [ADR-005: CLI JSON is the agent contract; MCP and skills wrap it](adrs/adr-005.md)
- [ADR-006: Shell visual contract — dark canvas, pink primary](adrs/adr-006.md)
