---
schema_version: 1
review_kind: spec
round: 1
readiness: BLOCKED
reviewer_runtime: codex
reviewer_model: gpt-6-astra
generated_at: 2026-10-31T02:16:00Z
---

# Summary

BLOCKED: the package extraction and independent shell are coherent, but the proposed persistence, authorization and deployment boundaries cannot yet satisfy the frozen review contracts. Approval requires an explicit lossless migration, sound concurrent mutations, and complete shell/server/agent protocols; none of these requires preserving the three internal implementations or introducing a plugin framework.

# Blockers

## B-001 — The proposed v2 format is incompatible with existing v2 review data

- Section: `_spec.md:357` (Data Models), `_spec.md:412` (Impact Analysis), `_user_stories.md` US-034, `_tests.md` UT-034/UT-063/UT-064/IT-019.
- Issue: Impact Analysis says the v2 format is unchanged and migration is a directory move, but the new model replaces string IDs such as `login-form-7` with numeric IDs, `thread` with `messages`, string authors with objects, and message `at` with `createdAt`; it omits existing comment `updatedAt` and `resolvedAt`. The actual v2 model is in `packages/gallery/src/shell/comments/model.ts:76–98`, and the on-disk `apps/app/gallery/comments/proto-shell/comments.json` has that shape. CompozyOS additionally preserves an issued-ID high-water mark. Reload's legacy reader assigns deterministic missing message IDs, and its flow keys use `fluxo-`, not the new reserved `flow-` prefix. Moving these files cannot implement the proposed reader contract, and the one-line remote export plan does not map threads, attachments, ownership, approvals or counters.
- Rationale: This is the explicitly protected compatibility boundary. A new parser would reject existing data or discard review history on its first rewrite; a flow-key change can also orphan threads. Experimental package status does not permit losing consumer state.
- Suggested fix: Either retain the actual persisted v2 schema and adapt it to the new public DTOs, or introduce a distinct schema version with an explicit migration from every existing variant. Specify ID/key mapping, preservation of timestamps, message IDs, anchors and image bytes, collision refusal, resumable completion and destination conflicts; preserve existing counters and state the limit for already-deleted IDs in files that never stored one. Define the Reload database export/import mapping before deleting its module. Extend the canonical migration/store suites with real v1/v2 fixtures, flow keys, attachments and a second no-op migration, rather than treating `git mv` or a stack-only `proto check` as proof of losslessness.

## B-002 — Lock age does not establish exclusive ownership

- Section: `_spec.md:123–124`, `_spec.md:495`; `_tests.md` UT-030/UT-031/IT-005; CompozyOS `web/gallery/node/comments-store.ts:58–88`.
- Issue: The contract declares a lock stale solely because it is older than ten seconds, while also promising at most one writer. A live writer paused by scheduling, debugging or slow filesystem I/O can exceed that age; a second process then takes over and both can publish. The nominated source implementation also performs a separate `stat` followed by recursive removal: two reclaimers can remove a newly acquired lock, and the original owner's unconditional `finally` removal can release its successor's lock. Atomic rename of each JSON file does not prevent lost read-modify-write updates.
- Rationale: The proposed rule is unsound even if ordinary parallel writes pass. Importing the current implementation and its test of a manually aged directory would preserve the defect, contradicting Safety Invariant 1 and potentially losing comments or reusing IDs.
- Suggested fix: Replace age-only reclamation with an ownership protocol that cannot evict a live writer and cannot release another owner's lock; use process-death-aware exclusion or fence an expired owner before it can publish. Specify timeout/retry behavior. In the existing store concurrency suite, cover a paused owner exceeding ten seconds, competing reclaimers and an old owner's release after takeover, in addition to normal parallel CLI calls.

## B-003 — Comments, approval and counters lack a shared commit boundary

- Section: `_spec.md:322–341` (ReviewStore), `_spec.md:357–369` (Data Models), Safety Invariants 2–3; `_tests.md` UT-037/UT-038/IT-006.
- Issue: Adding a comment to an approved key must change both a comments file and a separate review file and add a system line, but the design only specifies individual temp-file renames. It does not say that approval and comment mutations share a lock, how approval's open-count read is serialized, or how a crash between the two renames recovers. The Postgres schema likewise omits a durable per-key sequence and `openAtApproval`, despite promising both, and names `comment_pk` without defining the referenced comment key. Reload currently allocates IDs through a persistent `nextComment` row inside the comment transaction (`apps/api/src/modules/prototypes/comments.ts:81–96`); computing a maximum from remaining rows would reuse deleted IDs.
- Rationale: A successful new comment can leave an item approved, a racing approval can record the wrong open count, and remote reads cannot reproduce the promised approval record. File-level atomicity alone is insufficient for this user-visible state transition.
- Suggested fix: Define one per-key mutation boundary for ID allocation, attachments, comments, approval invalidation and the system line. The simplest local option is one atomic per-key document containing review state; if separate files remain, specify recovery before subsequent reads/writes. In Postgres, use a persisted counter and a transaction locking the key's review/counter row, with explicit keys and the approval-count column. Define the system event representation and persist the count calculated inside the mutation. Add crash/interleaving cases to the canonical store contract suite and run the equivalent transaction cases against both server storages.

## B-004 — Remote ownership disappears from the principal and storage model

- Section: `_spec.md` Core Interfaces/Data Models; `_dx.md:343–354` (Server); `_user_stories.md` US-019.AC-1.
- Issue: The documented authorization callback returns only `kind`, `name` and scopes; messages store only author kind/name and attachments have no uploader identity. That cannot enforce “edit own message” or ownership of pending uploads: two reviewers may have the same name, and names can change. Reload already checks `message.authorId !== authorId` before editing and atomically claims pending images with `uploaderId`, unclaimed status and expiry predicates. Its integration suite explicitly tests two accounts named “Same Name.” Those safeguards cannot be ported into the specified schema or inferred from a caller-supplied `Author`.
- Rationale: This is a concrete security regression and a contradiction of the promised thread lifecycle, not a request for more roles. A scope grants an operation; it does not identify who owns a particular message or upload.
- Suggested fix: Add a stable opaque principal ID to the auth adapter, persist message owner and upload owner separately from display names, and define how a bearer credential maps to that identity. Derive remote authorship from the authenticated principal. Preserve own-message checks and one-time, same-owner, unexpired attachment claims in both storage adapters. Port the existing same-name-account and concurrent-upload cases into the server contract suite.

## B-005 — Remote security policy omits credential escalation and browser-write rules

- Section: `_spec.md:128–130`, `_spec.md:370–388`, `_spec.md:500–503`; `_dx.md` HTTP API/Server; `_tests.md` UT-055–UT-058/IT-024.
- Issue: The server exposes credential create/list/revoke with caller-selected scopes but assigns no required scope or ownership policy to those endpoints; rejecting an agent's direct approval does not prevent it from minting a review credential first. The remote guarantee is only “authorized principal whose scopes include the action,” while the example callback merely reads a session cookie: there is no remote origin/CSRF policy for cookie-authenticated writes, including multipart uploads. The HTTP client contract also drops Reload's explicit HTTPS-or-loopback destination validation and redirect rejection, without saying which layer retains them.
- Rationale: The key safety claim, “agents can never approve,” needs to hold across credential issuance, not just `PUT reviews`. Cookie authentication alone does not prove browser request intent, and unspecified token transport rules can regress existing credential handling. These are missing safety requirements, not evidence that a not-yet-written server has already been exploited.
- Suggested fix: Freeze a small endpoint-to-authority matrix, including credential administration, attachment operations and edits; deny credential management to comment-only principals and forbid issuing broader authority than the issuer may delegate. Define cookie-write origin/CSRF enforcement, bearer handling, and behavior when both credentials are present. Retain HTTPS except loopback and reject credential-bearing redirects/untrusted attachment destinations. Cover escalation attempts and cross-origin session writes in the existing server/HttpStore suites, alongside the direct approval-denial case.

## B-006 — The sign-in surface has no implementable authentication handoff

- Section: `_spec.md` ReviewServerOptions/Remote loop; `_dx.md` Server and `proto auth login`; `_uiux.md` S18; `_user_stories.md` US-028.
- Issue: S18 promises both a provider button and credential field, returning the visitor to the requested URL, but `createReviewServer` only accepts a callback that checks an already-authenticated request. There is no sign-in URL/handler, callback integration or credential-to-browser-session exchange. An entered bearer token can authenticate an explicit fetch, but it does not automatically authenticate `<script>`, iframe navigation or image requests when the built gallery and attachments are protected. Reload's source supplies an actual `/login` route that invokes its auth handler and forwards cookies; merely porting `authorize` does not replace it. Additionally, the example mounts the handler at `/proto/*` without setting the technical contract's `basePath`, whose default is `/`.
- Rationale: A fresh visitor cannot complete the frozen remote journey using the documented server options. Implementers must either invent another public integration surface or expose assets outside the stated authentication boundary; the documented subpath mount also cannot route as specified.
- Suggested fix: Define the smallest auth handoff: for example, an operator-provided sign-in URL/handler plus a documented return-path policy, and an explicit browser session mechanism if token sign-in remains in S18. State which sign-in assets are public and how all remaining gallery/render/attachment requests authenticate. Correct the mount example with its base path and make generated asset, API and login URLs honor it. Exercise a clean browser, token sign-in, expired-session draft recovery and the documented subpath mount in remote E2E.

## B-007 — A ready/error handshake cannot implement anchored commenting

- Section: `_spec.md` Render host/Architectural Boundaries/Known Risks; `adrs/adr-002.md:20–23`; `_uiux.md` S8–S9; `_user_stories.md` US-016.
- Issue: ADR-002 permits shell/render communication only through URL parameters and a postMessage handshake, and Part II specifies that handshake only for ready/error. Existing selection and pin placement instead depend on the iframe's `Document`: `packages/gallery/src/shell/frame.tsx` exposes `contentDocument`, while `comments/use-comment-picker.ts` performs hit testing, scrolling and source extraction against it. No owner or protocol replaces those operations after enforcing the new boundary. The contract also needs current state/context after a prototype invokes `setParam`, not merely the URL originally supplied by the shell.
- Rationale: A copied picker violates the architectural boundary; a strict implementation of the documented handshake cannot produce selectors, source chains or relocated pins. This blocks the central review action even though rendering a prototype would work.
- Suggested fix: Choose and document one approach. Because the design explicitly fixes same-origin iframes, allowing a narrowly scoped DOM bridge is the simplest option; alternatively put picking/anchor resolution in the render host and define typed messages for selection, geometry, context changes and focus. Apply source/origin checks to every message, correlate responses to the current frame/target, and cover click, region, keyboard placement, scroll and state changes in the existing comment E2E journey.

## B-008 — The prebuilt shell has no complete dev/static bootstrap contract

- Section: `_spec.md` System Architecture/API Endpoints; `adrs/adr-002.md`; `_dx.md` URLs/`proto build`; `_uiux.md` S21; `_tests.md` IT-002/IT-023/E2E-010.
- Issue: Part II says the package-built shell talks to `/__proto/api`, while a static host has no middleware and S21 explicitly requires existing threads to remain visible. Build mode only describes emitting shell and render host; it defines neither a registry/config/comment snapshot nor static attachment reads. Dev changes are delivered through Vite HMR, but the existing listener is `import.meta.hot` in `shell/comments/api.ts`, which belongs to the consumer compilation today and cannot be assumed to survive a package production build. `_dx.md` also advertises `GET /api/events` for the API family while Part II makes SSE remote-only. No runtime bootstrap selects dev, read-only or remote transport or provides the consumer's build commit to the prebuilt shell.
- Rationale: A rendering-only build does not satisfy the frozen offline review surface, and a package-built shell cannot inherit consumer HMR/config through compile-time assumptions. The required live CLI-to-browser reply journey and static thread visibility have no defined data path.
- Suggested fix: Specify a small runtime bootstrap containing project metadata/registry location, rendered commit, base URLs and read-only/review mode. For static builds, define the emitted registry and review snapshot/attachment assets and their read adapter. For dev, explicitly connect the shell to runtime events (a shared SSE endpoint would avoid coupling the prebuilt shell to Vite's client); reconcile the events contract across documents. Extend E2E-010 to read a real existing thread/image and IT-002 to use the packaged shell while a separate CLI process replies.

## B-009 — The shared API and MCP catalog do not cover promised review operations

- Section: `_spec.md:322–341`, `_spec.md:380–385`, `_spec.md:426–431`; `_dx.md:239–240`, `_dx.md:359–376`; `adrs/adr-005.md` Decision.
- Issue: The CLI promises attachment downloads and `detach`, and existing editors can add/remove attachments on a message, but `ReviewStore` has only upload and a body-only `editMessage`; it has no binary read, pending discard or attachment-edit operation, and the endpoint list omits discard. Meanwhile the explicit MCP catalog lacks add, edit, reopen, delete and every attachment operation, even though ADR-005 promises the same functions and US-024 promises CLI parity with approval as the named exception. Thus generating both adapters from one command table, as planned, cannot yield the documented surface.
- Rationale: This is a concrete partial-surface design. An MCP-only agent cannot inspect an attached screenshot or complete the promised review loop, and FileStore/HttpStore contract parity cannot validate methods that do not exist.
- Suggested fix: Create one bounded capability table mapping each promised operation to its Node API, store method, HTTP route, CLI verb and MCP tool, with authority and intentional exceptions. Complete the attachment lifecycle in ReviewStore and supply the missing agent-safe MCP tools; keep approval excluded as already specified. Drive IT-015 and the shared store suite from that table, with explicit catalog completeness and file/HTTP behavioral parity, rather than comparing only the current subset.

## B-010 — Config deletion leaves the retained Storybook pipeline without its dependency

- Section: `adrs/adr-004.md` Decision; `_dx.md` `proto migrate`; `_spec.md` Non-Goals/Development Sequencing.
- Issue: Migration tells the consumer to delete `vite.presentation.ts` and `preview/` because the new render host reuses `vite.config.ts`. In this repository, `apps/app/.storybook/main.ts` directly sets `viteConfigPath` to that file, and `apps/app/vitest.config.ts` imports it; the production config also composes it with a production-only boundary guard. The spec explicitly retains Storybook but provides no replacement for those consumers or the distinction between normal app build, prototype build and Storybook build. An unconditional plugin that serves the shell at `/` and rejects prototype modules in builds cannot be used unchanged across all three contexts.
- Rationale: Following the documented migration can break the existing story tests and the repository's required verification gate, even when `proto dev` and `proto check` pass. This conflicts with the retained Storybook workflow and the stated prohibition on weakening presentation guards.
- Suggested fix: Define the internal activation modes of `proto()` and the migration of Storybook/Vitest config and canvas/CSS imports before listing the old files as deletable. Preserve the existing shared compiler/style/guard behavior using the new consumer wiring; no compatibility shim or additional public configuration file is necessary. Gate consumer migration on the existing story/browser suite and normal app build as well as the gallery checks.

# Nits

## N-001 — Test ownership and transcript fixtures need one canonical definition

- Section: `_tests.md` Strategy, UT-048–UT-052, IT-014/IT-015 and E2E-011.
- Issue: The plan repeats CLI transcript coverage across layers without assigning each assertion an owning suite, and “verbatim” examples contain ellipses, illustrative hashes/timestamps and inconsistent sample state counts.
- Suggested fix: Name the canonical CLI contract suite and its deterministic seeded fixture; have E2E assert the connected user journey and MCP assert adapter parity without duplicating the same serialization assertions or freezing decorative console prose.

## N-002 — Validate the distributed package rather than only workspace resolution

- Section: `adrs/adr-001.md` Implementation Notes; `_tests.md` E2E-001.
- Issue: A monorepo consumer can resolve undeclared dependencies and source assets that will be absent from the public tarball.
- Suggested fix: Make the existing fresh-app adoption journey install a packed artifact and verify the documented exports/bin and prebuilt assets, with optional integrations absent until invoked; avoid adding a separate file-existence test suite.

## N-003 — The first slice overstates the outcome it completes

- Section: `_spec.md:208–212` (MVP Boundary) and Development Sequencing.
- Issue: Slice 1 is said to solve the whole Motivating Problem although automatic init arrives in slice 4, review writes in slice 3 and replacement of the maintained copies in slice 7.
- Suggested fix: Name slice 1's outcome as package adoption/rendering, identify the first complete author-review-agent loop, and retain migration/deletion as the explicit drift-elimination gate; the existing staged program is sufficient.

## N-004 — Resolve small contract inconsistencies before generating adapters

- Section: `_spec.md` Config Lifecycle/Known Risks/Build Order; `_dx.md` auth URL; `_uiux.md` S17–S21.
- Issue: `PROTO_POLL` and `--verbose` are introduced outside the declared config/CLI inventory, the build order cites only S1–S19, and auth links to `/settings/credentials` while the URL table uses `/?settings=…`.
- Suggested fix: Reconcile these names and routes in the existing catalogs, and make the shell completion gate cover S20/S21 as well.

# Evidence

All paths below are read-only evidence; no source or contract was changed.

- Read in full: the round-one review prompt; `.compozy/tasks/proto-library/_spec.md`, `_dx.md`, `_uiux.md`, `_user_stories.md`, `_tests.md`; `adrs/adr-001.md` through `adr-006.md`; root `CLAUDE.md`, `packages/gallery/CLAUDE.md`, and `docs/design/prototyping.md`.
- Read the complete visual-contract directory at `/Users/pedronauck/Dev/compozy/stack/apps/app/src/drafts/proto-shell/`: `index.proto.tsx`, `data.ts`, `shell.tsx`, `flow-canvas.tsx`, `screen-view.tsx`, `preview.tsx`, `inspector.tsx`, `overlays.tsx`, `overview.tsx`, `spec-page.tsx`, `inbox.tsx`, `search.tsx`, `pages.tsx`, `settings.tsx`, and `theme.css`. This was source inspection, not rendered visual validation.
- Proto source inspected in full: `packages/gallery/src/{config,contract,flow,main}.tsx/ts` (the actual matching files are `config.ts`, `contract.ts`, `flow.ts`, `main.tsx`); `node/{comments-store,attachments-store,comments-plugin,vite-config,presentation-guard,production-boundary,discovery,literal,source-tags}.ts`; `node/plugins/prototypes.ts`; `shell/frame-status.ts`, `shell/frame.tsx`; `shell/comments/{model,api,use-comment-picker}.ts`; `cli/commands/evidence.ts`.
- Consumer/toolchain evidence: root `package.json`, `packages/gallery/package.json`, `apps/app/vite.config.ts`, `apps/app/vite.presentation.ts`, and `apps/app/.storybook/main.ts` read in full; `apps/app/vitest.config.ts` and workflow references searched for gallery/presentation integration.
- CompozyOS source inspected in full under `/Users/pedronauck/Dev/compozy/compozy/web/gallery/`: `node/{trusted-write,local-comments,comments-store,network-graph}.ts`, `node/plugins/network-guard.ts`, and `cli/commands/screenshot.ts`. Searched the comment model and all five nominated `__tests__` files; read the setup, canonical-file, retired-ID, stale-lock and trusted-write cases in `__tests__/comments.test.ts`. Existing tests were inspected, not run, and their stale-lock case is not proof of safe reclamation.
- Reload API source inspected in full under `/Users/pedronauck/Dev/courses/reloaddev/apps/api/src/modules/prototypes/`: `routes.ts`, `credentials.ts`, `reviews.ts`, `gallery.ts`, `attachment-routes.ts`, `comments.ts`, `attachments.ts`, `image.ts`, `schemas.ts`, and `index.ts`; also `packages/db/src/schema/prototypes.ts` in that repository.
- Reload gallery source inspected in full: `apps/platform/gallery/cli/remote-auth.ts`, `cli/remote-comments.ts`, and `shell/comments/model.ts`; inspected the flow-key definition in `gallery/flow.ts`. Searched `apps/platform/tests/gallery*.test.ts` and `apps/api/tests/prototypes.it.test.ts`, and read the latter's setup, same-name-account ownership case and concurrent attachment-claim case through its authenticated download check.
- A read-only JSON shape inventory found one existing Proto app comment file using legacy v2 fields and eight Reload local comment files using v1 fields. No local comment files were present under CompozyOS's nominated `web/gallery/comments` directory; its format/counter evidence comes from the source and tests, not invented live data. Comment bodies and credentials were not printed by the inventory.
- Limitations: this is a spec/source review, not an exhaustive audit of every source file in the three galleries. No implementation, browser session, database migration, published package installation, `bun run verify`, or test suite was run. Running the repository gate would create build/cache artifacts outside the one-file write authorization. Security findings about the new package describe missing or contradictory contracts, not demonstrated exploits of an implementation that does not yet exist.

# Deferred Or Follow-Up

None beyond the non-blocking improvements above; the blocking fixes belong in the existing spec and its canonical suites, not a new compatibility layer or broader product program.
