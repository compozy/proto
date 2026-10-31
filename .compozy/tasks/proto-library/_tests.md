# Test Specification: @compozy/proto

Canonical test contract for `@compozy/proto`. Companion to `_spec.md`. Derived from `_user_stories.md`,
`_spec.md` Part II, `_dx.md` (CLI/API shapes) and `_uiux.md` (browser journeys).

## Strategy

- **Frameworks**: Vitest 5 — Node project (`packages/proto/test/node/**`) for registry, model, store, router,
  server, CLI, MCP and migrate; browser project (Playwright Chromium) for the shell, render host and protocol
  (`packages/proto/test/browser/**`).
- **Fixtures**: minimal consumer apps in `packages/proto/test/fixtures/<name>/` (valid, problems, guards,
  empty, roles, flows, storybook); **real review files** copied from the three repositories into
  `fixtures/review/{stack-v2,compozy-v2-sequence,reloaddev-v1}/` (bodies anonymized, structure untouched);
  a reloaddev SQL dump fixture for `migrate remote`. Temp copies per test (`mkdtemp`); real git repos where
  `commit` matters.
- **Canonical suites (one owner per invariant)**:
  - _CLI contract suite_ — one seeded fixture (fixed clock, commit, uuids): asserts `--json` shapes and exit
    codes of every catalog verb; human output is not asserted.
  - _Store contract suite_ — the same cases against `FileStore`, `HttpStore`+`fileStorage`,
    `HttpStore`+`postgresStorage`.
  - _Catalog parity suite_ — iterates `catalog.ts`: every CLI verb and MCP tool exists or is listed as an
    exclusion; MCP output equals CLI `--json` for each.
  - _Protocol suite_ — browser tests of shell ⇄ render messages.
- **Fakes**: only at I/O boundaries — Playwright launcher in unit tests of `screenshot`, clock for expiry and
  lock heartbeats, `process.kill(pid, 0)` for lock liveness. Store/server suites use the real filesystem and a
  real Postgres per suite (`TEST_DATABASE_URL`).
- **E2E**: the **packed tarball** installed into a fresh Vite app; `apps/app` through `proto dev`/`proto build`
  with Playwright; remote journeys against `apps/api`. E2E asserts connected journeys, not serialization
  already owned by the CLI contract suite.
- **Ported suites**: CompozyOS `web/gallery/__tests__/{comments,discovery,flows,network-guard,view}` and
  reloaddev `apps/platform/tests/gallery*.test.ts` + `apps/api/tests/prototypes.it.test.ts` are the starting
  corpus; the stale-lock case of CompozyOS is replaced by UT-031/UT-066–UT-068 (age-only reclamation is the
  bug, not the contract).

## Coverage Matrix

| Source                 | Behavior                                 | Unit                                         | Integration            | E2E                                                             |
| ---------------------- | ---------------------------------------- | -------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| US-001                 | init writes files, skills, record        | UT-040–UT-043                                | IT-010                 | E2E-001                                                         |
| US-002                 | dev serves both origins, live updates    | —                                            | IT-011                 | E2E-001, E2E-002                                                |
| US-002.EC-4            | render port busy                         | UT-069                                       | —                      | —                                                               |
| US-003                 | static read-only build with snapshots    | UT-044                                       | IT-012                 | E2E-010                                                         |
| US-004                 | canvas/frame wrapping                    | —                                            | IT-013                 | E2E-002                                                         |
| US-005                 | meta literal, states, markup             | UT-001–UT-008                                | —                      | E2E-002                                                         |
| US-006                 | roles                                    | UT-009, UT-010                               | —                      | E2E-003                                                         |
| US-007                 | drafts                                   | UT-011                                       | —                      | E2E-002                                                         |
| US-008                 | flows, 14 codes, coverage                | UT-012, UT-019, UT-020                       | —                      | E2E-004                                                         |
| US-009                 | scaffolding                              | UT-045–UT-047                                | —                      | —                                                               |
| US-010–US-011          | overview, spec page                      | —                                            | —                      | E2E-005                                                         |
| US-012                 | flow canvas, preview queue               | UT-021                                       | —                      | E2E-004                                                         |
| US-013                 | URL state, clamping                      | UT-022–UT-024                                | —                      | E2E-003                                                         |
| US-014                 | compare                                  | —                                            | —                      | E2E-003                                                         |
| US-015                 | search, shortcuts                        | UT-025                                       | —                      | E2E-006                                                         |
| US-016                 | pin via render protocol                  | UT-065, UT-070                               | IT-027                 | E2E-007                                                         |
| US-016.EC-4            | prototype cannot write reviews           | —                                            | IT-028                 | E2E-014                                                         |
| US-016.EC-5            | state change while picking               | —                                            | IT-027                 | —                                                               |
| US-017                 | flow comments                            | UT-026                                       | —                      | E2E-004                                                         |
| US-018                 | attachments limits and claims            | UT-035, UT-036, UT-071                       | IT-004                 | E2E-007                                                         |
| US-019                 | thread lifecycle, ownership, concurrency | UT-027–UT-033, UT-072                        | IT-005, IT-024         | E2E-007                                                         |
| US-020                 | approval transitions and events          | UT-037, UT-038, UT-073                       | IT-006                 | E2E-008                                                         |
| US-021                 | inbox filters                            | UT-039                                       | —                      | E2E-009                                                         |
| US-022–US-023          | CLI JSON + exit codes                    | UT-048–UT-051                                | IT-014                 | E2E-011                                                         |
| US-024                 | MCP parity                               | —                                            | IT-015                 | —                                                               |
| US-025                 | screenshot/evidence                      | UT-053, UT-054                               | IT-016                 | E2E-011                                                         |
| US-026                 | skills + record                          | UT-043                                       | —                      | E2E-011 (record checked locally; `lint_artifact` run is manual) |
| US-027                 | server, DDL, bootstrap                   | UT-074, UT-075                               | IT-020, IT-021, IT-026 | E2E-012                                                         |
| US-028                 | sign-in handoff                          | UT-076, UT-077                               | IT-029                 | E2E-012                                                         |
| US-029                 | credentials matrix, CSRF                 | UT-055–UT-058, UT-078, UT-086                | IT-024                 | E2E-012                                                         |
| US-030                 | remote CLI policy                        | UT-079, UT-080                               | IT-022, IT-025         | E2E-012                                                         |
| US-031                 | guards in every context                  | UT-059–UT-062, UT-081                        | IT-017, IT-030         | —                                                               |
| US-032                 | problems panel                           | —                                            | —                      | E2E-013                                                         |
| US-033                 | render failure                           | —                                            | IT-018                 | E2E-013                                                         |
| US-034                 | migrate files                            | UT-034, UT-063, UT-064, UT-082, UT-083       | IT-019                 | —                                                               |
| US-035                 | migrate remote                           | UT-084                                       | IT-031                 | —                                                               |
| Safety invariants 1–6  | lock protocol, atomic writes, ids        | UT-030–UT-033, UT-066–UT-068                 | IT-005                 | —                                                               |
| Safety invariants 7–8  | protocol trust, origin isolation         | UT-065, UT-070                               | IT-028                 | E2E-014                                                         |
| Safety invariants 9–12 | ownership, credentials, discovery, HTTPS | UT-008, UT-055–UT-058, UT-072, UT-078–UT-080 | IT-024                 | —                                                               |
| Bundle budget          | shell ≤ 400 KB gzip                      | UT-085                                       | —                      | E2E-001                                                         |

## Unit Tests

### Registry (Spec: Implementation Design — registry)

- **UT-001** (happy): `discover(fixtures/valid)` returns `login-form` with kind `component`, 4 states, spec `auth`.
- **UT-002** (happy): `index.proto.tsx` in `src/drafts/review-digest/` → slug `review-digest`, kind `draft`.
- **UT-003** (error): two files with stem `login-form` → problem `duplicate_slug` naming both files.
- **UT-004** (error): slug `flow-intro` → `reserved_slug`; slug `Intro_1` → `invalid_slug`.
- **UT-005** (error): `meta` built by a function call → `invalid_meta` with line.
- **UT-006** (error): duplicate state ids → `duplicate_state`.
- **UT-007** (error): `<div>` in a component prototype → `markup` at line/column; same file under drafts → no problem.
- **UT-008** (state): discovery never imports the module — a prototype with a top-level `throw` is still listed.
- **UT-009** (error): `roles: ["owner"]` absent from config → `unknown_role`.
- **UT-010** (error): `spec: "billing"` absent from config → `unknown_spec`.
- **UT-011** (happy): `index.proto.tsx` outside `drafts` stays `component`.

### Flows (Spec: flow-graph)

- **UT-012** (error, table): one row per flow code — `flow_outside_root`, `invalid_flow_id`, `missing_flow`,
  `invalid_flow`, `unknown_spec`, `unknown_prototype`, `unknown_state`, `unknown_role`, `duplicate_node`,
  `invalid_node`, `unknown_node`, `duplicate_edge`, `unreachable`, `dead_end` — each fixture yields exactly
  that code with the offending id (ported from CompozyOS `flows.test.ts`).
- **UT-013**–**UT-018** (withdrawn — merged into UT-012).
- **UT-019** (happy): BFS step numbers for `sign-in.flow.ts` are site=1, sign-in=2, error=3, home=4.
- **UT-020** (happy): `uncovered_state` lists `welcome/done` when no flow covers it.
- **UT-021** (boundary): the preview queue mounts ≤ 3 concurrently and keeps ≤ 12, evicting the least recent.

### URL and view model

- **UT-022** (happy): `parseView("?p=login-form&state=error&w=1440&theme=dark")` → screen view.
- **UT-023** (boundary): `w=100` → 320 and `w=9999` → 3840, URL rewritten.
- **UT-024** (state): `?spec` + `?flow` together → flow wins, `spec` dropped.
- **UT-025** (happy): search ranks exact slug > title > state label > comment text.

### Review model and FileStore (Spec: Data Models, ADR-009)

- **UT-026** (happy): `add("login-form", …)` on an empty key writes v3 with `sequence: 1`, id `login-form-1`,
  `context.commit` = full HEAD SHA; on `flow-sign-in` the target is a node target.
- **UT-027** (state): delete `login-form-2` then add → `login-form-3` (`sequence` never decreases).
- **UT-028** (happy): `reply` with `{ kind: "agent" }` appends a message with `author: "agent"`.
- **UT-029** (idempotency): `setStatus(resolved)` twice → second returns the same comment, no extra message.
- **UT-030** (concurrency): two `add` calls in parallel on one key → `-1` and `-2`, valid file.
- **UT-031** (boundary): a lock whose heartbeat is 11 s old and whose pid is dead is taken over; one whose
  heartbeat is 11 s old but pid is alive is **not** taken over (waits → `key_busy` at 5 s).
- **UT-032** (error): a writer killed between temp write and rename → original file intact.
- **UT-033** (state): `editMessage` body change sets `editedAt`, keeps id; `attach`/`detach` update attachments.
- **UT-034** (happy, table over real fixtures): stack v2, CompozyOS v2+sequence and reloaddev v1 files upgrade
  to v3 with every comment, message (ids incl. `legacy-<id>-<i>`), timestamp, anchor, attachment and
  unknown field preserved; v3 → write → read is identity.
- **UT-035** (error): 5 MB + 1 byte → `attachment_too_large`; `text/plain` → `attachment_type`; 7th image →
  `attachment_limit`.
- **UT-036** (boundary): a pending upload older than 24 h is purged on next store open; claiming it →
  `attachment_expired`.
- **UT-066** (concurrency): two reclaimers of one stale lock → exactly one wins (tombstone rename); the loser
  waits.
- **UT-067** (concurrency): a paused owner whose lock was taken over tries to publish → `lock_lost`, nothing
  written; its release does not remove the new owner's lock.
- **UT-068** (state): the waiting path never blocks the event loop (a timer scheduled during the wait fires).

### Reviews (Spec: Approval, ADR-009)

- **UT-037** (happy): approve with 2 open and `confirmOpen` → `approved`, event `openCount: 2`, commit set;
  without `confirmOpen` → error, unchanged.
- **UT-038** (state): add a comment to an approved key → `in_review` and an `auto_reopened` event with the
  comment id, in the same file write.
- **UT-039** (happy): filter `waiting` returns comments whose last message is from an agent; `authorKind`,
  `spec`, `state` filters combine.
- **UT-073** (concurrency): approve and add racing on one key → final state consistent: either approved then
  auto-reopened (two events) or add then approve with `openCount` including the new comment.

### Init, build, scaffold, CLI (CLI contract suite)

- **UT-040** (happy): `init` in a fixture Vite app writes the five files and adds `proto()` to `vite.config.ts`.
- **UT-041** (state): existing `proto.config.ts` → `skipped`; `--force` overwrites.
- **UT-042** (error): no Vite config → `not_a_vite_app`.
- **UT-043** (happy): the written record has `target: library`, `preview` on the render origin and an
  `evidence` command using `proto evidence`, output under `docs/design/<slug>/`.
- **UT-044** (happy): build output contains `bootstrap.json` with `mode: "read-only"`, `registry.json` and
  `review/<key>.json` snapshots + attachments.
- **UT-045**–**UT-047** (happy/error): `new --draft`, `new --in`, `slug_taken`.
- **UT-048** (happy): `list --json` matches the `_dx.md` shape for the seeded fixture.
- **UT-049** (error): `check` exits 1 with problems, 0 with warnings only.
- **UT-050** (error): unknown command → exit 2 with usage.
- **UT-051** (error): `comments show login-form-99` → exit 1 `comment_not_found`.
- **UT-052** (withdrawn — human output is not asserted).

### Evidence

- **UT-053** (happy): screenshot path is `docs/design/<slug>/<state>--<theme>--<width>.png`.
- **UT-054** (error): launcher missing → exit 3 `playwright_missing`.

### Server (Spec: Authorization Matrix, Auth handoff)

- **UT-055** (error): API request without session or bearer → 401 `auth_required` with `signInUrl`.
- **UT-056** (error): `comment`-scope bearer `POST reviews/login-form/transitions` → 403 `scope_denied`.
- **UT-057** (happy): credential token returned once, 64 hex after `pcr_`; stored as SHA-256 only.
- **UT-058** (error): revoked credential → 401 `credential_revoked`.
- **UT-074** (error): server started against a DDL version ≠ expected → 503 `schema_mismatch` on every route.
- **UT-075** (happy): `bootstrap.json` reflects mode, `apiBase` with `basePath: "/proto/"`, render origin.
- **UT-076** (happy): unauthenticated document request → 302 to `signIn` with `returnTo` = requested path.
- **UT-077** (error): `returnTo=https://evil.test/` → replaced by `/`.
- **UT-078** (error): bearer `POST credentials` → 403; `comment` session minting `review` → 403; credential of
  an owner whose `credentialOwner` returns null → 401 `invalid_credential`.
- **UT-086** (error): cookie write with `Origin: https://evil.test` or without `X-Proto-Request` → 403
  `cross_origin_write`; cookie + bearer together → 400 `ambiguous_credentials`.

### Remote client (HttpStore)

- **UT-079** (error): `http://proto.acme.com` → `insecure_remote`; `http://127.0.0.1:8787` accepted.
- **UT-080** (error): a 302 on a credential-bearing request → `redirect_refused`, credential not re-sent.

### Guards (Spec: Vite Integration)

- **UT-059** (error): prototype → view → `src/lib/api.ts` (runtime) → `network_import` with the chain.
- **UT-060** (happy): `import type` from `src/lib/api.ts` → no problem.
- **UT-061** (error): app production bundle containing a `.proto.tsx` module → `production_boundary`.
- **UT-062** (happy): `productionBoundary: false` disables it.
- **UT-081** (happy/error): glob `src/lib/gateway-*.ts` and RegExp matchers match; an application route
  importing `src/lib/api.ts` is not flagged.

### Protocol (Spec: Shell ⇄ render protocol)

- **UT-065** (error): a message from another window, another origin or with a stale frame nonce is ignored.
- **UT-070** (happy): `pick:result` carries selector, testId, tag, text (≤ 120), source, sourceChain (≤ 8), rects.

### Ownership

- **UT-071** (concurrency): two claims of one pending upload → exactly one succeeds; a claim by another
  uploader fails.
- **UT-072** (error): two principals with the same display name — the second cannot edit the first's message
  (`message_not_owned`).

### Migration

- **UT-063** (happy): `migrate` maps `gallery.config.ts` specs/roles/siteUrl to `proto.config.ts`.
- **UT-064** (happy): `--flow-prefix fluxo-`, `--theme-map`, `--role-map` rename keys, ids and values; the
  report lists each rename.
- **UT-082** (error): a target key with different content → `migration_conflict`, other keys proceed.
- **UT-083** (idempotency): a second run is a no-op; an interrupted run resumes.
- **UT-084** (happy): the reloaddev SQL fixture maps users, `next_comment`, approvals and attachments as in
  § Migration Plan.

### Misc

- **UT-069** (error): render port busy → `port_in_use` naming 4400 and 4401.
- **UT-085** (boundary): the built shell bundle is ≤ 400 KB gzip; the build fails above it.

## Integration Tests

- **IT-001**: dev router + FileStore — POST comment from the shell origin → file written, SSE `comments` event.
- **IT-002**: CLI `reply` (separate process) while the packaged shell is open → the shell shows the reply via SSE.
- **IT-003**: dev POST with `Origin: http://evil.test` → 403 `cross_origin_write`, file unchanged.
- **IT-004**: multipart upload → pending; claimed on send; moved beside the key's attachments.
- **IT-005**: 20 parallel CLI `reply` processes on one key → 20 messages, valid file, `sequence` intact.
- **IT-006**: approve via the router then add via the CLI → `in_review` with `auto_reopened`.
- **IT-010**: `proto init` in a fresh Vite React app → `proto check` exits 0.
- **IT-011**: `proto dev` on a fixture; edit a `.proto.tsx` → `registry` SSE event within 2 s.
- **IT-012**: `proto build` on a fixture with a problem → exit 1, no `dist-proto`.
- **IT-013**: render host wraps component prototypes in `Frame`; drafts and `standalone` not.
- **IT-014**: CLI contract suite runs every catalog verb against `apps/app`'s seeded copy.
- **IT-015**: catalog parity suite — every capability has its CLI verb and MCP tool or a listed exclusion; MCP
  output equals CLI `--json`.
- **IT-016**: `proto screenshot` with real Chromium writes a 1440-wide PNG; `proto evidence` HTML has no `<script>`.
- **IT-017**: guards fail `vite build` of `apps/app` when a prototype module leaks; pass with routes importing `api.ts`.
- **IT-018**: a throwing prototype → render host posts `error`; the shell shows S16.
- **IT-019**: `proto migrate` on copies of the stack app and the CompozyOS `web` fixtures → `proto check` exits 0
  and the report verifies every key.
- **IT-020**: `createReviewServer` + `postgresStorage` — store contract suite over HTTP.
- **IT-021**: same suite with `fileStorage`.
- **IT-022**: `HttpStore` satisfies the store contract suite used by `FileStore`.
- **IT-023**: SSE `events` delivers `comments` after a write (dev and remote).
- **IT-024**: authorization matrix — every row × column from § Authorization Matrix, including same-name
  principals and owner revocation.
- **IT-025**: `proto auth login` stores the credential with mode 0600; `logout` removes it; tokens never appear
  in output.
- **IT-026**: a built gallery served by the server shows remote threads; render assets require a valid ticket.
- **IT-027**: protocol — `pick:start` element/region/keyboard → `pick:result`; `anchors:watch` updates on
  scroll/resize; `setParam` emits `context` and the next comment records it.
- **IT-028**: a prototype that `fetch`es the review API (dev and remote) → rejected; nothing written.
- **IT-029**: sign-in handoff with a stub `signIn` → returns to the requested URL; expired session keeps the
  composer draft.
- **IT-030**: Storybook build and Vitest of `apps/app` with `protoPresentation()` fail when a story imports
  `src/lib/api.ts` at runtime.
- **IT-031**: `migrate remote` from the reloaddev dump into an empty Postgres → per-table counts match; a
  forced mismatch rolls back that key (`migration_unverified`).

## End-to-End Tests

- **E2E-001** (US-001, US-002): `npm pack` → install into a fresh Vite app → `proto init` → `proto dev` → the
  gallery shows Welcome from the render origin; exports, bin and prebuilt shell resolve from the tarball.
- **E2E-002** (US-004, US-005, US-007): `apps/app` renders `login-form` states inside `Canvas`, drafts without `Frame`.
- **E2E-003** (US-006, US-013, US-014): change state (picker), width, theme, role; reload reproduces the view;
  compare shows both themes.
- **E2E-004** (US-008, US-012, US-017): open the sign-in flow, select `error`, inspector shows arrives-from/leads-to;
  comment on the step.
- **E2E-005** (US-010, US-011): overview → spec page → screen.
- **E2E-006** (US-015): ⌘K "wrong" → Enter opens `login-form` at `error`; `?` shows shortcuts.
- **E2E-007** (US-016, US-018, US-019): press C, click the error text, attach a PNG, send → pin with source chip;
  CLI reply appears; resolve moves it to Resolved.
- **E2E-008** (US-020): approve with an open comment → confirmation → Approved; new comment → In review with the event.
- **E2E-009** (US-021): inbox "Waiting" lists the agent-replied thread; selecting focuses it in context.
- **E2E-010** (US-003): `proto build` served statically → read-only, existing thread and image visible, no
  comment tool, no Credentials.
- **E2E-011** (US-022–US-026): agent loop — `list --json`, `comments list --json`, edit source, `screenshot`,
  `evidence`, `reply`, `resolve`; the record points at the evidence HTML.
- **E2E-012** (US-027–US-030): `apps/api` + built `apps/app` → sign in → comment → `proto comments list --remote`
  with a comment-scope credential → agent reply → reviewer approves; the agent's approve attempt fails.
- **E2E-013** (US-032, US-033): a fixture with a problem shows the top-bar badge and Health; a throwing
  prototype shows the error card.
- **E2E-014** (US-016.EC-4): a hostile draft that posts to the review API and messages the shell with forged
  payloads changes nothing.
