# Test Specification: @compozy/proto

Canonical test contract for `@compozy/proto`. Companion to `_spec.md`. Derived from `_user_stories.md`,
`_spec.md` Part II, `_dx.md` (CLI/API journeys) and `_uiux.md` (browser journeys).

## Strategy

- **Frameworks**: Vitest 5 — Node project (`packages/proto/test/node/**`) for registry, store, CLI, MCP,
  server; browser project (Playwright Chromium) for shell and render host (`packages/proto/test/browser/**`).
- **Fixtures**: minimal consumer apps in `packages/proto/test/fixtures/<name>/` (valid, problems, guards,
  empty, roles, flows); temp copies per test (`mkdtemp`). Real git repos where `commit` matters.
- **Fakes**: only at I/O boundaries — Playwright launcher in unit tests of `screenshot`, clock for
  attachment expiry and lock staleness. Store/server suites use the real filesystem and a real Postgres
  database per suite (`TEST_DATABASE_URL`).
- **E2E**: `apps/app` through `proto dev`/`proto build` with Playwright; CLI transcripts from `_dx.md`
  executed verbatim against `apps/app`; remote journeys against `apps/api`.
- **Ported suites**: CompozyOS `web/gallery/__tests__/{comments,discovery,flows,network-guard,view}` and
  reloaddev `apps/platform/tests/gallery*.test.ts` + `apps/api/tests/prototypes.it.test.ts` are the
  starting corpus; IDs below name the invariant each keeps.

## Coverage Matrix

| Source                | Behavior                                                        | Unit                  | Integration            | E2E                                                                  |
| --------------------- | --------------------------------------------------------------- | --------------------- | ---------------------- | -------------------------------------------------------------------- |
| US-001                | init writes files, skills, record                               | UT-040–UT-043         | IT-010                 | E2E-001                                                              |
| US-002                | dev serves, hot updates                                         | —                     | IT-011                 | E2E-001, E2E-002                                                     |
| US-003                | build static, read-only                                         | UT-044                | IT-012                 | E2E-010                                                              |
| US-004                | canvas/frame wrapping                                           | —                     | IT-013                 | E2E-002                                                              |
| US-005                | meta literal, states, markup                                    | UT-001–UT-008         | —                      | E2E-002                                                              |
| US-006                | roles                                                           | UT-009, UT-010        | —                      | E2E-003                                                              |
| US-007                | drafts                                                          | UT-011                | —                      | E2E-002                                                              |
| US-008                | flows + problem codes + coverage                                | UT-012–UT-020         | —                      | E2E-004                                                              |
| US-009                | scaffolding                                                     | UT-045–UT-047         | —                      | —                                                                    |
| US-010–US-011         | overview, spec page                                             | —                     | —                      | E2E-005                                                              |
| US-012                | flow canvas, preview queue                                      | UT-021                | —                      | E2E-004                                                              |
| US-013                | URL state, clamping                                             | UT-022–UT-024         | —                      | E2E-003                                                              |
| US-014                | compare                                                         | —                     | —                      | E2E-003                                                              |
| US-015                | search, shortcuts                                               | UT-025                | —                      | E2E-006                                                              |
| US-016–US-019         | comments lifecycle                                              | UT-026–UT-034         | IT-001–IT-005          | E2E-007                                                              |
| US-018                | attachments limits                                              | UT-035, UT-036        | IT-004                 | E2E-007                                                              |
| US-020                | approval rules                                                  | UT-037, UT-038        | IT-006                 | E2E-008                                                              |
| US-021                | inbox filters                                                   | UT-039                | —                      | E2E-009                                                              |
| US-022–US-023         | CLI JSON + exit codes                                           | UT-048–UT-052         | IT-014                 | E2E-011                                                              |
| US-024                | MCP parity                                                      | —                     | IT-015                 | —                                                                    |
| US-025                | screenshot/evidence                                             | UT-053, UT-054        | IT-016                 | E2E-011                                                              |
| US-026                | skills + record                                                 | UT-043                | —                      | existing: open-design `lint_artifact` on the evidence HTML (E2E-011) |
| US-027–US-030         | remote server, auth, credentials, `--remote`                    | UT-055–UT-058         | IT-020–IT-026          | E2E-012                                                              |
| US-031                | guards                                                          | UT-059–UT-062         | IT-017                 | —                                                                    |
| US-032                | problems panel                                                  | —                     | —                      | E2E-013                                                              |
| US-033                | render failure                                                  | —                     | IT-018                 | E2E-013                                                              |
| US-034                | migrate                                                         | UT-063, UT-064        | IT-019                 | —                                                                    |
| Safety invariants 1–7 | locks, atomic writes, ids, frame trust, origin, no exec, scopes | UT-030–UT-033, UT-065 | IT-003, IT-005, IT-024 | —                                                                    |

## Unit Tests

### Registry (Spec: Implementation Design — registry)

- **UT-001** (happy): `discover(fixtures/valid)` returns `login-form` with kind `component`, 4 states, spec `auth`.
- **UT-002** (happy): `index.proto.tsx` in `src/drafts/review-digest/` → slug `review-digest`, kind `draft`.
- **UT-003** (error): two files with stem `login-form` → problem `duplicate_slug` naming both files.
- **UT-004** (error): slug `flow-intro` → problem `reserved_slug`.
- **UT-005** (error): `meta` built by a function call → problem `invalid_meta` with line.
- **UT-006** (error): duplicate state ids → `duplicate_state`.
- **UT-007** (error): `<div>` in a component prototype → `markup` at the JSX line/column; same file under drafts → no problem.
- **UT-008** (state): discovery never imports the module — a prototype with a top-level `throw` is still listed.
- **UT-009** (error): `roles: ["owner"]` absent from config → `unknown_role`.
- **UT-010** (error): `spec: "billing"` absent from config → `unknown_spec`.
- **UT-011** (happy): drafts outside `drafts` dir with `index.proto.tsx` stay `component`.

### Flows (Spec: flow-graph)

- **UT-012**–**UT-018** (error): one case per code — `unknown_prototype`, `unknown_state`, `unknown_node`, `duplicate_edge`, `unreachable`, `dead_end`, `invalid_flow_id` — each with the offending id in the problem.
- **UT-019** (happy): BFS step numbers for `sign-in.flow.ts` are site=1, sign-in=2, error=3, home=4.
- **UT-020** (happy): `uncovered_state` lists `login-form/pending` when no flow covers it.
- **UT-021** (boundary): preview queue mounts ≤ 3 concurrently and keeps ≤ 12, evicting least recent.

### URL and view model (Spec: shell view)

- **UT-022** (happy): `parseView("?p=login-form&state=error&w=1440&theme=dark")` → screen view.
- **UT-023** (boundary): `w=100` → 320 and `w=9999` → 3840, rewritten URL.
- **UT-024** (state): `?spec` + `?flow` together → flow wins, `spec` dropped.
- **UT-025** (happy): search index ranks exact slug > title > state label > comment text.

### Comment model and FileStore

- **UT-026** (happy): `add` on empty key writes v2 with `sequence: 1`, id 1, `context.commit` = HEAD.
- **UT-027** (state): delete #2 then add → new id 3 (ids never reused).
- **UT-028** (happy): `reply` as agent appends a message with `author.kind = "agent"`.
- **UT-029** (idempotency): `setStatus(resolved)` twice → second returns the same thread, no extra message.
- **UT-030** (concurrency): two `add` calls in parallel on one key → ids 1 and 2, file valid JSON.
- **UT-031** (boundary): lock older than 10 s is taken over; younger lock waits.
- **UT-032** (error): write killed between temp write and rename → original file intact.
- **UT-033** (state): `editMessage` sets `editedAt`, keeps id.
- **UT-034** (happy): v1 file is read and rewritten as v2 losslessly.
- **UT-035** (error): 5 MB + 1 byte PNG → `attachment_too_large`; `text/plain` → `attachment_type`; 7th image → `attachment_limit`.
- **UT-036** (boundary): pending upload older than 24 h is purged on next store open.

### Reviews

- **UT-037** (happy): approve with 2 open → record `openAtApproval: 2`, commit set.
- **UT-038** (state): add comment to approved key → review back to `in_review` + system message.
- **UT-039** (happy): inbox filter `waiting` returns threads whose last message is from an agent.

### Init, build, scaffold, CLI

- **UT-040** (happy): `init` in fixture vite app writes the four files and adds `proto()` to `vite.config.ts`.
- **UT-041** (state): existing `proto.config.ts` → `skipped`; `--force` overwrites.
- **UT-042** (error): no vite config → `not_a_vite_app`.
- **UT-043** (happy): written `docs/design/prototyping.md` has `target: library` and an `evidence` command using `proto evidence`.
- **UT-044** (happy): build output marks read-only when `review.remote` absent.
- **UT-045**–**UT-047** (happy/error): `new --draft`, `new --in`, `slug_taken`.
- **UT-048** (happy): `list --json` matches the `_dx.md` shape.
- **UT-049** (error): `check` exit code 1 with problems, 0 with warnings only.
- **UT-050** (error): unknown command → exit 2 with usage.
- **UT-051** (error): `comments show login-form 99` → exit 1 `comment_not_found`.
- **UT-052** (happy): human output of `comments list` matches the `_dx.md` columns.

### Evidence

- **UT-053** (happy): screenshot path follows `<slug>--<state>--<theme>--<width>.png`.
- **UT-054** (error): launcher missing → exit 3 `playwright_missing`.

### Server

- **UT-055** (error): request without session/bearer → 401 `auth_required`.
- **UT-056** (error): `comment`-scope credential `PUT reviews/:key` → 403 `scope_denied`.
- **UT-057** (happy): credential token returned once; stored as SHA-256 hash.
- **UT-058** (error): revoked credential → 401 `credential_revoked`.

### Guards

- **UT-059** (error): prototype → view → `src/lib/api.ts` (runtime) → `network_import` with chain.
- **UT-060** (happy): `import type` from `src/lib/api.ts` → no problem.
- **UT-061** (error): app production bundle containing a `.proto.tsx` module → `production_boundary`.
- **UT-062** (happy): `productionBoundary: false` disables it.

### Migrate / misc

- **UT-063** (happy): `migrate` maps `gallery.config.ts` specs/roles/siteUrl to `proto.config.ts`.
- **UT-064** (happy): `migrate` moves comments with `git mv`.
- **UT-065** (error): frame-status message from another window or origin is ignored.

## Integration Tests

- **IT-001**: dev API + FileStore — POST comment from same origin → file written, HMR `proto:comments` emitted.
- **IT-002**: CLI reply while gallery open → shell receives event and shows the reply.
- **IT-003**: dev API POST with `Origin: http://evil.test` → 403 `cross_origin_write`, no file change.
- **IT-004**: multipart attachment upload → stored in pending, attached on send, moved beside comments.
- **IT-005**: 20 parallel CLI `reply` processes on one key → 20 messages, valid file.
- **IT-006**: approve via dev API then add comment via CLI → review `in_review`.
- **IT-010**: `proto init` in a fresh `bun create vite` React app → `proto check` exit 0.
- **IT-011**: `proto dev` on fixture; edit a `.proto.tsx` → registry event within 2 s.
- **IT-012**: `proto build` on fixture with a problem → exit 1, no `dist-proto`.
- **IT-013**: render host wraps component prototype in `Frame`, draft not, `standalone` not.
- **IT-014**: every `_dx.md` CLI transcript (local) runs against `apps/app` and matches structured output.
- **IT-015**: MCP tool results equal the CLI `--json` output for the same calls.
- **IT-016**: `proto screenshot` with real Chromium produces a 1440-wide PNG; `proto evidence` HTML has no `<script>`.
- **IT-017**: guard runs in `vite build` of `apps/app` (production) and in `proto build`.
- **IT-018**: prototype that throws → render host posts `error` and the shell shows S16.
- **IT-019**: `proto migrate` on a copy of the stack template app → `proto check` exit 0.
- **IT-020**: `createReviewServer` + `postgresStorage` — full comments CRUD over HTTP.
- **IT-021**: same suite with `fileStorage` (shared contract tests).
- **IT-022**: `HttpStore` against the server satisfies the `ReviewStore` contract suite used by `FileStore`.
- **IT-023**: SSE `events` delivers a `comments` event after a write.
- **IT-024**: agent credential can reply/resolve, cannot approve.
- **IT-025**: `proto auth login` stores credential with mode 0600; `logout` removes it.
- **IT-026**: built gallery served by the server loads and shows remote comments.

## End-to-End Tests

- **E2E-001** (US-001, US-002): fresh Vite app → `proto init` → `proto dev` → gallery shows Welcome.
- **E2E-002** (US-004, US-005, US-007): `apps/app` gallery renders `login-form` states inside `Canvas`, draft without `Frame`.
- **E2E-003** (US-006, US-013, US-014): change state, width, theme, role via UI; reload URL reproduces view; compare shows both themes.
- **E2E-004** (US-008, US-012): open sign-in flow, select `error` step, inspector shows arrives-from/leads-to; uncovered warning visible.
- **E2E-005** (US-010, US-011): overview → spec page → screen.
- **E2E-006** (US-015): ⌘K "wrong" → Enter opens `login-form` at `error`; `?` shows shortcuts.
- **E2E-007** (US-016–US-019): press C, click error text, attach PNG, send → pin #1 with source chip; reply via CLI appears; resolve moves it to Resolved.
- **E2E-008** (US-020): approve with open comment → confirmation → Approved; new comment → In review.
- **E2E-009** (US-021): inbox "Waiting for you" lists the agent-replied thread; click focuses it.
- **E2E-010** (US-003): `proto build` served statically → read-only, no comment tool.
- **E2E-011** (US-022–US-026): agent loop transcript — `list --json`, `comments list --json`, edit, `screenshot`, `evidence`, `reply`, `resolve`; open-design `lint_artifact` accepts the evidence HTML.
- **E2E-012** (US-027–US-030): `apps/api` + built `apps/app` → sign in → comment → `proto comments list --remote` → agent reply → reviewer approves.
- **E2E-013** (US-032, US-033): fixture with a problem shows the top-bar badge and Health list; throwing prototype shows the error card.
