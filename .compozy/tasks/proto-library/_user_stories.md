# User Stories: @compozy/proto

Canonical behavior catalog for `@compozy/proto`. Companion to `_spec.md`; consumed by `_spec.md` Part II,
`_uiux.md` (surface states) and `_tests.md` (coverage matrix).

## Personas

- **Builder** — engineer or designer who prototypes with the project's real components before wiring data;
  works in the editor and the local gallery.
- **Reviewer** — product owner or designer who reads prototypes and flows, pins comments and approves;
  works in the browser, locally or on a deployed gallery.
- **Agent** — coding agent (CompozyOS `open-design` designer, Claude/Codex sessions) that authors
  prototypes and answers comments through CLI/MCP; never uses the browser.
- **Operator** — sets up and deploys the remote review server and manages credentials.

## Story Index

| ID     | Feature Area | Persona  | Story                                                             |
| ------ | ------------ | -------- | ----------------------------------------------------------------- |
| US-001 | Adoption     | Builder  | Install and initialize a project with `proto init`                |
| US-002 | Adoption     | Builder  | Run the gallery with `proto dev`                                  |
| US-003 | Adoption     | Builder  | Build a static gallery with `proto build`                         |
| US-004 | Adoption     | Builder  | Provide app providers and chrome through `proto.canvas.tsx`       |
| US-005 | Authoring    | Builder  | Declare a component prototype with states                         |
| US-006 | Authoring    | Builder  | Preview a prototype as a role                                     |
| US-007 | Authoring    | Builder  | Explore a draft with free markup                                  |
| US-008 | Authoring    | Builder  | Declare a flow between prototype states                           |
| US-009 | Authoring    | Builder  | Scaffold prototypes and flows from the CLI                        |
| US-010 | Browsing     | Reviewer | See what exists and what needs review on the overview             |
| US-011 | Browsing     | Reviewer | Open a spec and see its flows and screens                         |
| US-012 | Browsing     | Reviewer | Walk a flow on the canvas with live previews                      |
| US-013 | Browsing     | Reviewer | Inspect a screen state at a viewport, theme and role              |
| US-014 | Browsing     | Reviewer | Compare a state in light and dark                                 |
| US-015 | Browsing     | Reviewer | Find anything with ⌘K and keyboard shortcuts                      |
| US-016 | Review       | Reviewer | Pin a comment to an element or region                             |
| US-017 | Review       | Reviewer | Comment on a flow or a flow step                                  |
| US-018 | Review       | Reviewer | Attach images to a message                                        |
| US-019 | Review       | Reviewer | Reply, edit, resolve and reopen threads                           |
| US-020 | Review       | Reviewer | Approve a prototype or flow                                       |
| US-021 | Review       | Reviewer | Work through every open comment in an inbox                       |
| US-022 | Agents       | Agent    | Read the registry and checks as JSON                              |
| US-023 | Agents       | Agent    | Answer comments from the CLI                                      |
| US-024 | Agents       | Agent    | Operate the gallery through MCP                                   |
| US-025 | Agents       | Agent    | Produce screenshot and DOM evidence of a state                    |
| US-026 | Agents       | Agent    | Follow shipped skills and the open-design record                  |
| US-027 | Remote       | Operator | Deploy a gallery with remote review                               |
| US-028 | Remote       | Reviewer | Sign in to a deployed gallery                                     |
| US-029 | Remote       | Operator | Issue and revoke credentials                                      |
| US-030 | Remote       | Agent    | Answer remote comments with `--remote`                            |
| US-031 | Safety       | Builder  | Keep prototypes off the data layer and out of production          |
| US-032 | Safety       | Builder  | See discovery and flow problems                                   |
| US-033 | Safety       | Reviewer | Understand a prototype that fails to render                       |
| US-034 | Migration    | Builder  | Move an existing gallery copy and its review files to the package |
| US-035 | Migration    | Operator | Move reloaddev's remote review data to the review server          |

## Adoption

### US-001: Install and initialize

**As a** Builder, **I want** `proto init` to set up my Vite app, **so that** I get a working gallery without
copying code.

- AC-1: Given a Vite React app, when I run `bunx proto init`, then `proto.config.ts`, `proto.canvas.tsx`,
  `src/drafts/welcome/index.proto.tsx`, `docs/design/prototyping.md` are created and the command prints the
  next step `proto dev`.
- AC-2: Given `--skills`, when init runs, then `proto` and `proto-apply-comments` are copied to
  `.agents/skills/` and linked to `.claude/skills/`.
- AC-3: Given init finished, when I open `proto.config.ts`, then it type-checks with `defineProtoConfig`.
- EC-1: A file init would write already exists → it is left untouched and listed as `skipped`; `--force`
  overwrites.
- EC-2: No `vite.config.*` in the directory → exit 1 `not_a_vite_app` naming the directory.
- EC-3: Run inside a monorepo root → asks for `--app <dir>`; with `--json` exits 2 `app_required`.

### US-002: Run the gallery

**As a** Builder, **I want** `proto dev`, **so that** I review prototypes with hot reload.

- AC-1: Given a configured app, when I run `proto dev`, then the gallery serves on
  `http://127.0.0.1:4400` and prints the URL.
- AC-2: Given the gallery is open, when I add or edit a `*.proto.tsx` or `*.flow.ts`, then the overview and
  open views update without a manual reload.
- AC-3: Given a prototype file, when I edit the view it renders, then only its iframe hot-reloads.
- EC-1: Port 4400 busy → exit 1 `port_in_use` suggesting `--port`.
- EC-2: Zero prototypes → overview shows the empty state with `proto new` (S14).
- EC-3: Invalid `proto.config.ts` → exit 1 `invalid_config` with the key path.
- EC-4: Render port (`port + 1`) busy → exit 1 `port_in_use` naming both ports.

### US-003: Build a static gallery

**As a** Builder, **I want** `proto build`, **so that** I can publish the gallery with my app.

- AC-1: Given a valid project, when I run `proto build`, then `dist-proto/` holds the shell and render host
  and works from any static host.
- AC-2: Given no remote configured, when I open the built gallery, then comment, approve and credential
  affordances are absent; review history is not included unless `build.includeReview: true`, in which case
  threads and images show read-only.
- EC-1: Any discovery, flow, guard or boundary problem → build fails with the problem list, exit 1.

### US-004: Canvas providers and chrome

**As a** Builder, **I want** to provide my app's providers and production chrome, **so that** prototypes
render like the real app.

- AC-1: Given `proto.canvas.tsx` exports `Canvas`, then every state renders inside it with `theme` and
  `role` props.
- AC-2: Given it exports `Frame`, then component prototypes (not drafts, not `standalone`) render inside
  `Frame` with `route`, `role`, `state`.
- EC-1: `Canvas` missing → states render without providers and `proto check` warns `canvas_missing`.
- EC-2: `Canvas` throws → the render-failure state (US-033) shows the error.

## Authoring

### US-005: Component prototype with states

**As a** Builder, **I want** to declare `meta` with states beside a view, **so that** every state is
reviewable.

- AC-1: Given `login-form.proto.tsx` with `definePrototype({ title, states: [...] })`, then it appears under
  its spec with one entry per state.
- AC-2: Given `?state=error`, then the default export receives `state="error"`.
- EC-1: Unknown `?state=` → first state renders and the shell shows the state as unknown in the URL bar
  chip, not an error.
- EC-2: Duplicate state ids → problem `duplicate_state`.
- EC-3: Intrinsic JSX in a component prototype → problem `markup` with file:line.
- EC-4: `meta` not a literal (computed) → problem `invalid_meta`.

### US-006: Preview as a role

- AC-1: Given `roles: ["member","admin"]` in meta and config, when I pick `admin`, then the prototype
  receives `role="admin"` and `Frame` too.
- EC-1: Role not in config → problem `unknown_role`.

### US-007: Draft

- AC-1: Given `src/drafts/review-digest/index.proto.tsx`, then it is listed under Drafts and may use
  intrinsic markup.
- AC-2: Drafts carry a `draft` badge everywhere they appear.

### US-008: Flow

**As a** Builder, **I want** `defineFlow` with nodes and edges, **so that** journeys are reviewable as a
graph.

- AC-1: Given a valid flow, then it renders with step numbers from a BFS walk of `start`.
- AC-2: Given a state of a used prototype that no flow covers, then the flow shows the warning
  `uncovered_state`.
- EC-1..EC-14: each flow problem code in `_spec.md` Business Rules is reported with node/edge ids.

### US-009: Scaffold

- AC-1: `proto new review-digest --draft` creates `src/drafts/review-digest/index.proto.tsx` from the draft
  template and prints its URL.
- AC-2: `proto new --in src/systems/billing/invoice-view.tsx` creates `invoice-view.proto.tsx` beside it
  importing the view.
- AC-3: `proto flow new checkout --spec billing` creates `flows/checkout.flow.ts`.
- EC-1: Slug exists → exit 1 `slug_taken`.

## Browsing

### US-010: Overview

- AC-1: Given the gallery, when I open `/`, then I see specs with live previews, review status
  (in review · N open / approved), counts, last update, journeys, and a Needs-review list.
- AC-2: Unsorted prototypes and drafts appear in their own groups.
- EC-1: Zero specs configured → prototypes are grouped by Unsorted/Drafts only.
- EC-2: 200 prototypes → overview stays paginated by spec groups and previews load lazily (≤ 3 at a time).

### US-011: Spec page

- AC-1: Given a spec, when I open it, then I see its flows and screens with state counts and open comments,
  and its review status.
- EC-1: Spec with no prototypes → empty state naming `spec: "<id>"`.

### US-012: Flow canvas

- AC-1: Given a flow, then steps render as cards with kind label, route/state and a live preview, edges
  styled by kind with the trigger label.
- AC-2: Selecting a step highlights its incoming and outgoing path and opens the step inspector.
- AC-3: Zoom, fit, auto-layout and a minimap are available; previews mount only above 60% zoom, 3 at a
  time, 12 kept.
- EC-1: External node → never an iframe; shows service and URL.
- EC-2: Flow with problems → canvas shows the problem banner and the offending nodes outlined.

### US-013: Screen state

- AC-1: Given a prototype, then I can switch states, viewport (presets + free width 320–3840), theme
  (light/dark/system) and role, all reflected in the URL.
- AC-2: The URL reproduces exactly what I see when shared.
- EC-1: Width outside 320–3840 in the URL → clamped and the URL rewritten.

### US-014: Compare

- AC-1: Compare shows the same state in light and dark side by side at one width.

### US-015: Search and shortcuts

- AC-1: ⌘K finds prototypes, states, flows, comments and actions; Enter navigates.
- AC-2: `?` shows all shortcuts; J/K previous/next state, [ ] previous/next prototype, T theme, C comment
  mode, / search, Esc closes.
- EC-1: No match → "No results" with the query.

## Review

### US-016: Pin a comment

**As a** Reviewer, **I want** to click or drag on a state and write a comment, **so that** the builder
knows exactly what I mean.

- AC-1: In comment mode, clicking an element shows a numbered pin and a composer; sending stores the
  comment with target and context.
- AC-2: Dragging draws a region; the pin follows the anchor element when layout changes.
- AC-3: The thread shows the source location (`file:line`).
- EC-1: Anchor no longer found → pin shown at last known position with "moved" marker.
- EC-2: Empty body → send disabled.
- EC-3: Keyboard-only: Tab to the canvas, arrows move a crosshair, Enter pins.
- EC-4: A prototype that calls the review API from its own code → rejected (`cross_origin_write` in dev; the
  render origin holds no review cookies remotely); nothing is written.
- EC-6: A prototype forges a `pick:result` whose source is `../../.github/workflows/ci.yml` → the comment is
  refused with `invalid_source`; forged messages outside an active pick are ignored.
- EC-5: The prototype changes its state with `setParam` while picking → the comment records the new state from
  the render host's `context` message.

### US-017: Flow comments

- AC-1: Comments on a flow target the whole flow or a step; steps show their open count.

### US-018: Attachments

- AC-1: Paste, drop or pick up to 6 images per message, previewed before send.
- EC-1: Non-image or > 5 MB → rejected inline with the limit.
- EC-2: Upload not sent within 24 h → discarded.

### US-019: Thread lifecycle

- AC-1: Reply, edit own message (marked edited), resolve (optional note), reopen, delete.
- AC-2: Resolved threads move to the Resolved tab; counts update everywhere.
- EC-1: Two people resolve the same thread → second sees it already resolved (idempotent).
- EC-2: Comment deleted while open in another tab → that tab shows "deleted".
- EC-3: A remote reviewer edits another reviewer's message (even with the same display name) → 403
  `message_not_owned`; the edit control is absent in the UI.
- EC-4: Two writers add comments to one key at the same time → distinct ids; nothing lost.

### US-020: Approval

- AC-1: Reviewer approves a prototype or flow; status shows Approved with author and commit.
- AC-2: Approving with open comments asks for confirmation and records the open count.
- AC-3: A new comment on an approved item moves it back to In review in the same write and records an
  `auto_reopened` event shown in the thread.
- AC-4: Locally, approval is trust-based: the CLI approves with `--confirm-open` when comments are open; the
  skills tell agents never to approve.
- EC-1: Agent credential tries to approve → 403 `scope_denied`.

### US-021: Comments inbox

- AC-1: The Comments area lists every comment across prototypes and flows, filterable by status, author
  kind, spec and "agent replied — waiting for you".
- AC-2: Selecting one opens its prototype/flow at the right state with the thread focused.

## Agents

### US-022: Registry and checks as JSON

- AC-1: `proto list --json` returns the registry; `proto check --json` returns problems/warnings with
  codes, files and lines; exit 1 when problems exist.

### US-023: Answer comments from the CLI

- AC-1: `proto comments list --status open --json` lists threads with `sourceChain` and context.
- AC-2: `proto comments reply <id> --note …` posts as `agent` (locally by default; remotely because every bearer
  credential is an agent principal named `<owner> · <credential>`); `resolve <id> --note …` resolves with a note.
- AC-3: `proto comments attachments <id> --out dir` downloads images.
- EC-1: Unknown key/id → exit 1 `comment_not_found`.

### US-024: MCP

- AC-1: `proto mcp` exposes one tool per catalog capability except approval, credentials, migration and process
  lifecycle; each returns the CLI `--json` output and error codes.
- AC-2: Store-backed tools accept `remote: true` and use the stored credential.
- AC-3: `proto_comments_attachments` writes images under `.tmp/proto/<id>/` and returns their paths.

### US-025: Evidence

- AC-1: `proto screenshot <slug> --state error --theme dark --width 1440` writes a PNG and prints its path.
- AC-2: `proto evidence <slug> --state error` writes a script-free DOM snapshot HTML.
- EC-1: Playwright missing → exit 3 `playwright_missing` with the install command.
- EC-2: Dev server not running → a temporary server is started and stopped.

### US-026: Skills and the open-design record

- AC-1: The shipped skills describe the authoring contract and the comment loop using only public commands.
- AC-2: `docs/design/prototyping.md` contains `target: library`, `entry`, `dev`, `preview` and an `evidence`
  command that produces HTML.

## Remote

### US-027: Deploy remote review

- AC-1: Mounting `createReviewServer({ storage, authorize, credentialOwner, signIn, gallery, publicOrigin,
  renderOrigin, basePath, ticketSecret })` serves the built gallery, the API and the render origin.
- AC-2: `review.remote.url` in config is the default `--remote` target for the CLI and MCP.
- EC-1: `renderOrigin` on the same registrable domain as `publicOrigin` → the server refuses to start unless
  `allowSameSiteRender: true` acknowledges the cookie-isolation precondition.
- EC-2: Database schema older or newer than the package → every route answers 503 `schema_mismatch` until
  `migrate()` runs.

### US-028: Sign in

- AC-1: An unauthenticated visitor opening any gallery URL is redirected to the project's sign-in with
  `returnTo`; after sign-in they land on the URL they asked for.
- AC-2: There is no token field in the browser; credentials are for CLI/MCP.
- EC-1: Session expired mid-comment → the composer draft is kept locally, a banner offers "Sign in again", and
  sending works after returning.
- EC-2: `returnTo` pointing to another origin → replaced by `/`.

### US-029: Credentials

- AC-1: In a browser session (any scope), Settings → Credentials creates a named credential — always scope
  `comment` — shows the token once, lists own credentials with last use, and revokes immediately.
- AC-2: A credential's effective scope is re-evaluated against its owner on every request; it stops working
  when the owner loses comment access.
- EC-1: Revoked credential → 401 `credential_revoked`.
- EC-2: A bearer calling `POST /api/credentials` → 403 `scope_denied`; a bearer approving or deleting → 403.

### US-030: Remote CLI

- AC-1: `proto auth login --remote https://proto.example.com` stores a credential (0600); `--remote` on
  `comments`/`review` uses it.
- EC-1: No credential → exit 4 `auth_required` naming `proto auth login`.
- EC-2: `http://` remote (not loopback) → exit 4 `insecure_remote`; a redirect on a credential-bearing request →
  exit 4 `redirect_refused`.

## Safety

### US-031: Guards

- AC-1: A prototype whose runtime imports reach a `guards.forbidRuntimeImports` module fails dev overlay
  and build with the import chain; type-only imports pass.
- AC-2: A production build that includes a `.proto.tsx`, fixture or gallery module fails with the module.
- AC-3: Storybook and Vitest with `protoPresentation()` fail when a story's runtime imports reach a forbidden
  module; application routes importing it build normally.
- AC-4: Matchers accept globs and RegExp (`src/lib/gateway-*.ts`).

### US-032: Problems

- AC-1: Problems appear in a Problems panel (Settings → Health and a top-bar badge) with file links.

### US-033: Render failure

- AC-1: A prototype that throws shows an error card inside its frame with the message and the component
  stack; the rest of the shell keeps working.
- EC-1: Iframe never reports ready within 10 s → "Still loading" with reload action.

## Migration

### US-034: Migrate an existing copy

- AC-1: `proto migrate --from <comments dir>` rewrites every v1/v2 file to v3 under `proto/review/`, keeping every
  comment, message, attachment (bytes), timestamp, anchor and `sequence`, and prints a per-key report.
- AC-2: With `gallery.config.ts` present it also writes `proto.config.ts`; without it, it still migrates files.
- AC-3: `--flow-prefix fluxo-`, `--theme-map` and `--role-map` rename legacy keys and values; the report lists them.
- AC-4: The source is never deleted; the report lists what to delete, and `vite.presentation.ts` only after
  Storybook and Vitest use `protoPresentation()`.
- EC-1: A target key exists with different content → `migration_conflict`; nothing written for that key.
- EC-2: Running it again → no-op ("already verified").
- EC-3: Interrupted mid-run → the next run resumes; verified keys are skipped.

### US-035: Migrate reloaddev's remote review data

**As an** Operator, **I want** to move reloaddev's `prototype_*` rows to the review server's tables, **so that** no
remote comment, approval or image is lost when its copy is deleted.

- AC-1: `proto migrate remote --dry-run` confirms the source is read-only and reports per-table source/target
  counts and key renames without writing.
- AC-2: The real run copies one transaction per key, keeping authors (id and name), approvals (as events),
  attachment names, sizes, dimensions and bytes, and `next_comment`.
- EC-1: Any count mismatch → `migration_unverified`; the key's transaction rolls back.
- EC-3: The source still accepts writes → `source_not_read_only`, nothing copied; a write lands during the run →
  `migration_source_changed`, the run stops and resumes after the source is read-only again.
- EC-4: `fluxo-` keys and localized theme/role values → renamed with the same flags as the file migration.
- EC-2: Credentials are never copied (`rpc_` vs `pcr_`); the report lists owners to re-issue.
