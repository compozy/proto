---
schema_version: 1
review_kind: spec
round: 1
readiness: NEEDS_REWORK
reviewer_runtime: claude
reviewer_model: claude-opus-5-5
generated_at: 2026-10-31T02:14:31Z
---

# Summary

Part II's one hard compatibility duty is lossless migration of review data, and it does not hold. "Format unchanged (v2)" is false against all three copies, the reloaddev Postgres export is lossy and unspecified, and `proto migrate` only covers the stack layout. Several safety claims also contradict the code they cite: the stale-lock takeover is not atomic, prototypes render in same-origin iframes where they can act as the reviewer, and remote credentials are weaker than reloaddev's today. The spec also packs three products (extraction, redesign, remote review server) into one plan whose MVP does not end the three-way drift, so it needs rework rather than patching.

# Blockers

## B-001 — "Format unchanged (v2)" is false; the comment-file migration is not lossless

- Section: `_spec.md` § Data Models (Comments file), § Impact Analysis (row "Comment files v2 in consumers"); `_user_stories.md` US-034 EC-1; `_tests.md` UT-034
- Issue: The spec defines v2 as `{ version: 2, sequence, comments }`. Each comment is `{ id: number, …, messages[], createdAt }` and each message is `{ id, author: { kind, name }, body, attachments, createdAt, editedAt? }`. The v2 files on disk today have a different shape. In this repo (`packages/gallery/src/shell/comments/model.ts`): `{ version: 2, slug, comments }` with no `sequence`, string ids `"<slug>-<n>"`, `thread` instead of `messages`, `author: "reviewer" | "agent"` as a string with no name, `at` instead of `createdAt`, `editedAt: null`, and per-comment `updatedAt`/`resolvedAt` (the spec's Comment drops both). CompozyOS (`web/gallery/shell/comments/model.ts`) uses the same shape plus an optional `sequence`. All 8 reloaddev local files (`apps/platform/gallery/comments/*/comments.json`) are `version: 1`. Their messages have no `id`, `editedAt` or `attachments`, and `context.theme` holds localized URL values such as `"escuro"`. The spec also introduces a "system line" on auto-reopen (US-020 AC-3, UT-038), but `author.kind` only allows `reviewer | agent`. So this is a schema change in every consumer, not a move. The migration path (`git mv` only, per `_dx.md` `proto migrate`) and the target schema both fail to say how to fill the new `author.name` or which `sequence` to seed. They also omit the conversion of string ids to numbers and how `updatedAt`/`resolvedAt` are kept, and leave localized theme values unmapped.
- Rationale: Lossless migration of consumers' review data is the one hard compatibility duty in this scope. The spec states the format is unchanged, which contradicts the code without saying so, and the planned `git mv` would leave files the new reader cannot parse, or would drop fields.
- Suggested fix: Either (a) keep today's v2 shape (`slug`, string ids, `thread`, `at`, `updatedAt`, `resolvedAt`, optional `sequence` as in CompozyOS) as the v2 schema and add only optional fields, or (b) declare a v3, ship a total and documented `v1|v2 → v3` upgrader in `src/model`, and make `proto migrate` rewrite the files, not just move them. Specify: the seed of `sequence` (max issued number), id mapping (`login-form-7 → 7` within key `login-form`), the default `author.name` for legacy messages (for example `"reviewer"`/`"agent"` or the git author of the commit), a `system` author kind or a dedicated `events[]` for the reopen line, and a theme mapping table for legacy values. Make UT-034 a round-trip test over real fixtures copied from all three repositories, including reloaddev v1 and CompozyOS with `sequence`.

## B-002 — Consumer migration covers only the stack layout; CompozyOS and reloaddev local and remote data have no defined path

- Section: `_spec.md` § Impact Analysis (CompozyOS and reloaddev rows), § MVP Boundary slice 7; `_dx.md` § `proto migrate`; `_user_stories.md` US-034
- Issue: `proto migrate` reads `gallery.config.ts` + `preview/canvas.tsx` and moves `gallery/comments`. Only the stack template has that layout. CompozyOS has no `gallery.config.ts`: specs come from `web/gallery/node/specs.ts` and comments live in `web/gallery/comments/`. reloaddev hardcodes specs and roles in `contract.ts` and keeps comments in `apps/platform/gallery/comments/` (v1). reloaddev's remote data also needs a path. The spec says only "existing remote comments exported to the new server tables". The `prototype_*` tables in `reloaddev/packages/db/src/schema/prototypes.ts` hold `author_id`/`uploader_id`/`user_id` (FKs to `user`), `approved_by`/`approved_at`, `next_comment`, and attachment `name`/`type`/`size`/`width`/`height`. The proposed `proto_*` tables have no columns for user identity, attachment name or dimensions, or the id counter. No exporter, mapping or verification is specified.
- Rationale: Two of the three copies have no automated, lossless way to move their review data. The Postgres data is user content that the scope says must migrate losslessly.
- Suggested fix: Add a migration section to Part II with one row per source (stack files, CompozyOS files, reloaddev v1 files, reloaddev Postgres). Give each row a source path, target path, field mapping and verification step (counts plus a round-trip diff). Make `proto migrate` take `--from <comments dir>` and a spec/role map so it does not depend on `gallery.config.ts`. Ship `proto migrate remote --from-sql` or a documented SQL script for reloaddev that maps `user.name` → `author.name`, `next_comment` → `sequence`, and `approved_by`/`approved_at` → review record (`commit: null`). It must also keep attachment name, size and dimensions. Add an IT test over a fixture dump.

## B-003 — Per-key locking is unsound as specified; the review record and Postgres id allocation are outside it

- Section: `_spec.md` § Business Rules (Concurrency, Approval), § Safety Invariants 1–3, § Data Models (Postgres); `_tests.md` UT-030, UT-031, IT-005
- Issue: (1) Invariant 1 says a stale lock "is taken over atomically". The cited `CompozyOS web/gallery/node/comments-store.ts` `withKeyLock` does `rmSync(lock)` then retries `mkdirSync`. Two waiters that both see the lock as stale can each remove the lock the other just created, and both then hold it. Release also does `rmSync(lock)` unconditionally, so a writer whose lock was taken over deletes the new holder's lock. (2) There is no owner token and no heartbeat. A legitimate write that takes longer than 10 s (attachment moves on a slow disk, a paused process) loses its lock mid-change. (3) The review file (`proto/reviews/<key>.json`) is written outside the comment-key lock. "Approve records the open count" and "a new comment moves an approved item back to in_review" are read-modify-write steps across two files, so a concurrent approve and add can end `approved` with a newer open comment and a stale `openAtApproval`. (4) Invariant 3 (ids never reused) has no storage in Postgres. `proto_comments(key, id, …)` and `proto_reviews` have no counter column. reloaddev uses `prototype_reviews.next_comment` with an increment in a transaction, which the spec does not carry over. (5) The cited lock busy-waits with `Atomics.wait` for up to 5 s, which blocks the Vite dev server's event loop.
- Rationale: These are the concurrency and safety invariants the spec puts first. The cited algorithm does not meet them, and the cross-file approval rule has no serialization at all.
- Suggested fix: Specify the lock algorithm. Write an owner token (pid + uuid) into the lock directory, take over a stale lock with an atomic `rename` of the stale lock to a tombstone, and only release a lock whose token still matches. Either refresh the lock mtime during long operations or bound every locked operation well under the stale threshold. Make the review file part of the key's locked state, either written under the same lock or merged into `comments.json`, and do add+reopen and approve+open-count in one locked mutation. For Postgres, add `proto_reviews.next_comment` (or a `proto_keys` table) and require one transaction with `SELECT … FOR UPDATE` per mutation. Use an async wait in the dev server. Extend UT-031 with a two-waiter stale-takeover race and a review/add race test.

## B-004 — Prototype iframes share the shell and review-API origin, so prototype code can act as the reviewer; this also contradicts "postMessage only"

- Section: `_spec.md` § Assumptions ("render origin = dev origin (same-origin iframes)"), § Safety Invariants 4, 5, 7, § Known Risks (React skew: "communication via postMessage only"); `adrs/adr-002.md` Decision; `_dx.md` URL `/__proto/render/...`
- Issue: Prototypes run arbitrary consumer code, often written by agents, in iframes on the same origin as the shell and as `/__proto/api` or `<basePath>api`. Any `fetch` from a prototype carries `Origin` equal to the dev origin, so it passes the `cross_origin_write` check. On a deployed gallery it also carries the reviewer's session cookie. A prototype can therefore `PUT reviews/:key {"status":"approved"}`, mint credentials, or post comments as a reviewer, and it can read `window.parent`. That defeats Invariant 7 ("agents can never approve") and the scope model of Invariant 5. Separately, ADR-002 and Known Risks say shell and render host talk only through URL parameters and postMessage. The current shell reaches straight into the iframe instead: `shell/frame.tsx` (`contentDocument`, `contentWindow.history`) and `shell/comments/dom.ts` (`ownerDocument.querySelector` for picking, selectors, `sourceChain` and pin re-anchoring). The spec neither keeps that same-origin DOM access explicitly nor defines a picker/anchor protocol.
- Rationale: This is scope escalation and a cross-origin-write regression baked into the architecture. It also leaves an undecided contract between the two halves of the product (the comment overlay cannot be built against "postMessage only").
- Suggested fix: Choose and document one model. Either (a) serve the render host from a separate origin (for example a second port in dev and a sandbox subdomain remotely) and define a typed postMessage protocol for picking, rects, `sourceChain` and anchor tracking, or (b) keep same-origin DOM access but state that the review API refuses requests from the render-host path (`Sec-Fetch-Dest: iframe`/`Referer` under `/__proto/render`) and requires a CSRF token held only by the shell. Option (b) also needs a statement that this is advisory against malicious prototypes. Option (a) is the only real boundary for remote approval. Add a test: a prototype that calls `PUT reviews` is rejected.

## B-005 — The remote credential and session model regresses from reloaddev and leaves scope escalation open

- Section: `_spec.md` § Business Rules (Permissions), § Data Models (`proto_credentials`, credentials file), § API Endpoints, § Safety Invariant 5/7; `_dx.md` § HTTP API, § `proto auth`
- Issue: Compared with `reloaddev/apps/api/src/modules/prototypes/credentials.ts` and `cli/remote-auth.ts`, the spec loses or omits six protections. (1) `proto_credentials` has no owner. reloaddev binds each token to a `user_id` and re-checks on every use that the user is still active with `admin.access`, so removing a person revokes their tokens. In the spec a token outlives its issuer. (2) Nothing says who may call `POST credentials` or which scopes they may grant. A `comment`-scope bearer could mint a `review` credential. reloaddev allows credential management through a session only. (3) Tokens drop from 256 bits (`rpc_<64 hex>`) to 128 bits (`pcr_<32 hex>`). (4) reloaddev rejects non-HTTPS remote origins except on loopback; the spec states no such rule for `--remote`/`PROTO_REMOTE_URL`, so a bearer can go out in cleartext. (5) Remote writes authenticated by a session cookie have no CSRF/Origin rule; only the dev middleware gets one. (6) Pending attachments have no uploader, so anyone can attach someone else's pending id; reloaddev scopes discard by uploader. On the local side, "only a reviewer approves" cannot be enforced: `proto review approve --yes` is a CLI verb agents can run, and `_dx.md` shows the agent-facing laptop credential carrying `review` scope. The spec does not say that local approval and review-scoped CLI credentials rely on trust.
- Rationale: These are credential-handling and scope-escalation regressions against existing production code, inside the safety invariants the spec asks reviewers to rely on.
- Suggested fix: Add `owner` (principal id) to `proto_credentials`, and re-validate it through the `authorize` adapter (for example `authorizeCredentialOwner(ownerId)`) on every bearer use. Require a session principal for credential create, list and revoke, and require minted scopes ⊆ the creator's scopes. Use ≥ 256-bit tokens, require HTTPS except on loopback for any remote URL, require same-origin `Origin`/`Sec-Fetch-Site` for cookie-authenticated writes, and record the uploader on pending attachments. In Safety Invariants, state that local approval relies on trust and that agents must use `comment`-only credentials. Consider making `proto review approve` refuse to run on a non-interactive TTY unless `--yes` is given, and documenting that this is not a security boundary.

## B-006 — The remote sign-in surface promised by `_uiux.md` S18 and US-028 has no server contract; mount and basePath examples contradict each other

- Section: `_spec.md` § Core Interfaces (`ReviewServerOptions`), § API Endpoints; `_uiux.md` S17, S18; `_user_stories.md` US-028; `_dx.md` § Server, § HTTP API
- Issue: `createReviewServer` accepts only `authorize(request)`. There is no sign-in URL, no redirect-after-sign-in, no session-expired signal and no logout, yet S18 shows "provider button / token field" and US-028 AC-1 requires returning to the requested URL after sign-in. reloaddev does this today with a dedicated `/login` route and a document-request redirect in `gallery.ts`. A "token field" sign-in in the browser would also put a bearer token in browser storage, and the spec does not say so. The `_dx.md` example mounts the server at `app.all("/proto/*", …)` with the default `basePath: "/"`, so requests to `/proto/api/...` would not match `<basePath>api`. `review.remote.url` is baked into the build even though the same server serves the gallery, and the spec does not say whether a cross-origin remote (CORS, `SameSite`) is supported.
- Rationale: This is a partial surface. The UI contract promises sign-in behavior Part II cannot serve, and the reference example would not work.
- Suggested fix: Add `signIn?: { url: string } | ((request) => Response)` (or `loginUrl`) and define the 401 behavior: redirect for document requests, `{error:{code:"auth_required"}}` for API requests, and a `returnTo` parameter. Drop the token field from S18 or specify its storage. Fix the `_dx.md` example to `basePath: "/proto/"`. State that the gallery and the API must share an origin, or specify CORS and cookie requirements.

## B-007 — `postgresStorage` ships without a schema for library consumers, and the table design misses fields the contract needs

- Section: `_spec.md` § Data Models (Postgres storage), § Impact Analysis (`proto/packages/db` row), § Integration Points
- Issue: The review tables are planned as Drizzle migrations in this repository's `packages/db`. Projects that install `@compozy/proto` and call `postgresStorage(sql)`, reloaddev first among them, get no DDL, no migration runner and no schema-version check. The tables also do not hold the contract: `proto_reviews` has no `open_at_approval` (the review file and `_dx.md` response include it) and no id counter (B-003). `proto_attachments` has no `name`, `width`, `height` or uploader, although attachments carry those fields today. `proto_messages` has no message id format compatible with the file store (`m1` vs uuid).
- Rationale: The server ships without a usable storage path for any external consumer. That is a partial-surface completion of a published entry point.
- Suggested fix: Ship versioned SQL in the package (for example `@compozy/proto/server/migrations/*.sql`) with `postgresStorage.migrate(sql)`, or document that the consumer must apply the provided DDL. Add a schema-version check at startup. Have `apps/api`/`packages/db` consume that same SQL, not author its own. Complete the columns so the shared contract suite (IT-020–IT-022) can hold for every field `FileStore` persists.

## B-008 — MCP does not mirror the CLI, though ADR-005 and US-024 say it does

- Section: `_spec.md` § Agent Manageability Plan, § High-Level Technical Constraints ("every review action is available through CLI `--json` and MCP"); `adrs/adr-005.md`; `_dx.md` § MCP; `_user_stories.md` US-024; `_tests.md` IT-015
- Issue: The constraint says every review action is available through MCP, and ADR-005 says `proto mcp` exposes "the same functions". The listed 11 tools omit `comments add`, `reopen`, `edit`, `delete`, `attach`/`detach`, `attachments` download, `review reopen`, `flow coverage`, `flow list`, `new` and `flow new`. No tool takes a `remote` argument, so MCP cannot do the remote loop (US-030). Only approval is excluded on purpose.
- Rationale: This is partial-surface completion. An agent limited to MCP cannot do the comment loop the spec promises (for example, an agent cannot download the attachment images it is asked to look at), and IT-015 cannot verify parity against an undefined subset.
- Suggested fix: Generate MCP tools from the same command table as the CLI (ADR-005 already implies this), list every verb except `review approve`, `auth`, `init`, `dev`, `build` and `mcp` with a stated reason for each exclusion, and add `remote?: boolean` to the store-backed tools. Make IT-015 iterate over that table.

## B-009 — Collapsing to `vite.config.ts` + `proto()` breaks Storybook and leaves production-build behavior unspecified

- Section: `adrs/adr-004.md`; `_spec.md` § Config Lifecycle, § System Architecture (Vite plugin); `_dx.md` § Config files and `proto migrate` ("Delete when ready: … vite.presentation.ts")
- Issue: In this repo, Storybook loads `apps/app/.storybook/main.ts` with `viteConfigPath: ../vite.presentation.ts`, and that file carries the presentation guard that keeps stories off the data layer (a rule in CLAUDE.md). `proto migrate` tells users to delete it, and nothing replaces the guard for stories (Storybook is a Non-Goal, not a casualty). The single `proto()` plugin then also runs in the app's production `vite build`, but the spec never says it must be inert there apart from the production boundary. The `data-proto-src` transform, virtual modules and shell serving must not run, and `forbidRuntimeImports` must apply only to graphs rooted at prototype or draft modules, because production routes legitimately import `src/lib/api.ts`. CompozyOS's guard also matches regex families (`src/lib/gateway-*.ts`), which a `readonly string[]` cannot express, so "keep `network-graph` semantics via `guards`" is unsupported.
- Rationale: This contradicts existing code (Storybook config) without saying so, and an under-specified guard scope risks either a broken production build or a silent hole in the guard.
- Suggested fix: Export the guard for Storybook (`proto({ mode: "stories" })` or `protoGuard()` for `viteFinal`), and keep `vite.presentation.ts` off the migrate delete list until that exists. Specify `proto()` behavior per Vite `command`/`mode`. Let `forbidRuntimeImports` accept globs or RegExp. Add IT-017 cases: production `vite build` of `apps/app` passes with routes importing `api.ts`, and Storybook build fails when a story imports `api.ts`.

## B-010 — The MVP does not solve the Motivating Problem, and three products are packed into one spec

- Section: `_spec.md` § Overview (Motivating Problem), § MVP Boundary, § Development Sequencing, § Impact Analysis (Required Action column)
- Issue: The Motivating Problem is three-way drift and hand-ported fixes. The MVP (slices 1–5) ends with the three copies still in place: migration is slice 7, post-MVP. reloaddev, the only copy with remote review, cannot migrate until slice 6 (the remote server), so drift continues through the whole MVP. The claim that slice 1 "alone solves the Motivating Problem" is unsupported, because slice 1 is a dogfood inside this repo, with no publish, no `init` and no migration. The spec also bundles three separable products: (a) extracting the library plus migrating local data, (b) the shell redesign (S1–S21, ADR-006), and (c) a self-hosted remote review server with auth, credentials, Postgres and SSE. Slice numbering is inconsistent: MVP Boundary has 8 slices, Build Order has 8 different steps, the Impact table cites "Slice 1–5/6/7" against the MVP numbering, and ADR-006 says "slice 5 compares screenshots", which is build step 6.
- Rationale: The rules call for a sequenced program when distinct product problems are packed together and when no MVP slice solves the Motivating Problem end to end.
- Suggested fix: Split into a sequenced program. Spec 1, extraction: package, today's shell moved off `@proto/ui`, `FileStore` with lossless upgrade (B-001, B-003), `init`, CLI/MCP parity, and migration of the stack template and CompozyOS. Shipping that ends drift for the two local-only copies. Spec 2, remote review: server, auth, credentials, Postgres, reloaddev migration (B-002, B-005–B-007). Spec 3, shell redesign to the ADR-006 contract. Use one slice numbering across the MVP Boundary, Build Order, Impact table and ADRs.

# Nits

## N-001 — Evidence output location is inconsistent

- Section: `_spec.md` § Business Rules (Defaults), `ProtoConfig.evidence`; `_dx.md` § `proto screenshot / evidence`; `docs/design/prototyping.md`
- Issue: Screenshots go to `.proto/evidence/`, `proto evidence` writes `docs/design/login-form/index.html`, and today's code writes `docs/design/<app>/<slug>/index.html`. The open-design record's `preview` URL (`/{slug}?chrome=0`) also changes to `/__proto/render/{slug}`.
- Suggested fix: Define one evidence directory rule for both commands and list the record fields `proto init`/`migrate` rewrite.

## N-002 — The slug pattern changes silently

- Section: `_spec.md` § Business Rules (Identity)
- Issue: The spec's `^[a-z][a-z0-9-]*$` differs from today's `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Leading digits become invalid, trailing and double hyphens become valid, and existing comment keys may be rejected.
- Suggested fix: Keep today's pattern, or state the change and have `proto migrate` report the keys it affects.

## N-003 — The `context.commit` format is ambiguous

- Section: `_dx.md` § `proto comments show`, § HTTP API; `model.ts` (`/^[a-f0-9]{40}$/`)
- Issue: The examples show a 7-character `a41c9e2`, but the parser requires 40 hex characters.
- Suggested fix: Store the full SHA and abbreviate only in human output, and say so in Data Models.

## N-004 — There is no single problem and error code registry

- Section: `_spec.md` § Business Rules; `_dx.md` § Errors
- Issue: `duplicate_slug`, `reserved_slug`, `invalid_meta`, `duplicate_state`, `canvas_missing`, `network_import`, `production_boundary`, `attachment_limit`, `invalid_credential` and a lock-busy 409 appear in tests or code but not in the error table.
- Suggested fix: Add one code table (code, surface, exit/HTTP status) that the CLI, MCP and server all use.

## N-005 — Flow problem-code tests are thin

- Section: `_tests.md` UT-012–UT-018; `_user_stories.md` US-008 EC-1..EC-14
- Issue: Seven of the 14 flow codes have unit cases (`flow_outside_root`, `missing_flow`, `invalid_flow`, `duplicate_node`, `invalid_node`, `unknown_role`, `unknown_spec` have none).
- Suggested fix: Make UT-012 a table test over all 14 codes, ported from CompozyOS `flows.test.ts`.

## N-006 — Some tests freeze prose or pixels, or depend on another repo

- Section: `_tests.md` IT-014, UT-052, E2E-011; `adrs/adr-006.md` Risks
- Issue: Running `_dx.md` transcripts "verbatim" and the column check in UT-052 freeze human output. ADR-006's screenshot comparison contradicts the "no visual regression" Non-Goal. E2E-011 needs the CompozyOS open-design extension.
- Suggested fix: Assert `--json` structures and exit codes only; replace screenshot diffs with a story-level review checklist; check the record format locally (or mark the `lint_artifact` check as manual).

## N-007 — Attachment endpoints and store methods are not keyed consistently

- Section: `_spec.md` § Core Interfaces (`attach`), § API Endpoints, § Data Models
- Issue: `attach(file)` and `GET attachments/:id` carry no key, but `FileStore` keeps attachments per key directory. The API also lacks a `DELETE attachments/:id` route behind the CLI `detach` verb and the shell's discard action.
- Suggested fix: Key attachments (`POST attachments?key=`, `GET attachments/:key/:id`) or define a global pending area plus an index, and add the discard route.

## N-008 — `CommentFilter` is undefined

- Section: `_spec.md` § Core Interfaces; `_user_stories.md` US-021
- Issue: The inbox needs filters on status, author kind, spec, state and "waiting", but the API only lists `key`, `status` and `state`.
- Suggested fix: Define `CommentFilter` and its query parameters, including `waiting` (last message from an agent).

## N-009 — The dev-origin check depends on Host matching

- Section: `_spec.md` § API Endpoints; CompozyOS `trusted-write.ts`
- Issue: The ported check compares `Origin` with the request's `Host`, so DNS rebinding passes unless Vite's `server.allowedHosts` protection stays on.
- Suggested fix: Compare against the configured dev origin and state that `allowedHosts` must not be widened.

## N-010 — The approval state names do not match

- Section: `_spec.md` § Core Features 5 vs § Data Models (Review file)
- Issue: Core Features uses a `reopened` state, but the data model only has `in_review | approved`.
- Suggested fix: Define reopen as a transition (with a recorded event), not a state.

## N-011 — Observability does not cover the failure modes that matter

- Section: `_spec.md` § Monitoring and Observability
- Issue: There are no signals for lock waits or takeovers, migration counts, or credential use and revocation denials.
- Suggested fix: Log lock takeover and 409 conflicts under `--verbose`/server logs, and print per-key counts from `proto migrate`.

## N-012 — The shell bundle budget lives only in an ADR

- Section: `adrs/adr-001.md` (~400 KB gzip); `_spec.md` § Known Risks
- Issue: The budget is stated in ADR-001 but nothing in the spec checks it.
- Suggested fix: Add a size check to the package build gate.

# Evidence

Files read in full or in the relevant parts:

- Spec set: `.compozy/tasks/proto-library/_spec.md`, `_dx.md`, `_uiux.md`, `_user_stories.md`, `_tests.md`, `adrs/adr-001.md`–`adr-006.md`.
- Rules: `CLAUDE.md`, `packages/gallery/CLAUDE.md`, `docs/design/prototyping.md`.
- This repo's code: `packages/gallery/src/node/{comments-store,comments-plugin,attachments-store,paths,source-tags}.ts`, `src/shell/comments/model.ts`, `src/shell/frame-status.ts`, `src/shell/frame.tsx` (contentDocument and contentWindow use), `src/shell/comments/dom.ts` (grep), `src/config.ts`, `src/cli/commands/evidence.ts`, `src/vite.ts`, `node/discovery.ts` (grep for problem codes), `apps/app/{vite.config.ts,vite.presentation.ts,.storybook/main.ts}`, package versions (vitest 5.0.5, vite 8.3.4, playwright 1.64.1).
- CompozyOS: `web/gallery/node/trusted-write.ts`, `node/local-comments.ts`, `node/comments-store.ts` (lock and write sections), `shell/comments/model.ts` (file and sequence types), `node/network-graph.ts` (head), the file list including `__tests__/*`.
- reloaddev: `apps/api/src/modules/prototypes/{credentials,reviews,gallery,attachment-routes}.ts`, `comments.ts` (grep for transaction and counter), `packages/db/src/schema/prototypes.ts`, `apps/platform/gallery/cli/remote-auth.ts` (first 80 lines), `shell/comments/{model,api}.ts` (grep), and the local comment files (all 8 are `version: 1`; sample structure inspected).
- Visual contract: `~/Dev/compozy/stack/apps/app/src/drafts/proto-shell/` file list and state ids in `index.proto.tsx`. It has states for every S1–S21 contract state, plus `drawer`, `flow-summary` and `state-picker`.

Limitations:

- I did not run any code or tests.
- Not read: CompozyOS `cli/commands/screenshot.ts` and its `__tests__` bodies; reloaddev `routes.ts`, `comments.ts` (beyond the grep) and the platform tests; the proto-shell draft components beyond their state ids.
- I did not check claims about the visual-contract layout pixel by pixel.

# Deferred Or Follow-Up

- Q2 (Google OAuth helper): decide this once B-006 defines the sign-in contract; a helper can sit on top of `signIn`.
- Q3 (locales): decide whether URL parameter values (`theme`, state ids) stay locale-independent, given that reloaddev stored `escuro`. This feeds into B-001's mapping table.
- Compact flow-canvas zoom level (ADR-006 alternative) and a Storybook bridge (Non-Goal): revisit after 1.0.
- Ledger and skills: merging CompozyOS `eng-prototype-comments` into the shipped skill needs a follow-up to retire the CompozyOS copy when its migration lands.
