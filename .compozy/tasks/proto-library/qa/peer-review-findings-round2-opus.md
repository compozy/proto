---
schema_version: 1
review_kind: spec
round: 2
readiness: BLOCKED
reviewer_runtime: claude
reviewer_model: claude-opus-5-5
generated_at: 2026-10-31T02:36:32Z
---

# Summary

The rewrite fully resolves round-1 B-004 and B-006 through B-010, plus B-005 apart from remote authorship. B-001 through B-003 are only partly resolved: migration still loses source-path and remote-key semantics, and the stale-lock takeover can still remove a live lock. Three new security gaps also block approval: remote agent replies are attributed to reviewers, render-side protocol messages are trusted as if their origin made them safe, and the new non-Vite shell server lost the DNS-rebinding protection the current Vite middleware has. Each fix is local to its section, so the verdict is BLOCKED rather than NEEDS_REWORK.

# Blockers

## B-011 — Stale-lock takeover can still remove a live lock (round-1 B-003, partly resolved)

- Section: `_spec.md` § Safety Invariants 2–3; `adrs/adr-009.md` Decision 2; `_tests.md` UT-066, UT-067
- Issue: The takeover renames whatever directory sits at `<key>.lock` at the moment of the rename. Rename is atomic, but nothing makes it conditional on that directory still being the stale lock the reclaimer inspected. Scenario: A and B both read the same stale lock S. A renames S to a tombstone, creates `<key>.lock` and writes its `owner.json`. B, acting on its outdated reading, then renames A's fresh lock to its own tombstone and acquires. Two things follow. (a) A fails with `lock_lost` even though its lock was healthy. (b) If B's rename lands between A's publish-time token check (Invariant 3) and A's own rename, both writers publish. B read the file before A published, so A's change is silently overwritten while A reports success. The claim "atomic, one winner" is therefore false. UT-066 ("loser waits") passes whenever the loser happens to re-check, so it does not exercise this interleaving. Separately, when a process dies and its pid is later reused on the same host, the lock never becomes stale: the liveness check (pid alive) blocks the 10 s rule, and the 30 s fallback applies only to other hosts. That key then fails with `key_busy` until someone deletes the lock by hand.
- Rationale: Safety Invariants 1–3 are the concurrency contract that round 1 asked to make sound. As written, the takeover can still lose an update without any error, and the named test cannot detect it.
- Suggested fix: Serialize takeovers with a second mutex. Reclaimers `mkdir <key>.lock.takeover/`; while holding it, re-read `<key>.lock/owner.json`, and rename only if the token still equals the observed stale token. The takeover mutex is held for milliseconds, so it can be reclaimed by age alone. Alternatively, after the rename, check that the tombstone's token is the stale token, and treat a mismatch as a fatal `lock_lost` for both writers. Add a hard ceiling: a heartbeat older than N × 10 s (for example 60 s) is stale even if the pid is alive, to cover pid reuse. Rewrite UT-066 as a deterministic interleaving: B's rename runs after A's `mkdir`, and the test asserts that no two writers hold the lock.

## B-012 — Remote replies sent with a credential are attributed to a reviewer, not an agent

- Section: `_spec.md` § Business Rules (Authorship), `Principal`, `ReviewServerOptions.credentialOwner`, § Authorization Matrix; `_dx.md` § Server (`credentialOwner` returns `kind: "reviewer"`); `_user_stories.md` US-023 AC-2, US-021 AC-1; `_tests.md` UT-039, E2E-012
- Issue: Remote authorship now comes only from the principal: "authorKind … set by the server, never by the client". A bearer request authenticates as the credential's owner, and the reference `credentialOwner` returns `kind: "reviewer"`. Every remote reply an agent sends through `proto comments reply --remote` or MCP `remote: true` is therefore stored as `author: "reviewer"` under the owner's name. This contradicts US-023 AC-2 ("posts as `agent`"). It also breaks the inbox's "waiting for you" filter (last message from an agent) for every remote project. E2E-012's "agent reply → reviewer approves" cannot tell the two authors apart. Assumptions say "bearer credentials for CLI/MCP only", but the model never turns that into an author kind. Nothing defines the kind of a principal behind a `review`-scope bearer either.
- Rationale: This is a contract contradiction between Part II, the DX example and the stories, and it removes the remote half of the agent and reviewer loop the product exists for.
- Suggested fix: Derive the bearer principal as `{ id: owner.id, kind: "agent", name: "<owner name> · <credential name>", scopes: credential.scopes ∩ owner.scopes }`. In other words, the credential's identity marks the message as agent-authored and the owner id keeps ownership checks working. State that session principals are always `reviewer`. Add an IT-024 row asserting that a bearer reply has `author: "agent"` and an `authorId` equal to the owner. Add the scope intersection on owner demotion as well: today only "loses access" is covered.

## B-013 — Protocol messages from the render side are trusted as if their origin made them safe

- Section: `_spec.md` § Shell ⇄ render protocol, § Safety Invariant 7; `adrs/adr-008.md`; `_tests.md` UT-065, E2E-014; `_user_stories.md` US-016 EC-4
- Issue: The shell accepts a message when it comes from its own iframe, on the render origin, with that frame's nonce. The hostile actor ADR-008 is designed against, though, is the prototype, and the prototype runs in the same JavaScript realm as the render host. It can read the nonce and post any `ready`, `context`, `pick:result` or `anchors` message the render host could. The checks prove only that the message came from the render side, not that it is honest. The consequences matter because agents act on `pick:result` data. A forged `source`/`sourceChain` (for example `../../.github/workflows/ci.yml:1:1` or an absolute path) is stored in the comment, and the shipped skill tells agents to "edit the line from `sourceChain`". Today's `sourceFile()` guards against this with a repo-prefix check and a `..` ban; the spec has no equivalent. `context.url` is likewise unvalidated before the shell writes it into its own URL. Finally, the render host "pins" the shell origin from a parameter in its own URL, so any page that frames the render origin chooses which parent the host trusts. As written, E2E-014 ("forged payloads change nothing") is untestable, because a forged `pick:result` during an active pick is accepted by design.
- Rationale: Iframe message trust is a stated safety invariant, and the gap reaches source paths that agents act on.
- Suggested fix: State in Invariant 7 that render-side messages are untrusted input. Validate every payload with the `src/model` zod schemas. Normalize `source`/`sourceChain` to app-relative POSIX paths, reject `..`, absolute and scheme paths, and require each path to fall under the registry's known source roots. This rule lives in the router, so it also covers `POST comments` from any client. Accept `context.url` only as `/__proto/render/<known slug>?…`. Take the shell origin from the render host's own configuration (the dev CLI or `publicOrigin` baked into the render build), never from its URL. Restate E2E-014 as: forged messages outside an active pick are ignored, and forged `pick:result` paths are rejected by the router.

## B-014 — The new dev shell server lost the DNS-rebinding protection the current dev API has

- Section: `_spec.md` § Vite Integration (row "`proto dev`, shell origin: Node HTTP server (no Vite)"), § Authorization Matrix (closing paragraph)
- Issue: The current dev comments API runs as Vite middleware, so Vite's `server.allowedHosts` check covers it. The spec moves the shell, bootstrap, review router and SSE onto a plain Node server, yet still cites "Vite `allowedHosts` stays at its default" as the protection. That setting does not apply to a non-Vite server. The write path is safe: `Origin` must equal the configured shell origin. Reads have no Origin rule. A page on a hostile domain rebound to `127.0.0.1:4400` becomes same-origin with the shell server and can read `GET comments`, `GET attachments/:key/:id`, `GET registry` (source paths) and the SSE stream. That leaks unreleased designs and review history from any developer machine running `proto dev`.
- Rationale: This is a security regression against the cited existing code, hidden behind a control that does not apply to the new component.
- Suggested fix: Have the shell server reject requests whose `Host` is not on an allowlist (`127.0.0.1:<port>`, `localhost:<port>`, plus configured extras), using the same rule on the render origin's Vite server. Remove the `allowedHosts` sentence or scope it to the render origin. Add an IT-003 sibling: `GET comments` with `Host: evil.test:4400` returns 403.

## B-015 — Migration still loses source-path and remote-key semantics (round-1 B-001 and B-002, partly resolved)

- Section: `_spec.md` § Data Models (Readers and upgrades), § Migration Plan (reloaddev remote row and the `migrate remote` flags); `_dx.md` § `proto comments show`, § `proto migrate`; `_tests.md` UT-034, UT-084, IT-031
- Issue: (a) The spec never defines the base of `target.source`/`sourceChain`. The stack's real files hold repo-relative paths (`apps/app/src/drafts/proto-shell/screen-view.tsx:21:7` in `apps/app/gallery/comments/proto-shell/comments.json`). reloaddev's hold app-relative paths (`src/designs/…`). The `_dx.md` examples are app-relative (`src/components/login-form.tsx:58:27`). The readers table maps no path base, so after migration one project can hold both forms. Agents then edit nonexistent paths, and the source chip links break. This is a semantic loss even though every field survives. (b) `proto migrate remote` takes only `--from-database/--to-database`. reloaddev's Postgres rows use the same `fluxo-` key prefix (`flowKeyPrefix` in `apps/platform/gallery/flow.ts`) and the same localized `context.theme`/`role` values as its local files. Yet the remote mapping row covers neither the key and id rename nor the theme and role maps. Migrated remote flow comments would sit under `fluxo-…` keys the new registry rejects (`flow-` is the reserved prefix), and their contexts would keep `escuro`. (c) Unknown fields are preserved under `extra` in files, but `proto_*` has no column for them. The store contract suite asserts parity between `FileStore` and `HttpStore`+`postgresStorage`, so it either fails on `extra` or must skip it, and the spec says neither.
- Rationale: Lossless migration of review data remains the hard compatibility duty. Round 1 closed the schema shape but not these mappings.
- Suggested fix: (a) Define `source` as app-relative POSIX (matching B-013's validation). Add a reader step that strips the app's repo-relative prefix (`apps/<app>/`) and reports every rewrite, and cover a stack fixture with repo-relative paths in UT-034. (b) Give `migrate remote` the same `--flow-prefix`, `--theme-map` and `--role-map` flags, applied to `proto_keys.key`, comment and message ids and the context JSON, and extend UT-084 and IT-031 with a `fluxo-` key. (c) Add `extra jsonb` to `proto_comments` and `proto_messages` (or define `extra` as file-only and exclude it from the contract suite on purpose).

# Nits

## N-013 — Stale text after the rewrite

- Section: `adrs/adr-003.md` Decision and Implementation Notes; `_user_stories.md` US-027; `_dx.md` config comment on `review.remote`
- Issue: ADR-003 still says "`FileStore` … (v2 JSON)" and "Vite middleware". US-027 AC-1 lists `createReviewServer({ storage, authorize, gallery })` without the now-required `credentialOwner`, `signIn`, `publicOrigin`, `renderOrigin` and `ticketSecret`. `review.remote.url` ("builds talk to this server") no longer matches the bootstrap model, in which the remote server serves its own `bootstrap.json`.
- Suggested fix: Update ADR-003 to v3 and the shell server, update US-027 to the full options, and define `review.remote.url` as the default `--remote` target for the CLI and MCP only.

## N-014 — Remote URL examples contradict each other

- Section: `_dx.md` § HTTP API vs § Server; `_spec.md` § Auth handoff
- Issue: The HTTP API section uses `https://proto.acme.com/api/…` and a `signInUrl` of `https://proto.acme.com/sign-in?returnTo=%2F`. The server example uses `publicOrigin: https://acme.com` with `basePath: "/proto/"` and a function-form `signIn`. The spec does not say whether `returnTo` includes `basePath`: the example prepends `/proto`, while UT-076 says "the requested path".
- Suggested fix: Use one deployment in every example. Define `returnTo` as the full path including `basePath`, and define `signInUrl` for both forms of `signIn`.

## N-015 — Schema-mismatch behavior is defined two ways

- Section: `_spec.md` § Data Models (Postgres) vs `_tests.md` UT-074; `_dx.md` § Server
- Issue: The spec says the server "refuses to start", while UT-074 expects 503 on every route. The example also calls `storage.migrate()` at module load, which races when several instances deploy together.
- Suggested fix: Pick 503-on-every-route (it is testable), and take `pg_advisory_lock` inside `migrate()`.

## N-016 — The authorization matrix omits read and handoff endpoints

- Section: `_spec.md` § Authorization Matrix
- Issue: `GET session`, `GET events`, `GET render-ticket` and `bootstrap.json` have no rows, although IT-024 claims to iterate "every row × column".
- Suggested fix: Add the rows: `bootstrap.json` public; session, events and render-ticket require any authenticated principal; render-ticket is session only.

## N-017 — Lock and pending artifacts sit inside git-tracked review data

- Section: `_spec.md` § Data Models (`proto/review/<key>.lock/`, `proto/review/.pending/`), § Safety Invariant 1
- Issue: Lock directories, tombstones and temp files appear under a tracked folder, and the SSE watcher will fire on heartbeat writes every 2 s.
- Suggested fix: Have `proto init`/`migrate` write a `proto/review/.gitignore` (`*.lock*`, `*.tmp`, `.pending/`), and have the watcher ignore those names.

## N-018 — Static builds now publish all review history by default

- Section: `_spec.md` § Static build output; `_user_stories.md` US-003 AC-2
- Issue: Today's built gallery ships no comments ("served by `proto dev` only" in `docs/design/prototyping.md`). The new `dist-proto/` includes every `review/<key>.json` and attachment, and US-003 deploys it "with my app".
- Suggested fix: Make the snapshots opt-in (`build.includeReview: true`), or warn at build time and document the exposure.

## N-019 — An exact-match dev origin rejects `localhost`

- Section: `_spec.md` § Authorization Matrix (dev)
- Issue: A reviewer who opens `http://localhost:4400` gets `cross_origin_write` on every write, because the only accepted origin is `http://127.0.0.1:4400`.
- Suggested fix: Redirect `localhost` to the canonical origin at the shell server, or accept both loopback spellings.

## N-020 — The CompozyOS spec catalog is dynamic; the migration plan ignores it

- Section: `_spec.md` § Migration Plan (CompozyOS row), § Business Rules (Specs and roles)
- Issue: CompozyOS derives specs from `.compozy/tasks/<id>/` (`web/gallery/node/specs.ts`). That directory is gitignored, so the catalog reports `available: false` in CI and validation is skipped there, and spec ids may contain `_`. A static `specs` map combined with build-failing `unknown_spec` changes both behaviors.
- Suggested fix: State the CompozyOS decision explicitly: a static map maintained by hand, or a `specs` function or loader in config.

## N-021 — The evidence and record path base is ambiguous in monorepos

- Section: `_spec.md` § Business Rules (Defaults), `ProtoConfig.evidence`; § Extensibility
- Issue: The spec does not say whether `docs/design/<slug>/` is resolved against the app root or the repository root. In the stack's multi-app layout, two apps with the same slug would collide at the repository root, and today's code uses `docs/design/<app>/<slug>/`.
- Suggested fix: Resolve `evidence.dir` against the app root (or use `<dir>/<app>/<slug>` at the repository root), and say which.

## N-022 — ADR-007's premise is overstated

- Section: `adrs/adr-007.md` Decision, Alternative 1
- Issue: "Decoupling … means rebuilding it … the same work as building it to the ADR-006 contract" is only partly true. The stack shell already composes BnUI through `@proto/ui` (about 70 imports of `@proto/ui/components/*`, `lib/*` and `hooks/*`), so vendoring those components is mechanical. The forced rewrite comes from ADR-008 (the picker and anchors), not from the redesign.
- Suggested fix: Restate the rationale accurately and mark which redesign surfaces (S2, S3, S7, S11, S13) do not block slice 5, so that migration is never held up by new UI.

# Evidence

Round-1 status, finding by finding:

- **B-001** Partly resolved: v3, readers table, legacy ids, `system` event author and theme map are in place. The open part is B-015 (a).
- **B-002** Partly resolved: the Migration Plan table and `--from`/maps/dry-run/resume are in place. The open part is B-015 (b).
- **B-003** Partly resolved: owner token, heartbeat, `lock_lost`, review state under one lock and Postgres `FOR UPDATE`/`next_comment` are in place. The open part is B-011.
- **B-004** Resolved for the cookie/API boundary: separate render origin, Origin + `X-Proto-Request`, render tickets. Message trust continues in B-013.
- **B-005** Resolved (owner, session-only management, scopes ⊆ issuer's, 256-bit tokens, HTTPS, no redirects, uploader, local trust stated), apart from the remote author kind in B-012.
- **B-006** Resolved, with leftover example inconsistencies in N-014.
- **B-007** Resolved: shipped DDL, `proto_schema`, complete columns. `extra` continues in B-015 (c).
- **B-008** Resolved: capability catalog, MCP exclusions with reasons, `remote` argument.
- **B-009** Resolved: § Vite Integration, `protoPresentation()`, matchers, and deletion of `vite.presentation.ts` gated on the switch.
- **B-010** Resolved through ADR-007 milestones, one numbering and slice outcomes. The rationale is judged below and in N-022.
- **N-001 through N-012** Resolved, except N-009, which became B-014 because the new shell server is not Vite.

ADR-007 judgement: keeping one spec is justified. The store, protocol, catalog and error registry are shared contracts, and each milestone now ends by deleting copies, which answers the round-1 objection. The claim that decoupling equals the redesign is overstated (N-022). This is not blocking as long as the migration slice is not gated on redesign-only surfaces.

Files re-read in this round:

- `_spec.md`, `_dx.md`, `_tests.md` (all three in full).
- `_user_stories.md` (the changed stories), `_uiux.md` (design constraints, S6, S8/S9, S17, S18, S21).
- `adrs/adr-002.md` through `adr-005.md`, `adr-007.md` through `adr-009.md`.
- `qa/peer-review-incorporation-round1.md`.

Code checked in this round:

- This repo: `apps/app/gallery/comments/*/comments.json` (repo-relative `source`); `packages/gallery/src/shell/**` `@proto/ui` import counts.
- reloaddev: `apps/platform/gallery/shell/comments/model.ts:177` (the `legacy-` id rule, confirmed); `apps/platform/gallery/flow.ts:107-108` (`fluxo-` prefix); `apps/platform/gallery/comments/*` (app-relative `src/designs/…` sources).
- CompozyOS: `web/gallery/node/specs.ts` (dynamic spec catalog).

Limitations:

- The re-read of `_user_stories.md` and `_uiux.md` was targeted to the changed sections.
- `adr-001.md`, `adr-006.md` and the updated `pages.tsx` sign-in were not re-read beyond the sign-in button.
- I did not run any code or tests.

# Deferred Or Follow-Up

- Cross-container pid liveness: same hostname, different pid namespace. Document `PROTO_LOCK_HOST` or rely on the heartbeat ceiling from B-011.
- Re-issuing reloaddev credentials: the `rpc_` and `pcr_` formats always differ, so "copy when the scheme matches" never applies. Simplify the plan to "always re-issue" in slice 9.
- Q2 (OAuth helper) and Q3 (locales): unchanged and non-blocking.
