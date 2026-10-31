# Peer review summary — round 2

| Reviewer                       | Verdict | Blockers        | Nits             | Findings                               |
| ------------------------------ | ------- | --------------- | ---------------- | -------------------------------------- |
| Opus (claude-opus-5-5, medium) | BLOCKED | 5 (B-011–B-015) | 10 (N-013–N-022) | `peer-review-findings-round2-opus.md`  |
| Astra (gpt-6-astra, xhigh)     | BLOCKED | 7 (B-011–B-017) | 4 (N-005–N-008)  | `peer-review-findings-round2-astra.md` |

Both files passed `validate-findings.sh --kind spec --round 2`. Both reviewers accept ADR-007 (one spec, two
milestones); Opus asks to restate its rationale (N-022).

## Blockers

- O-B011 / A-B011 — stale-lock takeover still unsound: concurrent reclaimers can evict a fresh lock; a token check
  before rename does not fence publication; foreign-host reclaim; pid reuse.
- O-B012 / A-B015 — bearer principal derivation undefined: remote agent replies stored as reviewer; effective
  scopes after owner downgrade.
- O-B013 — render-side protocol messages trusted; forged `sourceChain` paths reach agents; `context.url` and the
  pinned shell origin come from untrusted input.
- O-B014 — the non-Vite dev shell server lost DNS-rebinding protection for reads.
- O-B015 / A-B012 — migration: `source` path base undefined; `migrate remote` lacks key/value maps; `extra` has no
  Postgres column; v1 defaults overwrite populated optional fields.
- A-B013 — remote migration has no write cutover boundary.
- A-B014 — sibling render host does not isolate parent-domain cookies.
- A-B016 — authorization matrix conflicts with Safety Invariants 8 and 10.
- A-B017 — sign-in example double-prefixes the mount path.

## Nits

Opus N-013 (stale ADR-003/US-027/review.remote), N-014 (inconsistent remote examples, returnTo base), N-015
(schema mismatch 503 vs refuse; advisory lock), N-016 (matrix rows for bootstrap/session/events/render-ticket),
N-017 (locks inside tracked dir; watcher), N-018 (static builds publish review history), N-019 (localhost vs
127.0.0.1), N-020 (CompozyOS dynamic spec catalog), N-021 (evidence base in monorepos), N-022 (ADR-007
rationale). Astra N-005 (attach/detach/discard composition), N-006 (static URL→file mapping), N-007 (render
cookie lifecycle), N-008 (ADR-003 stale).

## Likely affected

`_spec.md` (Safety Invariants, Data Models, Readers, Migration Plan, Authorization Matrix, Auth handoff,
Protocol, Vite Integration, Static build), `_dx.md` (server/HTTP examples, migrate remote, config), `_tests.md`,
`_user_stories.md` (US-003, US-023, US-027, US-029, US-035), `_uiux.md` (S17, S21), ADR-003, ADR-007, ADR-008,
ADR-009.
