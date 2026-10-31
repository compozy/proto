# Peer review summary — round 1

| Reviewer | Runtime                                                   | Verdict      | Blockers | Nits | Findings                               |
| -------- | --------------------------------------------------------- | ------------ | -------- | ---- | -------------------------------------- |
| Opus     | claude / claude-opus-5-5 (medium) · sess-f21668b7de924d87 | NEEDS_REWORK | 10       | 12   | `peer-review-findings-round1-opus.md`  |
| Astra    | codex / gpt-6-astra (xhigh) · sess-d69afe8d29ecf3f6       | BLOCKED      | 10       | 4    | `peer-review-findings-round1-astra.md` |

Both files passed `validate-findings.sh --kind spec --round 1`.

## Blockers (one line each)

- O-B001 / A-B001 — "v2 unchanged" is false; the comment-file migration is lossy (ids, thread, author, timestamps, reloaddev v1, `fluxo-` keys, theme values).
- O-B002 — `proto migrate` covers only the stack layout; CompozyOS, reloaddev v1 files and reloaddev Postgres have no mapping.
- O-B003 / A-B002 — age-only stale-lock takeover is unsound (no owner token, unconditional release, blocking wait).
- A-B003 (+O-B003.3–4) — comments, approval and id counters have no shared commit boundary; the Postgres schema lacks the counter and `openAtApproval`.
- A-B004 — remote principal has no stable id; message and upload ownership disappear.
- O-B005 / A-B005 — credential escalation, token strength, HTTPS/redirect rules and cookie-write CSRF are unspecified; local approval trust is not stated.
- O-B004 / A-B007 — same-origin iframes let prototype code act as the reviewer; a ready/error-only handshake cannot implement anchored commenting.
- O-B006 / A-B006 — sign-in has no server contract; the token field cannot authenticate assets; the basePath example is wrong.
- O-B007 — `postgresStorage` ships without DDL, migration runner or a complete schema.
- O-B008 / A-B009 — MCP and ReviewStore do not cover the promised operations (attachments, edit, reopen, delete); no capability table.
- O-B009 / A-B010 — deleting `vite.presentation.ts` breaks Storybook/Vitest; `proto()` behavior per build context is unspecified; guards cannot express regex families.
- A-B008 — the prebuilt shell has no bootstrap/transport contract for dev, static read-only and remote; events are inconsistent.
- O-B010 (A-N003) — the MVP does not end drift; three products in one spec; inconsistent slice numbering.

## Nits

Opus N-001–N-012 (evidence dir, slug pattern, full commit SHA, error-code registry, flow-code table test, prose-freezing tests, keyed attachments, CommentFilter, dev-origin check, reopen as transition, observability, bundle budget gate). Astra N-001–N-004 (canonical CLI suite + seeded fixture, packed-tarball adoption test, slice-1 outcome wording, PROTO_POLL/--verbose/S20–S21/auth URL inconsistencies).

## Likely affected

`_spec.md` (Overview, MVP Boundary, Business Rules, Part II almost entirely), `_dx.md`, `_uiux.md` (S8, S9, S17, S18, S21), `_user_stories.md` (US-016, US-019, US-020, US-024, US-028, US-034), `_tests.md`, ADR-002, ADR-004, ADR-005, ADR-006; new ADRs for the program structure, render-origin isolation and the review-state/lock protocol.

## Artifacts

Prompts `peer-review-prompt-round1-{opus,astra}.md`; status `peer-review-status-{before,after}-round1.txt`; findings above.
