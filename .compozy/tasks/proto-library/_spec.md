---
slug: proto-library
title: "@compozy/proto — prototypes from real components, reviewed by people and agents"
status: draft
created: 2026-10-30
updated: 2026-10-30 (peer review round 1 incorporated)
owner: Pedro Nauck
slice_budget: 10
---

# @compozy/proto

# Part I — Product

## Overview

**Motivating Problem.** The `*.proto.tsx` gallery exists today as three hand-maintained copies (reloaddev
`apps/platform/gallery` + `apps/api/src/modules/prototypes`, the stack template `packages/gallery`, CompozyOS
`web/gallery`), ~11–12.5k lines each, drifting apart: remote comments and approval only in reloaddev, the
network guard and PNG screenshots only in CompozyOS, configurable specs/roles and multi-app support only in
stack, tests in two of three. Every fix is ported by hand, and a new project can only get the tool by
copying a folder whose shell imports that project's own design system. The end-to-end outcome that solves
it: **one package replaces all three copies** — a project installs `@compozy/proto`, adds one config file
and one canvas file, runs `proto dev`, reviews `*.proto.tsx` prototypes built from its own components in a
gallery whose UI it never wrote, keeps its existing review history, and deletes its copy.

The drift ends in two gates (ADR-007): **Milestone 1** ends it for the two local-only copies (stack,
CompozyOS) — their copies are deleted with their review files migrated losslessly; **Milestone 2** ends it
for reloaddev, the only copy with remote review, once the review server and its database migration exist.

- **Who it is for.** Product engineers and designers who prototype with their real components before
  wiring data; coding agents (the CompozyOS `open-design` profile first) that author prototypes, read
  review comments and answer them through the CLI or MCP; reviewers (often the product owner) who comment
  and approve from a browser, locally or on a deployed gallery.
- **Why it is valuable.** Prototypes built from production views become the shipped UI instead of
  throwaway HTML; comments anchored to JSX source let an agent fix the exact line; one maintained package
  ends the three-way drift and makes the workflow available to every project.

## Goals

- A project goes from installing the package to a running gallery with `proto init` + `proto dev`, without
  writing gallery UI or importing the gallery's design system.
- Existing review history from all three copies survives migration: every comment, message, attachment,
  timestamp, anchor, approval and retired id.
- Prototypes, states, roles, specs and flows are typed literals validated without executing them; a broken
  literal is reported by `proto check` with a stable problem code.
- Reviewers pin comments to an element, region or flow step, attach images, reply, resolve and approve;
  every comment records the commit, state, theme, role, viewport and the JSX source chain.
- Agents operate the whole review loop — except approval — through the CLI (`--json`) and MCP with the same
  capability catalog and error codes; nothing requires the browser.
- A deployed gallery takes remote comments and approvals behind authentication; prototype code can never
  act as the reviewer.
- Prototypes cannot reach the data layer and gallery code cannot reach the production bundle: both are
  build failures, in the app build, the gallery build and Storybook.
- The three copies are deleted after their projects migrate.

## User Stories

- US-001–US-004 — Adoption: install, init, dev, build
- US-005–US-009 — Authoring: prototypes, states, roles, drafts, flows
- US-010–US-015 — Browsing: overview, spec page, flow canvas, screen view, compare, search
- US-016–US-021 — Review: pin, flow comments, attachments, thread lifecycle, approval, inbox
- US-022–US-026 — Agents: CLI JSON, comment loop, MCP, evidence, skills and the open-design record
- US-027–US-030 — Remote review: deploy, sign-in, credentials, remote CLI
- US-031–US-033 — Safety: guards, problems, render failures
- US-034–US-035 — Migration: local copies; reloaddev remote data

[Full user stories](_user_stories.md)

## Core Features

1. **Authoring contract** — `definePrototype`, `defineFlow`, `defineProtoConfig`, `PrototypeProps`, URL
   helpers. Literals are read statically (TypeScript AST), never executed by discovery. Prototype kinds:
   _component_ (beside the view it composes, no intrinsic markup) and _draft_ (`<drafts>/<slug>/index.proto.tsx`,
   free markup).
2. **Gallery shell** — a prebuilt, self-styled review UI (rail, top bar, sub-header, inspector) with areas
   Overview, Specs, Flows, Screens, Comments, Drafts, Settings; flow canvas with live previews; screen canvas
   with state picker, viewport, theme and role; compare; ⌘K search; shortcuts. Visual contract: ADR-006,
   `_uiux.md`.
3. **Render host** — each state renders in an iframe served from a **separate render origin** by the
   consumer's own Vite pipeline, wrapped in the consumer's `Canvas` and optional `Frame`. Shell and render
   host talk only through a typed postMessage protocol (ready/error, context changes, element picking,
   anchor geometry, scroll) — ADR-008.
4. **Review comments** — element/region/flow-step targets, threads, image attachments, open/resolved status,
   source mapping via `data-proto-src`. Local store = versioned per-key JSON files in the repository;
   remote store = the review server.
5. **Approval** — per prototype and per flow: `in_review` ↔ `approved`. Approve and reopen are transitions
   recorded as events with author, time, commit and the open-comment count; a new comment on an approved
   key reopens it in the same mutation.
6. **CLI + Node API + MCP** — one capability catalog (§ Capability Catalog) drives the Node API, CLI verbs
   (`--json` everywhere) and MCP tools.
7. **Agent kit** — skills shipped in the package (`author-prototype`, `apply-prototype-comments`), the
   open-design `target: library` record written by `proto init`, evidence commands.
8. **Remote review server** — `@compozy/proto/server`: a fetch handler serving a built gallery, the render
   origin and the review API, with shipped Postgres DDL, pluggable storage (filesystem, Postgres) and auth
   (sign-in handoff + bearer credentials bound to an owner).
9. **Guards** — network guard (runtime imports from configured data modules), production boundary, markup
   check; active in the app build, the gallery build and Storybook/Vitest through `protoPresentation()`.
10. **Migration** — `proto migrate` (local copies) and `proto migrate remote` (reloaddev Postgres) with
    verification reports.

## Business Rules

- **Identity.** A prototype slug is its file stem, or its folder name for `index.proto.tsx`; it matches
  `^[a-z0-9]+(?:-[a-z0-9]+)*$` (today's pattern, unchanged), is unique per app and never starts with
  `flow-` (reserved for flow review keys). A flow id follows the same pattern. A **review key** is a slug or
  `flow-<flow id>`; a comment id is `<key>-<n>`.
- **States.** Every prototype declares ≥ 1 state; ids are unique within a prototype; the first state is the
  default when `?state=` is absent or unknown.
- **Specs and roles** come only from `proto.config.ts`. Naming an unknown spec or role is a problem
  (`unknown_spec`, `unknown_role`).
- **Component prototypes** may not render intrinsic JSX — problem `markup`; drafts may.
- **Flows.** 14 problem codes: `flow_outside_root`, `invalid_flow_id`, `missing_flow`, `invalid_flow`,
  `unknown_spec`, `unknown_prototype`, `unknown_state`, `unknown_role`, `duplicate_node`, `invalid_node`,
  `unknown_node`, `duplicate_edge`, `unreachable`, `dead_end`; warning `uncovered_state`. Step numbers come
  from a breadth-first walk from `start`.
- **Builds fail** on any discovery, flow, guard or boundary problem. Warnings never fail a build.
- **Comment ids.** Per key, `sequence` is the highest number ever issued; a new comment gets `sequence + 1`;
  deleted numbers are never reused. Files that never stored a sequence seed it with the highest number
  present (numbers deleted before migration cannot be recovered — stated, not silently assumed).
- **Comments.** Status `open` or `resolved`; resolving accepts an optional note (a reply in the same
  mutation); every comment keeps `createdAt`, `updatedAt`, `resolvedAt`; messages keep `id`, `at`,
  `editedAt`, `attachments`. A new comment records `context.commit` as the full 40-hex SHA (null outside
  git); human output abbreviates to 7.
- **Authorship.** Locally, a message author is `reviewer` or `agent` (the CLI writes `agent` unless
  `--author reviewer`). Remotely, the author is the authenticated principal: `authorKind`, `authorId`
  (stable, opaque) and `authorName` are set by the server, never by the client. A principal edits only its
  own messages and detaches only its own uploads.
- **Attachments.** PNG, JPEG, WebP or GIF; ≤ 5 MB each; ≤ 6 per message; an upload not attached to a sent
  message within 24 h is discarded; a pending upload is claimed once, by its uploader, before expiry.
- **Approval.** Approve and reopen are transitions recorded in the key's event log. Approving with open
  comments requires confirmation and records the open count computed inside the same mutation. A new
  comment on an approved key moves it to `in_review` in the same mutation and records an `auto_reopened`
  event. Remotely only principals with scope `review` approve or reopen. **Locally, approval is
  trust-based**: anyone running the CLI can approve; agents are instructed (skills) never to approve, and
  this is not a security boundary.
- **Concurrency.** All mutations of one key (id allocation, comments, messages, attachment claims, review
  state, events) run inside one per-key critical section — a lock with an owner token locally (Safety
  Invariants 1–4), one transaction with a row lock on the key in Postgres.
- **Permissions (remote).** Anonymous requests reach only the sign-in handoff. Endpoint authority is fixed by
  § Authorization Matrix. Credentials are created, listed and revoked only through a browser session, can
  grant at most the creator's scopes, are bound to the creator and stop working when the creator loses
  access.
- **Read-only build.** A static `proto build` without a remote shows existing threads and images read-only
  and has no comment, approval or credential affordances (absent, not disabled).
- **Viewport.** Width 320–3840 px; presets desktop 1440, tablet 834, phone 390; `fit` follows the canvas.
- **Defaults.** Shell + API origin `http://127.0.0.1:4400`, render origin `http://127.0.0.1:4401` (both
  strict; `--port` moves the pair to `<port>`/`<port+1>`); theme `system`; screenshot width 1440, theme
  `light`; evidence directory `docs/design/<slug>/`.

## User Experience

- **Personas.** Builder, Reviewer, Agent, Operator ([_user_stories.md](_user_stories.md#personas)).
- **First run.** `bun add -d @compozy/proto` → `bunx proto init` → `bunx proto dev` → the gallery opens on
  the example draft.
- **Daily loop.** Builder writes `*.proto.tsx` beside a view → gallery updates → Reviewer presses `C`, pins a
  comment → Agent runs `proto comments list --json`, edits the line from `sourceChain`, runs
  `proto screenshot`, replies and resolves → Reviewer approves.
- **Remote loop.** Operator deploys `proto build` behind the review server → Reviewer signs in through the
  project's sign-in → Agent runs `proto comments list --remote` with a comment-scope credential.
- **Migration.** `proto migrate --dry-run` shows per-key counts; `proto migrate` rewrites files and prints a
  verification report; the old copy is deleted after `proto check` and the project's gates pass.
- **Accessibility.** WCAG 2.2 AA for the shell; every action keyboard-reachable (including pin placement);
  reduced motion respected; landmarks for rail, top bar, inspector.
- **Discoverability.** `?` opens shortcuts; empty states teach the next command; ⌘K reaches every
  prototype, state, flow, comment and action. Surface map: [_uiux.md](_uiux.md).

## High-Level Technical Constraints

- React 19 + Vite ≥ 7 consumers; Node ≥ 22 or Bun ≥ 1.3 for the CLI. The shell never depends on the
  consumer's styles, Tailwind setup or component library.
- Prototypes run the consumer's real code, isolated from the review API by origin; the gallery never
  executes prototype or flow modules in Node.
- Local review data is plain files in the repository so it can be reviewed in PRs.
- Remote review stores user content: authenticated access only, credentials hashed at rest and bound to an
  owner, HTTPS except loopback, attachments served as downloads without script execution.
- Agent manageability: every capability except approval, credential management, migration and process
  lifecycle is available through CLI `--json` and MCP with identical codes.
- Extension ecosystem: none in v1 beyond configuration (`canvas`/`frame`, `guards`, `review.remote`, `dev`)
  and the server's storage/auth adapters.

## Non-Goals (Out of Scope)

- Replacing Storybook in v1 (Pedro, 2026-10-30) — Storybook keeps working with the guards
  (`protoPresentation()`).
- Syncing local review files with a remote server; a project chooses where a review happens.
- Frameworks other than React + Vite.
- Visual regression diffing; screenshots are evidence, not assertions.
- Hosting a SaaS; the review server is self-hosted.
- Roles beyond the `review` and `comment` scopes.

## Open Questions

- Q1: Publish `@compozy/proto` on npm public as experimental 0.x until both milestones land? (Assumed yes —
  ADR-001.)
- Q2: Ship a Google OAuth helper on top of `signIn`, or leave sign-in entirely to the project? (Assumed the
  project provides it; reloaddev keeps its better-auth Google flow behind `signIn`.)
- Q3: Shell copy in `en` + `pt-BR` with locale-independent URL values (`theme=dark`, never `escuro`)?
  (Assumed yes; legacy values are mapped by `proto migrate`.)

---

# Part II — Technical

## Executive Summary

One published package, `@compozy/proto`, built in this repository from the stack template's
`packages/gallery`, absorbing CompozyOS's network guard, screenshot command, sequence counter and tests,
and reloaddev's remote comments, approval, ownership checks and credential flow. Subpath entries `.`,
`/flow`, `/config`, `/vite`, `/node`, `/server`, `/mcp` and a `proto` bin (ADR-001). The review shell is a
**prebuilt, self-styled bundle**; prototypes render in iframes on a **separate render origin** compiled by
the consumer's Vite, and the two halves talk through a typed postMessage protocol that also carries element
picking and anchor geometry (ADR-002, ADR-008). A runtime bootstrap tells the prebuilt shell whether it runs
in dev, read-only or remote mode and where its data lives.

Review data keeps its on-disk family: **version 3** of the per-key file is version 2 plus the issued-id
sequence, the review state and an event log in the same file, so one locked mutation covers every
user-visible transition (ADR-009). Readers accept v1 (reloaddev) and v2 (stack, CompozyOS), and
`proto migrate` rewrites them losslessly with a verification report; `proto migrate remote` moves
reloaddev's Postgres rows. One capability catalog drives the Node API, CLI and MCP (ADR-005). The work is
one spec with two milestones and one slice numbering (ADR-007).

## MVP Boundary

**Milestone 1 (MVP) = slices 1–6** and ends drift for stack and CompozyOS:
(1) package skeleton, contract, registry, render origin + protocol, bootstrap and the shell built to the
visual contract with read-only browsing — a project adopts the package and browses its prototypes;
(2) flows, checks, guards and `protoPresentation()`; (3) v3 store, locks, review state, picker protocol and
the local comment and approval loop in shell, CLI and dev API — the first complete author → review → agent
loop; (4) capability catalog: MCP, evidence commands, `proto init`, shipped skills, open-design record;
(5) `proto migrate` for v1/v2 files, migration of the stack template and CompozyOS, deletion of their
copies; (6) static read-only build, packed-tarball adoption, bundle budget.
**Milestone 2 = slices 7–9** and ends drift for reloaddev: (7) review server, Postgres DDL, auth handoff,
credentials, authorization matrix, render tickets; (8) `HttpStore`, `--remote`, remote MCP, `proto auth`;
(9) `proto migrate remote`, reloaddev migration and deletion of its copy and API module.
**Slice 10** is the docs site. Out of scope: Non-Goals.

## Developer Experience

- [Developer experience contract](_dx.md) — config, authoring API, URLs, CLI verbs and JSON, Vite plugin
  per context, Node API, HTTP API, server, MCP, error registry.
- [UI change map](_uiux.md) — every shell surface and state; visual contract = the `proto-shell` draft.

## System Architecture

```
consumer app
 ├─ vite.config.ts ── proto()                    (app build: production boundary only)
 ├─ .storybook / vitest ── protoPresentation()   (guards + source tags for stories)
 ├─ proto.config.ts · proto.canvas.tsx
 │
 shell + API origin (:4400)                         render origin (:4401, consumer Vite)
 ├─ GET /                prebuilt shell            ├─ /__proto/render/<slug>?state=…  (iframe)
 ├─ GET /__proto/bootstrap.json                    │    Canvas → Frame? → Prototype
 ├─ /__proto/api/*       review API (fetch router)  │    picker + anchor resolver (render side)
 ├─ /__proto/api/events  SSE                        └─ postMessage protocol ⇄ shell (ADR-008)
 │        │
 │   ReviewStore ─ FileStore (v3 files + locks)  |  HttpStore (remote)
 │        ▲
 ├─ CLI `proto …` · MCP `proto mcp`  ← capability catalog → Node API (loadProject)
 │
remote: @compozy/proto/server(fetch) = same router + Storage (fs | postgres + DDL) + Auth (signIn,
        authorize, credentialOwner) + gallery static + render origin assets (render tickets)
```

- **Registry** (`src/node/registry`): AST discovery of prototypes and flows, specs/roles from config,
  problems/warnings; watch mode emits change events.
- **Vite plugins** (`src/vite`): behavior per build context in § Vite Integration.
- **Render host** (`src/render`): the iframe entry compiled in the consumer graph; resolves the prototype
  lazily, wraps it in `Canvas`/`Frame`, applies theme/role/state, catches render errors, implements the
  render side of the protocol (picker, anchors, context).
- **Shell** (`src/shell`, built to `dist/shell`): the review UI with vendored BnUI components and compiled
  CSS; reads `bootstrap.json`; talks to the API and to its iframes only.
- **Review router** (`src/review`): one fetch router (validation, authorization matrix, events) mounted by
  the dev shell server and by the remote server.
- **Store** (`src/store`): `ReviewStore`; `FileStore` (v3 files, locks, atomic writes, upgrade readers);
  `HttpStore` (remote client with the credential policy).
- **Capabilities** (`src/capabilities`): the catalog; CLI and MCP are generated adapters.
- **Server** (`src/server`): `createReviewServer`, storages, auth handoff, credentials, render tickets, DDL.
- **Migration** (`src/migrate`): source readers (v1, v2, reloaddev SQL), mapping, verification report.

## Architectural Boundaries

- `src/contract`, `src/flow`, `src/config` (published `.`, `/flow`, `/config`): types and pure helpers; no
  Node, no shell imports.
- `src/model`: pure review model (schemas, upgraders, mappings, protocol and catalog types, error
  registry); importable by every other layer.
- `src/shell` imports `src/model` and its own `ui/`; never `src/node`, `src/store`, `src/server` or consumer
  code; never touches an iframe's `document` or `window` beyond `postMessage`.
- `src/render` imports consumer modules through virtual modules and `src/model` protocol types only.
- `src/node`, `src/store`, `src/cli`, `src/mcp`, `src/migrate` are Node-only; `src/review` and `src/server`
  are runtime-agnostic (fetch API) and import `src/model` + storage adapters only.
- `apps/app` consumes only public entries; it is the contract test and hosts the shell's own prototypes.
  `apps/api` mounts `@compozy/proto/server` and applies the package's shipped DDL; `packages/db` holds no
  review tables of its own.
- `packages/proto` never imports `@proto/ui`; the shell vendors what it uses (ADR-002).

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
export declare function setParam(name: string, value: string | null): void; // also posts `context`
export declare function setParams(
  values: Record<string, string | null>,
  options?: { push?: boolean }
): void;
export declare function protoHref(slug: string, state?: string): string;
export type CanvasProps = { children: ReactNode; theme: "light" | "dark"; role: string | null };
export type FrameProps = { route: string; role: string | null; state: string; children: ReactNode };

// @compozy/proto/config
export type ImportMatcher = string | RegExp; // module id, glob ("src/lib/gateway-*.ts") or RegExp
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
  guards?: { forbidRuntimeImports?: readonly ImportMatcher[]; productionBoundary?: boolean };
  review?: { remote?: { url: string } };
  evidence?: { dir?: string }; // default "docs/design"; files under <dir>/<slug>/
  dev?: { port?: number; poll?: boolean }; // default 4400 (render origin = port + 1), poll false
};

// @compozy/proto/vite
export declare function proto(options?: { config?: string }): Plugin[];
export declare function protoPresentation(options?: {
  config?: string;
  sourceTags?: boolean;
}): Plugin[];

// @compozy/proto/node
export interface ProtoProject {
  readonly root: string;
  readonly config: ResolvedProtoConfig;
  registry(): Promise<Registry>;
  watch(onChange: (registry: Registry) => void): () => void;
  store(options?: { remote?: boolean }): ReviewStore;
  url(target: UrlTarget, options?: { remote?: boolean }): string;
  screenshot(target: CaptureTarget): Promise<{ path: string; width: number; height: number }>;
  evidence(target: CaptureTarget): Promise<{ path: string }>;
  migrate(options: MigrateOptions): Promise<MigrationReport>;
}
export declare function loadProject(cwd: string): Promise<ProtoProject>;

export type Author = { kind: "reviewer" | "agent"; id?: string; name?: string };
export type CommentFilter = {
  key?: string;
  spec?: string;
  state?: string;
  status?: "open" | "resolved" | "all"; // default "open"
  authorKind?: "reviewer" | "agent";
  waiting?: boolean; // last message written by an agent
};
export type MessageChange = { body?: string; attach?: string[]; detach?: string[] };
export interface ReviewStore {
  list(filter?: CommentFilter): Promise<ReviewComment[]>;
  get(id: string): Promise<ReviewComment>;
  add(key: string, input: NewComment, author: Author): Promise<ReviewComment>;
  reply(id: string, input: NewMessage, author: Author): Promise<ReviewComment>;
  setStatus(
    id: string,
    status: "open" | "resolved",
    author: Author,
    note?: NewMessage
  ): Promise<ReviewComment>;
  editMessage(
    id: string,
    messageId: string,
    change: MessageChange,
    author: Author
  ): Promise<ReviewComment>;
  remove(id: string, author: Author): Promise<void>;
  upload(key: string, file: AttachmentInput, author: Author): Promise<PendingAttachment>;
  discard(key: string, attachmentId: string, author: Author): Promise<void>;
  readAttachment(
    key: string,
    attachmentId: string
  ): Promise<{ bytes: Uint8Array; type: string; name: string }>;
  review(key: string): Promise<ReviewState>;
  transition(
    key: string,
    to: "approved" | "in_review",
    author: Author,
    options: { commit: string | null; confirmOpen?: boolean }
  ): Promise<ReviewState>;
}

// @compozy/proto/server
export type Principal = {
  id: string;
  kind: "reviewer" | "agent";
  name: string;
  scopes: readonly ("review" | "comment")[];
};
export type ReviewServerOptions = {
  storage: ReviewStorage; // fileStorage(dir) | postgresStorage(sql)
  authorize: (request: Request) => Promise<Principal | null>; // browser session → principal
  credentialOwner: (ownerId: string) => Promise<Principal | null>; // re-validated on every bearer use
  signIn: { url: string } | ((request: Request, returnTo: string) => Response | Promise<Response>);
  gallery: { dir: string }; // `proto build` output
  publicOrigin: string; // "https://proto.acme.com"
  renderOrigin: string; // "https://render.proto.acme.com"
  basePath?: string; // default "/"
  ticketSecret: string; // ≥ 32 bytes, signs render tickets
};
export declare function createReviewServer(
  options: ReviewServerOptions
): (request: Request) => Promise<Response>;
export declare function postgresStorage(sql: Sql): ReviewStorage & { migrate(): Promise<void> };
export declare function fileStorage(dir: string): ReviewStorage;
```

### Data Models

**Review file v3** — `<app>/proto/review/<key>.json`, one file per key (slug or `flow-<id>`); attachments in
`<app>/proto/review/<key>/attachments/<id>.<ext>`; pending uploads in `<app>/proto/review/.pending/`
(gitignored):

```ts
type ReviewFileV3 = {
  version: 3;
  key: string; // v2 `slug`
  sequence: number; // highest comment number ever issued
  review: { status: "in_review" | "approved"; updatedAt: string | null };
  events: ReviewEvent[]; // append-only
  comments: ReviewComment[]; // v2 comment shape, unchanged field names
};
type ReviewEvent = {
  id: string; // uuid
  type: "approved" | "reopened" | "auto_reopened";
  at: string;
  author: "reviewer" | "agent" | "system";
  authorId?: string; // remote only
  authorName?: string;
  commit: string | null; // full 40-hex SHA
  openCount: number; // open comments at the moment of the transition
  commentId?: string; // the comment that caused auto_reopened
};
type ReviewComment = {
  id: string; // "<key>-<n>"
  slug: string; // equals key; kept from v2
  status: "open" | "resolved";
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  context: CommentContext; // commit (40-hex | null), state, theme ("light" | "dark" | null), role, viewport
  target: ElementTarget | NodeTarget;
  thread: CommentMessage[];
};
type CommentMessage = {
  id: string;
  at: string;
  editedAt: string | null;
  body: string;
  author: "reviewer" | "agent";
  authorId?: string; // remote only
  authorName?: string;
  attachments: CommentAttachment[]; // { id, name, type, size, width, height, uploaderId? }
};
```

Why one file per key: every user-visible transition (id allocation, comment, reply, approval, auto-reopen)
touches exactly one key, so one file under one lock is the commit boundary (ADR-009). JSON is right here: the
file is the unit of review in a PR, and nothing queries inside it locally.

**Readers and upgrades** (pure, total functions in `src/model/upgrade.ts`):

| Source                      | Detected by                     | Mapping to v3                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| reloaddev v1                | `version: 1`                    | message ids `legacy-<commentId>-<index>` (reloaddev's deterministic rule); `editedAt: null`; `attachments: []`; key and ids `fluxo-<id>` → `flow-<id>`; theme `claro`→`light`, `escuro`→`dark`; role `membro`→`member`; then as v2 |
| stack / reloaddev v2        | `version: 2`, no `sequence`     | `key = slug`; `sequence = max(n)`; `review = { status: "in_review", updatedAt: null }`; `events = []`                                                                                                                              |
| CompozyOS v2                | `version: 2` with `sequence`    | as above, keeping `sequence`                                                                                                                                                                                                       |
| reloaddev approval (remote) | `prototype_reviews.approved_at` | `review.status = "approved"` + one `approved` event (`commit: null`; `openCount` recomputed at migration and marked `estimated` in the report)                                                                                     |

Unknown fields are preserved under `extra` and written back; nothing is dropped. Writers write v3 only.

**Postgres (server)** — DDL shipped as `@compozy/proto/server/migrations/NNNN_*.sql`, applied by
`postgresStorage(sql).migrate()`, versioned in `proto_schema(version int)`; the server refuses to start when
the schema is older or newer than expected (`schema_mismatch`). Side tables because the API filters and
authorizes on these columns:

| Table               | Columns                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proto_keys`        | `key text pk`, `next_comment int not null`, `review_status text not null`, `review_updated_at timestamptz`                                                                                                 |
| `proto_events`      | `id uuid pk`, `key text fk`, `type text`, `at timestamptz`, `author_kind text`, `author_id text`, `author_name text`, `commit text`, `open_count int`, `comment_id text`                                   |
| `proto_comments`    | `key text fk`, `number int`, pk `(key, number)`, `status text`, `created_at`, `updated_at`, `resolved_at`, `context jsonb`, `target jsonb`                                                                 |
| `proto_messages`    | `id text pk` (uuid or `legacy-…`), `key text`, `number int`, fk `(key, number)`, `position int`, `author_kind text`, `author_id text`, `author_name text`, `body text`, `at`, `edited_at`                  |
| `proto_attachments` | `id text pk`, `key text`, `message_id text null fk`, `uploader_id text not null`, `name text`, `type text`, `size int`, `width int`, `height int`, `data bytea`, `created_at`, `expires_at` (pending only) |
| `proto_credentials` | `id text pk`, `owner_id text not null`, `name text`, `scopes text[]`, `hash bytea not null`, `created_at`, `last_used_at`, `revoked_at`                                                                    |

`context`/`target` stay JSON: opaque anchors, never filtered server-side. Every mutation runs in one
transaction that first takes `SELECT … FROM proto_keys WHERE key = $1 FOR UPDATE` (inserting the row if
absent). Pending claim: `UPDATE proto_attachments SET message_id = $m WHERE id = $a AND uploader_id = $p AND
message_id IS NULL AND expires_at > now()` must affect exactly one row.

**Credentials file (CLI)** — `~/.config/compozy-proto/credentials.json`, mode 0600, keyed by origin:
`{ token, id, name, scopes }`. Tokens are `pcr_<64 hex>` (256 bits), stored server-side as SHA-256.
`PROTO_REMOTE_URL` / `PROTO_REMOTE_TOKEN` override; tokens are never printed.

**Bootstrap** — `GET /__proto/bootstrap.json` (dev shell server, static build file, remote server):
`{ mode: "dev" | "read-only" | "remote", title, locale, commit, apiBase, eventsUrl | null, renderOrigin,
registryUrl, reviewSnapshotBase | null, principal | null, signInUrl | null }`. The prebuilt shell reads it
first; it is the only way the shell learns its environment (no compile-time `import.meta.env`, no Vite
HMR client).

**Static build output** (`dist-proto/`): shell assets, `bootstrap.json` (`mode: "read-only"`),
`registry.json`, `review/<key>.json` (v3 snapshots) and `review/<key>/attachments/*`, `render/` (render host

- prototypes). The read-only adapter reads only these files.

### Vite Integration

| Context                       | Entry                                              | Behavior                                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `proto dev`, render origin    | internal Vite server with `proto()` in render mode | registry + watch, virtual modules, `data-proto-src` tags, network guard (overlay), render host at `/__proto/render/*`                                                          |
| `proto dev`, shell origin     | Node HTTP server (no Vite)                         | prebuilt shell, `bootstrap.json`, review router, SSE events                                                                                                                    |
| `proto build`                 | Vite build with `proto()` in render mode           | render host + prototypes bundle (guards fail the build), shell copy, registry and review snapshots                                                                             |
| app `vite dev` / `vite build` | `proto()` from `vite.config.ts`                    | **only** the production boundary (fails if a `.proto.tsx`, a prototype fixture or a package gallery module enters the bundle); no transform, no virtual modules, no middleware |
| Storybook / Vitest            | `protoPresentation()` in `viteFinal` / config      | network guard for graphs rooted at stories and prototypes, optional source tags; replaces today's `vite.presentation.ts` guard                                                 |

`forbidRuntimeImports` applies only to module graphs rooted at prototypes, drafts and stories, never to
application routes. Matchers are module ids, globs or RegExp (CompozyOS's `gateway-*` family is a glob).

### Shell ⇄ render protocol (ADR-008)

Every message is `{ proto: 1, frame: <nonce>, type, … }`. The shell accepts a message only when
`event.source` is the iframe it created with that nonce and `event.origin` is the render origin; the render
host accepts only from `window.parent` with the shell origin passed in its URL and pinned at load.

| Direction      | Type                         | Payload                                                                                          |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| render → shell | `ready` / `error`            | `{ slug, state }` / `{ message, componentStack }`                                                |
| render → shell | `context`                    | `{ state, theme, role, url }` after `setParam(s)` or navigation                                  |
| shell → render | `pick:start` / `pick:cancel` | `{ mode: "element" \| "region" \| "keyboard" }`                                                  |
| render → shell | `pick:result`                | `ElementTarget` (selector, testId, tag, text, source, sourceChain, rect, rectNormalized, offset) |
| shell → render | `anchors:watch`              | `{ anchors: [{ id, selector, testId, offset }] }`                                                |
| render → shell | `anchors`                    | `{ rects: [{ id, rect \| null }] }` on resize, scroll or mutation (`null` = moved marker)        |
| shell → render | `scroll:to`                  | `{ selector }`                                                                                   |

### Authorization Matrix

| Operation                            | Dev (shell origin) | Session `review` | Session `comment` | Bearer `review` | Bearer `comment` |
| ------------------------------------ | ------------------ | ---------------- | ----------------- | --------------- | ---------------- |
| read registry, comments, attachments | ✓                  | ✓                | ✓                 | ✓               | ✓                |
| add, reply, resolve, reopen comment  | ✓                  | ✓                | ✓                 | ✓               | ✓                |
| edit message, detach upload          | ✓                  | own              | own               | own             | own              |
| delete comment                       | ✓                  | ✓                | —                 | ✓               | —                |
| approve / reopen review              | ✓ (trust)          | ✓                | —                 | ✓               | —                |
| create / list / revoke credentials   | —                  | ✓ (scopes ⊆ own) | ✓ (scopes ⊆ own)  | —               | —                |

Cookie-authenticated writes require `Origin` = `publicOrigin` and the header `X-Proto-Request: 1` (forces a
CORS preflight the server never grants). A request carrying both a session and a bearer is rejected
(`ambiguous_credentials`). The dev router accepts writes only when `Origin` equals the configured shell
origin (not the `Host` header), and Vite `allowedHosts` stays at its default. The render origin never
receives review cookies (separate host, `SameSite=Strict`, no CORS).

### API Endpoints

One fetch router, mounted at `/__proto/api` (dev) or `<basePath>api` (remote); zod validation; errors are
`{ error: { code, message } }` with codes from § Error Registry:

`GET registry` · `GET comments?key&spec&state&status&authorKind&waiting` · `GET comments/:id` ·
`POST comments` · `POST comments/:id/replies` · `PATCH comments/:id/status` ·
`PATCH comments/:id/messages/:messageId` (`{ body?, attach?, detach? }`) · `DELETE comments/:id` ·
`POST attachments?key=` (multipart; 413 `attachment_too_large`, 415 `attachment_type`) ·
`DELETE attachments/:key/:id` (pending discard) · `GET attachments/:key/:id` (`Content-Disposition:
attachment`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`) ·
`GET reviews/:key` · `POST reviews/:key/transitions` (`{ to, confirmOpen }`) · `GET events` (SSE in dev and
remote: `registry`, `comments`, `review` events with the key) · remote only: `GET session`,
`POST credentials`, `GET credentials`, `DELETE credentials/:id`, `GET render-ticket?slug&state`.

**Auth handoff (remote).** An unauthenticated **document** request is redirected (302) to `signIn` with
`returnTo` = the requested path (same-origin relative paths only; anything else becomes `/`); an
unauthenticated **API** request gets 401 `auth_required` with `signInUrl`. Public without a session: only the
`signIn` handoff and `bootstrap.json` (with `principal: null`). The shell gets a render ticket from
`GET render-ticket` (HMAC-signed with `ticketSecret`, 60 s, one slug) and loads the iframe with `?ticket=`; the
render origin exchanges it for its own host-scoped cookie and serves the render assets only with it.

## Capability Catalog

One table in `src/capabilities/catalog.ts` generates CLI verbs, MCP tools and the parity tests.

| Capability                     | Node API                           | HTTP                                 | CLI                                       | MCP                                                                      | Authority     |
| ------------------------------ | ---------------------------------- | ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| list registry                  | `registry()`                       | `GET registry`                       | `list`                                    | `proto_list`                                                             | read          |
| check                          | `registry()` + guard build         | —                                    | `check`                                   | `proto_check`                                                            | read          |
| url                            | `url()`                            | —                                    | `url`                                     | `proto_url`                                                              | read          |
| flow show / list / coverage    | `registry().flows`                 | —                                    | `flow show\|list\|coverage`               | `proto_flow_show`, `proto_flow_list`, `proto_flow_coverage`              | read          |
| scaffold                       | `scaffold()`                       | —                                    | `new`, `flow new`                         | `proto_new`, `proto_flow_new`                                            | write files   |
| list / show comments           | `store.list/get`                   | `GET comments`                       | `comments list\|show`                     | `proto_comments_list`, `proto_comments_show`                             | read          |
| add / reply / resolve / reopen | `store.add/reply/setStatus`        | `POST`, `PATCH`                      | `comments add\|reply\|resolve\|reopen`    | `proto_comments_add`, `…_reply`, `…_resolve`, `…_reopen`                 | comment       |
| edit / attach / detach         | `store.editMessage/upload/discard` | `PATCH`, `POST`/`DELETE attachments` | `comments edit\|attach\|detach`           | `proto_comments_edit`, `…_attach`, `…_detach`                            | comment (own) |
| download attachments           | `store.readAttachment`             | `GET attachments`                    | `comments attachments --out`              | `proto_comments_attachments` (writes under `.tmp/proto/`, returns paths) | read          |
| delete comment                 | `store.remove`                     | `DELETE comments/:id`                | `comments delete`                         | `proto_comments_delete`                                                  | review        |
| review status                  | `store.review`                     | `GET reviews/:key`                   | `review status`                           | `proto_review_status`                                                    | read          |
| approve / reopen review        | `store.transition`                 | `POST reviews/:key/transitions`      | `review approve\|reopen`                  | — agents never approve                                                   | review        |
| evidence                       | `screenshot()`, `evidence()`       | —                                    | `screenshot`, `evidence`                  | `proto_screenshot`, `proto_evidence`                                     | write files   |
| migrate                        | `migrate()`                        | —                                    | `migrate`, `migrate remote`               | — operator action with interactive verification                          | write files   |
| credentials                    | —                                  | `/credentials`                       | `auth login\|logout\|credentials\|revoke` | — browser session only                                                   | session       |
| lifecycle                      | —                                  | —                                    | `init`, `dev`, `build`, `mcp`             | — process lifecycle                                                      | —             |

Every store-backed MCP tool accepts `remote?: boolean`; MCP results equal the CLI `--json` output.

## Error Registry

One table in `src/model/errors.ts` (code → CLI exit / HTTP status / message), used by the CLI, MCP and the
router; `_dx.md` § Errors is generated from it: `invalid_config` (1), `not_a_vite_app` (1), `app_required`
(2), `port_in_use` (1), `slug_taken` (1), `comment_not_found` (1/404), `message_not_owned` (1/403),
`attachment_too_large` (1/413), `attachment_type` (1/415), `attachment_limit` (1/422), `attachment_expired`
(1/410), `key_busy` (1/409), `lock_lost` (1/409), `cross_origin_write` (—/403), `ambiguous_credentials`
(4/400), `auth_required` (4/401), `credential_revoked` (4/401), `invalid_credential` (4/401), `scope_denied`
(4/403), `insecure_remote` (4), `redirect_refused` (4), `schema_mismatch` (—/503), `playwright_missing`
(3), `migration_conflict` (1), `migration_unverified` (1). Problem codes: `duplicate_slug`, `reserved_slug`,
`invalid_slug`, `invalid_meta`, `duplicate_state`, `markup`, `unknown_spec`, `unknown_role`, `network_import`,
`production_boundary`, the 14 flow codes; warnings `canvas_missing`, `uncovered_state`.

## Migration Plan

| Source             | Path today                                                                                             | Target                                    | Mapping                                                                                                                                                                                                                                                                         | Verification                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| stack template app | `apps/<app>/gallery/comments/<slug>/comments.json` (v2) + attachments                                  | `apps/<app>/proto/review/<key>.json` (v3) | v2 → v3                                                                                                                                                                                                                                                                         | per key: comments, messages, attachments (bytes hashed), statuses, timestamps, anchors equal; a second run is a no-op |
| CompozyOS `web`    | `web/gallery/comments/<key>/comments.json` (v2 + `sequence`)                                           | `web/proto/review/<key>.json`             | keeps `sequence`                                                                                                                                                                                                                                                                | same                                                                                                                  |
| reloaddev local    | `apps/platform/gallery/comments/<key>/comments.json` (v1)                                              | `apps/platform/proto/review/<key>.json`   | v1 → v3 (`fluxo-`→`flow-`, theme/role values)                                                                                                                                                                                                                                   | same, plus the key renames listed                                                                                     |
| reloaddev remote   | `prototype_reviews`, `prototype_comments`, `prototype_messages`, `prototype_credentials` + attachments | `proto_*` tables                          | `user.id`→`author_id`/`uploader_id`/`owner_id`; `user.name`→`author_name`; `next_comment`→`next_comment`; `approved_by/at`→`approved` event; attachment name/type/size/width/height/bytes kept; credential hashes copied only when the scheme matches, else listed for re-issue | row counts per table, every comment round-tripped, report in `proto-migration-report.json`; dry-run first             |

`proto migrate --from <dir> [--flow-prefix fluxo-] [--theme-map claro=light,escuro=dark] [--role-map
membro=member] [--dry-run]` works without `gallery.config.ts` (when present it also writes
`proto.config.ts` from it). It refuses to overwrite a target key with different content
(`migration_conflict`), is resumable (verified keys are skipped), never deletes the source, and lists what to
delete. Consumers delete `vite.presentation.ts` only after switching Storybook and Vitest to
`protoPresentation()` and passing their own gates. `proto migrate remote --from-database <url>
--to-database <url> [--dry-run]` copies one transaction per key and fails closed on any count mismatch
(`migration_unverified`).

## Integration Points

- **Vite** (plugin API, `createServer` for the render origin, `build`).
- **Playwright Chromium** for `screenshot`/`evidence` (optional peer; exit 3 `playwright_missing`).
- **git** for `context.commit` (full SHA; null outside git).
- **Postgres** via `postgres.js` for `postgresStorage` and `migrate remote` (optional peer).
- **MCP** stdio via `@modelcontextprotocol/sdk` (optional peer).
- **Project auth** via `signIn`, `authorize` and `credentialOwner` (reloaddev: better-auth + Google).

## Impact Analysis

| Component                                                            | Impact Type                | Description and Risk                                                                                                                   | Required Action |
| -------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `proto/packages/gallery`                                             | renamed → `packages/proto` | Becomes `@compozy/proto`; shell rebuilt to the visual contract on vendored BnUI. High.                                                 | Slices 1–6      |
| `proto/apps/app`                                                     | modified                   | Dogfood consumer; hosts `drafts/proto-shell` (moved from the stack template); Storybook/Vitest use `protoPresentation()`.              | Slices 1–2      |
| `proto/apps/api`                                                     | modified                   | Mounts the server; applies the package DDL.                                                                                            | Slice 7         |
| stack template                                                       | modified                   | Depends on `@compozy/proto`; `packages/gallery` and `drafts/proto-shell` deleted; `vite.presentation.ts` replaced.                     | Slice 5         |
| CompozyOS `web/gallery`                                              | deleted                    | Internal code, hard cut after `proto migrate`; guards via config globs.                                                                | Slice 5         |
| reloaddev `apps/platform/gallery`, `apps/api/src/modules/prototypes` | deleted                    | Internal code, hard cut after both migrations.                                                                                         | Slice 9         |
| Review files in consumers                                            | user state                 | v1/v2 → v3 rewrite with verification; history preserved.                                                                               | Slices 5, 9     |
| reloaddev `prototype_*` rows                                         | user state                 | Copied to `proto_*` with verification; the old tables are dropped by a later reloaddev migration after Pedro's sign-off on the report. | Slice 9         |

Delete targets carry no compatibility shims; the package readers are the only upgrade path; no fallback reader
stays in the old copies. The package's public surface is new and experimental until 1.0.

## Extensibility Integration Plan

Configuration only: `canvas`/`frame`, `guards`, `review.remote`, `dev`; server `storage`, `authorize`,
`credentialOwner`, `signIn`. CompozyOS: `proto init`/`migrate` write the open-design `target: library`
record (`preview` → render origin URL `http://127.0.0.1:4401/__proto/render/{slug}?chrome=0`, `evidence` →
`proto evidence {slug} --state <id>`, HTML under `docs/design/<slug>/`, accepted by `lint_artifact`).
CompozyOS's `eng-prototype-comments` skill is replaced by the shipped `apply-prototype-comments` in slice 5.

## Agent Manageability Plan

The Capability Catalog is the agent contract: CLI `--json` and MCP tools for every capability except
approval, credentials, migration and process lifecycle (reasons in the catalog). Exit codes: 0 ok, 1
problems/user error, 2 usage, 3 missing dependency, 4 remote/auth. The shipped skills reference only catalog
commands and state that agents never approve.

## Config Lifecycle

`proto.config.ts` is the only config file; loaded by the Vite plugins, CLI and MCP through `loadProject`;
validated with zod (exit 1 `invalid_config` with the key path). Environment: `PROTO_REMOTE_URL`,
`PROTO_REMOTE_TOKEN`, `PROTO_PORT` (overrides `dev.port`), `PROTO_POLL=1` (overrides `dev.poll`). `--verbose`
is a global CLI flag. `proto init` writes the config; `proto check` validates it.

## Testing Approach

Vitest: a Node project for registry, model, store, router, server, CLI, MCP and migrate; a browser project
(Playwright Chromium) for the shell, render host and protocol. Fixtures: small consumer apps under
`packages/proto/test/fixtures/*` and **real review files copied from the three repositories**
(`fixtures/review/{stack-v2,compozy-v2-sequence,reloaddev-v1}/`). The CLI contract suite runs one seeded
fixture with a fixed clock, commit and ids and asserts `--json` output and exit codes only. The store
contract suite runs against `FileStore`, `HttpStore` + `fileStorage` and `HttpStore` + `postgresStorage`.
E2E: the packed tarball installed into a fresh Vite app; `apps/app` through `proto dev`/`proto build`; remote
journeys through `apps/api` with a per-suite Postgres (`TEST_DATABASE_URL`). Cases: [_tests.md](_tests.md).

## Development Sequencing

### Build Order

One numbering (= MVP Boundary slices):

1. Skeleton, contract/config, `loadProject`, registry; render origin + render host + protocol
   (`ready`/`error`/`context`); bootstrap; prebuilt shell pipeline with S1–S7, S13, S19, S20 browsing.
   Gate: `apps/app` adoption E2E.
2. Flows, checks, network guard + production boundary + markup, `protoPresentation()`; `apps/app`
   Storybook/Vitest switched. Gate: guard suites + `bun run verify`.
3. Model v3 + upgraders, `FileStore` (locks, atomic writes), review state/events, router + SSE, picker and
   anchor protocol, S8–S12, S14–S16. Gate: store contract suite, comment E2E.
4. Capability catalog, MCP, evidence, `proto init`, skills, record. Gate: CLI contract + MCP parity.
5. `proto migrate` (files), migration of stack and CompozyOS, deletion of their copies. Gate: migration
   suites on real fixtures + each repository's own gates.
6. Static read-only build (S21), packed-tarball E2E, bundle-size budget. **Milestone 1 exit.**
7. Server: DDL + `postgresStorage`, `fileStorage`, auth handoff, credentials, authorization matrix, render
   tickets, S17–S18. Gate: server suites.
8. `HttpStore`, `--remote`, remote MCP, `proto auth`. Gate: store contract suite over HTTP.
9. `migrate remote`, reloaddev migration, deletion of its copy and API module. **Milestone 2 exit.**
10. Docs site.

### Technical Dependencies

npm scope `@compozy`; Playwright Chromium and Postgres in CI (both already in the template CI).

## Monitoring and Observability

`--verbose` and server logs: one line per request `{ route, status, principal_kind, duration_ms }`; lock
waits > 1 s, takeovers, `key_busy`/`lock_lost`; migration per-key counts and conflicts; credential use,
revocations and owner re-validation denials. Comment bodies and tokens are never logged.

## Technical Considerations

### Key Decisions

ADR-001 single package · ADR-002 prebuilt shell · ADR-003 one ReviewStore · ADR-004 config files and Vite
contexts · ADR-005 capability catalog · ADR-006 visual contract · ADR-007 one spec, two milestones ·
ADR-008 render origin and protocol · ADR-009 per-key review file, lock protocol and transactions.

### Known Risks

- **Two origins in dev** (4400/4401): port collisions — `--port` moves both.
- **Picker fidelity** across the protocol (source chain, region contents) — ported from today's DOM code
  into the render host, covered by the comment E2E.
- **Vite major drift** — plugin tested against Vite 7 and 8.
- **reloaddev credential hashes** may use another scheme — the migration lists credentials to re-issue.
- **Shell bundle size** — 400 KB gzip budget enforced in slice 6.

## Safety Invariants

1. Every mutation of a review key happens inside that key's critical section: locally the lock directory
   `<key>.lock/` holding `owner.json` `{ token, pid, host, heartbeatAt }`; remotely one transaction holding
   `proto_keys … FOR UPDATE`.
2. A local lock is acquired with `mkdir`; the holder refreshes `heartbeatAt` every 2 s; a lock is stale only
   when `heartbeatAt` is older than 10 s **and** (same host) its pid is not alive or (other host) 30 s have
   passed. Takeover renames the stale directory to `<key>.lock.<token>.stale` (atomic, one winner) and then
   acquires normally.
3. Before publishing (renaming its temp file), a writer re-reads `owner.json` and aborts with `lock_lost` if
   the token is not its own; release removes the lock only when the token matches.
4. Waiting for a lock is asynchronous (never blocks the event loop) and bounded at 5 s → `key_busy`.
5. Files are written via temp file + rename in the same directory; a crash never leaves a partial file.
6. Comment numbers per key strictly increase and are never reused (`sequence` / `next_comment`).
7. The shell accepts protocol messages only from the iframe it created (source window + frame nonce) and the
   render origin; the render host only from its parent with the pinned shell origin.
8. Prototype code runs on the render origin, which never holds review credentials or cookies; review writes
   require the shell origin (dev) or `publicOrigin` + `X-Proto-Request` (remote).
9. Remote authorship and ownership come from the authenticated principal, never from the request body.
10. Credentials are created only through a browser session, grant ⊆ the creator's scopes, are re-validated
    against `credentialOwner` on every use; `comment` scope never approves, deletes or manages credentials.
11. Discovery never imports or evaluates a prototype or flow module in Node.
12. Remote URLs are HTTPS except loopback; credential-bearing requests never follow redirects.

## File References

### Repo Files

- `packages/gallery/src/contract.ts:1-82` — authoring contract; becomes `@compozy/proto`.
- `packages/gallery/src/config.ts:1-37` — `GalleryConfig`; superseded by `ProtoConfig`.
- `packages/gallery/src/flow.ts`, `src/flow-graph.ts` — flow types, problem codes, BFS steps.
- `packages/gallery/src/node/discovery.ts`, `src/node/literal.ts` — AST discovery → registry.
- `packages/gallery/src/shell/comments/model.ts:60-110` — the actual v2 schema that v3 extends.
- `packages/gallery/src/node/comments-store.ts`, `attachments-store.ts`, `comments-plugin.ts` — FileStore and
  dev API origins (locks replaced per Safety Invariants 1–4).
- `packages/gallery/src/shell/frame.tsx`, `shell/comments/dom.ts`, `shell/comments/use-comment-picker.ts` —
  today's same-document picker; moves into the render host behind the protocol.
- `packages/gallery/src/node/source-tags.ts` — `data-proto-src` transform.
- `packages/gallery/src/node/presentation-guard.ts`, `production-boundary.ts` — guards to generalize.
- `apps/app/{vite.config.ts,vite.presentation.ts,vitest.config.ts,.storybook/main.ts}` — today's build
  contexts that § Vite Integration replaces.
- `apps/app/gallery/comments/proto-shell/comments.json` — a real v2 file (fixture).
- `docs/design/prototyping.md` — the open-design record `proto init` writes.
- `.agents/skills/apply-prototype-comments/SKILL.md` — today's comment loop; becomes the shipped skill.

### External Sources (other repositories, cited by path)

- `~/Dev/compozy/compozy/web/gallery/node/{network-graph,trusted-write,local-comments,comments-store}.ts`,
  `node/plugins/network-guard.ts`, `cli/commands/screenshot.ts`, `shell/comments/model.ts` (sequence),
  `__tests__/*`.
- `~/Dev/courses/reloaddev/apps/api/src/modules/prototypes/{routes,comments,attachments,attachment-routes,reviews,credentials,gallery,schemas}.ts`
  — remote API, `next_comment` allocation, ownership and claim checks, credentials, `/login` handoff.
- `~/Dev/courses/reloaddev/apps/platform/gallery/cli/{remote-auth,remote-comments}.ts` — HTTPS/loopback and
  redirect rules, 0600 credential file.
- `~/Dev/courses/reloaddev/apps/platform/gallery/shell/comments/model.ts` — v1 reader (`legacy-` ids).
- `~/Dev/courses/reloaddev/packages/db/src/schema/prototypes.ts` — remote schema to migrate.
- `~/Dev/courses/reloaddev/apps/api/tests/prototypes.it.test.ts` — same-name ownership and concurrent claim
  cases to port.
- `~/Dev/compozy/compozy/extensions/open-design/skills/open-design/SKILL.md` — consumer of the record.

### Design and Analysis Sources

- `~/Dev/compozy/stack/apps/app/src/drafts/proto-shell/` — the shell visual contract; moves here in slice 1.
- `qa/peer-review-findings-round1-{opus,astra}.md` — the round-1 review that shaped this revision.
- reui-blocks `flow-2`, `flow-1`, `app-shell-1`, `whiteboard-1` — component references.

## Assumptions and Defaults

- Package `@compozy/proto`, MIT, 0.x experimental; bin `proto`.
- Review data under `<app>/proto/review/`; evidence under `docs/design/<slug>/`.
- Shell/API origin `127.0.0.1:4400`, render origin `127.0.0.1:4401`.
- `forbidRuntimeImports` default none; `productionBoundary: true`.
- Shell locales `en` (default) and `pt-BR`; URL values locale-independent.
- Remote: sign-in owned by the project; bearer credentials for CLI/MCP only.

## Architecture Decision Records

- [ADR-001: One package with subpath exports](adrs/adr-001.md)
- [ADR-002: Prebuilt, isolated shell; prototypes in consumer iframes](adrs/adr-002.md)
- [ADR-003: One ReviewStore for local files and the remote server](adrs/adr-003.md)
- [ADR-004: proto.config.ts + proto.canvas.tsx; one plugin per build context](adrs/adr-004.md)
- [ADR-005: One capability catalog for the Node API, CLI and MCP](adrs/adr-005.md)
- [ADR-006: Shell visual contract — dark canvas, pink primary](adrs/adr-006.md)
- [ADR-007: One spec, two milestones that each end drift](adrs/adr-007.md)
- [ADR-008: Separate render origin and a typed shell ⇄ render protocol](adrs/adr-008.md)
- [ADR-009: Per-key review file v3, lock protocol and transactions](adrs/adr-009.md)
