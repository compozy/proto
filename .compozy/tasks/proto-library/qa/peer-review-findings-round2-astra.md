---
schema_version: 1
review_kind: spec
round: 2
readiness: BLOCKED
reviewer_runtime: codex
reviewer_model: gpt-6-astra
generated_at: 2026-10-31T02:40:58Z
---

# Summary

BLOCKED: the revision supplies the missing storage, protocol and delivery contracts, but lock reclamation remains unsound and several migration and remote-authentication rules still contradict the promised behavior. ADR-007's two milestones are a sufficient sequencing decision; the remaining blockers require bounded corrections to this spec, not three replacement specs or additional compatibility layers.

# Blockers

## B-011 — Checking a lock token before rename does not fence publication

- Section: `_spec.md:766–775` (Safety Invariants 1–4), `adrs/adr-009.md` Decision 2; `_tests.md` UT-067.
- Issue: Round-1 B-002 remains partially unresolved. The revision correctly prevents age-only eviction of a live same-host process, but explicitly allows taking a foreign-host lock after 30 seconds. Writer A can read its matching token, pause immediately before publishing, have writer B take over and commit, and then resume its unconditional temp-file rename over B's result. Re-reading `owner.json` and renaming the review file are separate operations; the token check does not fence the second operation. ADR-009 excludes network filesystems with unreliable atomic operations, but this race also occurs when each individual `mkdir` and `rename` is atomic.
- Rationale: This violates exclusive mutation and can lose comments, approval events and the issued-ID high-water mark. UT-067 can pass if the pause occurs before the token check while missing the failing interleaving after that check.
- Suggested fix: Prefer the smaller supported contract: local, single-host storage; never reclaim a live or foreign-host owner, and document/reject unsupported shared-host use. If cross-host reclamation is retained, specify an exclusion/fencing mechanism that actually prevents the previous owner from publishing after takeover. Extend the existing lock suite's UT-067 to pause after the ownership check and before publication; retain the competing-reclaimer and successor-release cases.

## B-012 — The v1 upgrade table overwrites fields the legacy reader preserves

- Section: `_spec.md:487–496` (Readers and upgrades), `_user_stories.md` US-034.AC-1, `_tests.md` UT-034; Reload `apps/platform/gallery/shell/comments/model.ts:101–103,159–180`.
- Issue: Round-1 B-001 is only partially resolved. The new v1 mapping unconditionally specifies generated message IDs, `editedAt: null` and `attachments: []`. Reload's accepted legacy shape makes those fields optional, and its actual normalizer preserves an existing ID, edit timestamp and attachment list, supplying defaults only when absent. A v1 message with any of those populated fields is accepted today but loses them under the stated mapping. Preserving unknown fields under `extra` does not fix overwriting these known fields.
- Rationale: The mapping contradicts the lossless migration contract and UT-034's preservation requirement. The eight current on-disk v1 fixtures inspected in round 1 do not establish that every accepted legacy message lacks the optional fields.
- Suggested fix: Make all three assignments missing-field defaults, following the existing normalizer; preserve populated values and image bytes. Add a populated-optional-fields case to the existing upgrade/migration suite alongside the real fixtures, and verify the resulting v3 write/read round trip. Keep the documented limitation for numbers deleted before a source ever stored a sequence.

## B-013 — Remote migration has no write cutover boundary

- Section: `_spec.md:638–654` (Migration Plan), `_spec.md:674–676` (Impact Analysis), `_user_stories.md` US-035, `_tests.md` IT-031.
- Issue: The remote part of round-1 B-001 remains incomplete. Transactions per destination key and count verification do not define when the source stops accepting writes or when traffic switches to the new server. A key can be copied and verified, then receive a reply, attachment or approval in the old API before that module is removed; the migration report remains successful while the replacement lacks the accepted change. The specified test imports a static dump into an empty database and cannot establish a safe live cutover.
- Rationale: The milestone promises to delete Reload's implementation without losing remote review data. Leaving the old tables available for later deletion preserves a recovery source, but does not make the new service's history complete or its approval state correct.
- Suggested fix: Specify a short maintenance cutover: stop and drain all old review writers, keep the source read-only during copy and verification, verify from that stable source, switch readers/writers, then permit deletion. State retry/conflict behavior after a partially completed import. Extend IT-031 to cover an interrupted import and a source write attempted across the cutover boundary. No dual-write or synchronization subsystem is needed.

## B-014 — A sibling render host does not establish the promised cookie isolation

- Section: `_spec.md:572–576`, `_spec.md:780–781`, `adrs/adr-008.md` Decision; `_dx.md:434–459`; `_tests.md` E2E-014.
- Issue: The remote security work from round-1 B-005 is incomplete. The spec says the render host never receives review cookies because it uses a separate host, `SameSite=Strict` and no CORS, but the suggested hosts are same-site siblings. A project session cookie with `Domain=acme.com; Path=/` is sent to `render.acme.com`; SameSite does not separate those hosts, and CORS is not a cookie-domain restriction. The arbitrary project auth adapter has no required host-only/HttpOnly cookie contract. Domain scoping and same-site versus same-origin are distinct browser rules ([RFC 6265 §4.1.2.3](https://www.rfc-editor.org/rfc/rfc6265#section-4.1.2.3), [Chrome team's same-site explanation](https://web.dev/articles/same-site-same-origin)).
- Rationale: The origin/header checks can still prevent direct browser API writes, but they do not prove the stronger credential-isolation claim. A script-readable parent-domain session cookie would be available to prototype code, allowing credential exfiltration despite that write gate.
- Suggested fix: State and demonstrate the supported auth deployment precondition: review session credentials must be host-only, Secure and HttpOnly, with no parent-domain credential shared with the render host. If the project's existing login requires a shared-domain cookie, use a render domain outside that cookie scope or a narrowly specified session handoff. Keep the Origin/header protection. Extend the existing hostile-draft browser journey to verify cookie isolation, not only rejection of direct API writes; document the adapter requirement beside the server example.

## B-015 — Bearer authentication lacks a rule for effective scopes and author kind

- Section: `_spec.md:125–128`, `_spec.md:410–419`, `_spec.md:783–784`; `_dx.md:456–460`; `_tests.md` IT-024 and E2E-012.
- Issue: Round-1 B-004's stable ownership fields are now present, but the server-side construction of a bearer principal remains unspecified. The example's `credentialOwner` always returns a reviewer with both scopes, while a stored credential has its own scopes and no author-kind field. Inheriting that principal would label CLI/MCP replies as reviewer messages and could broaden a comment credential; using only stored token scopes would retain review authority after the owner is downgraded to comment-only without losing all access. Client-supplied authorship is explicitly forbidden, so it cannot supply the missing agent classification.
- Rationale: E2E-012 promises an agent reply, and the Waiting inbox depends on that classification. More importantly, the new revalidation callback does not yet specify how partial permission loss affects existing credentials; rejecting only a null owner is insufficient.
- Suggested fix: Define one internal bearer-principal derivation: stable owner identity, effective scopes no broader than both the stored credential and the owner's current scopes, and an explicit server-derived author-kind rule for CLI/MCP credentials. No additional public adapter is necessary. Cover an owner downgraded from review to comment in IT-024, and assert that the remote agent reply is classified correctly in the existing E2E-012/inbox journey.

## B-016 — The authorization matrix conflicts with the safety invariants

- Section: `_spec.md:563–584`, `_spec.md:780–784`; `_uiux.md` S17; `_user_stories.md` US-029; `_dx.md:387–389`; `_tests.md` IT-024.
- Issue: Round-1 B-005 cannot be closed while two normative policies disagree. The matrix and S17/US-029 allow a comment-scoped browser session to manage its own credentials within its scopes, whereas Safety Invariant 10 says comment scope never manages credentials. Separately, the API/DX distinguish session writes from bearer writes, but Safety Invariant 8 and ADR-008 require `publicOrigin` plus `X-Proto-Request` for remote writes without the bearer exception. An implementation cannot follow both the unconditional invariants and the advertised authority matrix.
- Rationale: These are public authorization decisions, not wording that adapters may independently interpret. Matrix-generated tests could approve behavior another required invariant forbids, or the remote CLI could be rejected for lacking browser-origin headers.
- Suggested fix: Make the matrix authoritative and reconcile every restatement. Either allow comment-scoped sessions to administer only their own bounded credentials and qualify the invariant accordingly, or deny that row and update S17/US-029. Explicitly distinguish cookie-write CSRF checks from bearer authentication, while continuing to reject ambiguous credentials. Keep both positive and negative cases in IT-024 rather than adding another authorization suite.

## B-017 — The documented sign-in callback prefixes the mount path twice

- Section: `_spec.md:593–595`, `_dx.md:436–444`, `_user_stories.md` US-028.AC-1, `_tests.md` UT-076 and IT-029.
- Issue: Round-1 B-006 is substantially addressed by the handoff and removal of browser token entry, but the corrected subpath example still disagrees with the return-path contract. Part II passes the requested same-origin path as `returnTo`; for `/proto/?p=login-form`, the DX callback prepends `/proto` again and sends the login provider `next=/proto/proto/?p=login-form`. If the intended value is instead mount-relative, that needs to replace the specified requested-path rule consistently.
- Rationale: Copying the frozen integration example fails the promised return-to-requested-URL behavior for the very mount it demonstrates. Testing a stub handoff without the documented callback does not catch this contract mismatch.
- Suggested fix: Choose origin-relative `pathname + search` as the return value and forward it unchanged in this example, or explicitly define and consistently join a mount-relative value. Exercise the documented `/proto/` callback and a query-bearing gallery URL in IT-029 or E2E-012, retaining the external-return rejection case.

# Nits

## N-005 — Distinguish sent-image detachment from pending-upload discard

- Section: `_spec.md:613` (Capability Catalog), `_spec.md:585–588`, `_dx.md:271–277`; follow-up to round-1 B-009.
- Issue: The required methods and tools now exist, but the grouped `edit / attach / detach` row associates them with `editMessage/upload/discard` and a pending-only DELETE route, leaving the composition for detaching an already sent image unclear.
- Suggested fix: Spell out attach as upload plus `editMessage({ attach })`, detach as `editMessage({ detach })`, and discard as cleanup of a pending upload; let the existing store and catalog suites own those behaviors.

## N-006 — Give static assets their exact URL-to-file mapping

- Section: `_spec.md:521–530`, `_dx.md` URLs, `_tests.md` E2E-010; follow-up to round-1 B-008.
- Issue: The bootstrap endpoint is `/__proto/bootstrap.json`, but the output list names `bootstrap.json` and `render/` without explaining how a plain static host satisfies the shell and render URLs.
- Suggested fix: Show the emitted directory paths and render entry URL explicitly, including subpath deployment if supported, and run E2E-010 on a plain static server without hidden development rewrites.

## N-007 — Complete the render-cookie lifecycle alongside its implementation

- Section: `_spec.md:596–598`, `adrs/adr-008.md`, `_tests.md` IT-026.
- Issue: Tickets have a 60-second, one-slug scope, but the exchanged cookie's lifetime, scope and behavior with several concurrently mounted prototype slugs are not specified.
- Suggested fix: Define the read-only render grant and expiry/renewal rule, ensure concurrent preview cookies do not invalidate each other, and cover two distinct slugs plus expiry in the existing server/render integration suite.

## N-008 — Remove the stale v2 and Vite-middleware descriptions from ADR-003

- Section: `adrs/adr-003.md` Decision and Negative consequences.
- Issue: ADR-003 still describes FileStore as v2 JSON and dev as Vite middleware, although its own implementation notes and Part II now require v3 and the separate Node shell server.
- Suggested fix: Update those two descriptions to match ADR-009 and the current shared-router hosting design.

# Evidence

Read in full for round 2: `.compozy/tasks/proto-library/qa/peer-review-prompt-round2-astra.md`; the revised `_spec.md`, `_dx.md`, `_uiux.md`, `_user_stories.md`, `_tests.md`; `adrs/adr-001.md` through `adr-009.md`; both round-1 findings files; and `qa/peer-review-incorporation-round1.md`. Paths without a repository prefix in this review are relative to `.compozy/tasks/proto-library/`.

Read the changed visual-contract file `/Users/pedronauck/Dev/compozy/stack/apps/app/src/drafts/proto-shell/pages.tsx` in full: `SignInPage` now has the provider handoff button and no token field. Rechecked Reload's `apps/platform/gallery/shell/comments/model.ts:101–180` and `node/comments-store.ts:79–92` for accepted legacy normalization, and searched its API `credentials.ts` and CLI `remote-auth.ts` for the current token/digest format. The remaining unchanged source, architecture rules and visual-contract evidence are the files recorded in this reviewer's round-1 Evidence section; they were not all reread in round 2. Browser cookie claims were checked against the linked RFC and Chrome documentation, not inferred from the proposed implementation.

Disposition of every round-1 finding:

| Round-1 ID | Round-2 disposition                | Evidence and remaining work                                                                                                                                                                          |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-001      | Partially resolved                 | Actual v2 names, distinct v3, counters, key/value maps, attachment metadata and remote mapping now exist; B-012 and B-013 remain.                                                                    |
| B-002      | Partially resolved                 | Same-host liveness, bounded asynchronous waits and ownership checks improve the design; B-011 remains.                                                                                               |
| B-003      | Resolved at the aggregate boundary | One per-key document includes review/events; Postgres has a persisted counter, events/open count and a key-row transaction. Local exclusion still depends on B-011, not a separate cross-file issue. |
| B-004      | Partially resolved                 | Stable principal/message/upload IDs and conditional claims address ownership; bearer-principal derivation remains B-015.                                                                             |
| B-005      | Partially resolved                 | Session-only issuance, bounded grants, owner lookup, CSRF headers, ambiguous-credential rejection and HTTPS/no-redirect rules exist; B-014–B-016 qualify the remaining gaps.                         |
| B-006      | Partially resolved                 | Auth handoff, API 401 behavior, render tickets, explicit basePath and token-free browser sign-in now exist; B-017 remains, with N-007 as implementation clarification.                               |
| B-007      | Resolved                           | Picker, anchor geometry, context and scroll have render-side owners and typed messages; frame/origin/nonce checks and the existing browser suite own the boundary.                                   |
| B-008      | Resolved in substance              | Runtime bootstrap, static review/image snapshots, read-only adapter and shared SSE replace the missing data paths; N-006 requests exact static-path notation.                                        |
| B-009      | Resolved in substance              | Store attachment reads/edits/discard and the full MCP catalog are present, including remote arguments and explicit exclusions; N-005 clarifies composite operations.                                 |
| B-010      | Resolved                           | Per-context plugin behavior, `protoPresentation()`, retained Storybook/Vitest guards and conditional deletion gates are specified.                                                                   |
| N-001      | Resolved                           | Canonical suites and deterministic JSON/exit-code assertions replace human transcript/pixel assertions; UT-052 is withdrawn.                                                                         |
| N-002      | Resolved                           | E2E-001 installs the packed tarball into a fresh consumer; package/build budget is assigned.                                                                                                         |
| N-003      | Resolved                           | ADR-007 and both sequencing sections use matching slices and explicit migration/deletion exits; slice 1 no longer claims to eliminate all drift.                                                     |
| N-004      | Resolved                           | Polling and verbose flags are declared, S20/S21 have gates, and the credential settings route is consistent.                                                                                         |

ADR-007 is acceptable: Milestone 1 delivers adoption, a local review/agent loop and deletion of two copies; Milestone 2 includes the server, HttpStore and Reload migration before claiming the third deletion. Building the approved shell directly on the package's own components is a defensible choice even though every redesign detail is not technically forced by extraction. The shared contracts and explicit exits are sufficient here; no additional product split is required for approval.

Limitations: this is a contract/source review, not an implementation audit or a demonstrated exploit. No test suite, browser session, database migration, package installation or `bun run verify` was run; those actions could create artifacts outside the one-file write authorization. Only the named round-2 findings file was written. The v1 populated-field case and lock interleaving are deductions from the specified algorithm and accepted source shapes, not claims of observed production loss.

# Deferred Or Follow-Up

None beyond N-005–N-008. The blocking corrections belong in this spec and its existing canonical suites; they do not require a general migration framework, a synchronization service or compatibility shims for the deleted internal copies.
