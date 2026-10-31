You are an architecture reviewer pressure-testing a Compozy Spec authored by another LLM.
The spec is one document: Part I (Product) and Part II (Technical). Focus the review on
Part II, and flag any inconsistency between Part II and the surface contracts as a blocker.
The product is a new public library, `@compozy/proto` (0.x, experimental), that replaces three
hand-maintained copies of a prototype gallery. Its compatibility duties: consumers' review data
(comment files) must migrate losslessly; the three copies are internal code of their repositories
and may hard-cut; the library's own new public surface is documented experimental until 1.0.
Bias toward simple, deletable internals and boundary-only compatibility.

CONTEXT FILES TO READ (all in /Users/pedronauck/Dev/compozy/proto unless absolute):

- Spec: .compozy/tasks/proto-library/_spec.md
- Surface contracts (frozen public surface): .compozy/tasks/proto-library/_dx.md, .compozy/tasks/proto-library/_uiux.md
- Behavior and tests: .compozy/tasks/proto-library/_user_stories.md, .compozy/tasks/proto-library/_tests.md
- ADRs: .compozy/tasks/proto-library/adrs/adr-001.md … adr-006.md
- Research: none (decisions came from a conversation; the code is the evidence)
- Architecture rules: CLAUDE.md, packages/gallery/CLAUDE.md, docs/design/prototyping.md
- Code being extracted (verify claims against it): packages/gallery/src/** (this repo);
  /Users/pedronauck/Dev/compozy/compozy/web/gallery/** (network guard, screenshot, trusted writes, tests);
  /Users/pedronauck/Dev/courses/reloaddev/apps/platform/gallery/** and
  /Users/pedronauck/Dev/courses/reloaddev/apps/api/src/modules/prototypes/** (remote comments, approval, credentials).
- Visual contract: /Users/pedronauck/Dev/compozy/stack/apps/app/src/drafts/proto-shell/** (read-only)

TARGET FINDINGS FILE:
/Users/pedronauck/Dev/compozy/proto/.compozy/tasks/proto-library/qa/peer-review-findings-round1-astra.md

SCOPED-WRITE CONTRACT:

1. You may write exactly one file: the target findings file above.
2. Do not edit the spec, its companion catalogs, ADRs, research files, source code, tests, configs, docs, ledgers, prompts, summaries, or any other file, in this or any other repository.
3. Do not create sibling artifacts, temp files, backups, or alternate output files.
4. If you cannot write the exact target file, stop and report the failure briefly. Do not print the review findings to stdout as a fallback.
5. After writing the file, your final chat response must be one sentence: `Wrote /Users/pedronauck/Dev/compozy/proto/.compozy/tasks/proto-library/qa/peer-review-findings-round1-astra.md`.

YOUR JOB:

1. Read every context file fully before reasoning; open the cited source files to check the spec's claims.
2. Identify BLOCKERS (issues that prevent approval): unsound concurrency or locking, missing
   migration paths for comment files, under-specified safety invariants, security regressions
   (credential handling, cross-origin writes, iframe message trust, attachment serving, scope
   escalation), Part II designs that diverge from what _dx.md/_uiux.md promise, contracts that
   contradict the existing code without saying so, partial-surface completion (CLI without MCP
   parity, server without HttpStore, etc.), test-shape violations baked into the plan, a
   Motivating Problem that no MVP slice solves end-to-end, and multiple distinct product problems
   packed into one spec where a sequenced program was due.
3. Identify NITS (non-blocking improvements): clarity, naming, test density, observability, doc co-ship.
4. Issue a READINESS verdict: READY / BLOCKED / NEEDS_REWORK.

FINDINGS FILE FORMAT:
Write the target file as Markdown with this exact frontmatter and headings:

---

schema_version: 1
review_kind: spec
round: 1
readiness: READY|BLOCKED|NEEDS_REWORK
reviewer_runtime: codex
reviewer_model: gpt-6-astra
generated_at: <ISO-8601 timestamp>
---

# Summary

Two sentences explaining the readiness verdict.

# Blockers

Use `None.` when there are no blockers. Otherwise, use one item per blocker:

## B-NNN — <short title>

- Section: <spec section anchor or file path>
- Issue: <one paragraph>
- Rationale: <why this blocks approval>
- Suggested fix: <concrete change>

# Nits

Use `None.` when there are no nits. Otherwise, use one item per nit:

## N-NNN — <short title>

- Section: <spec section anchor or file path>
- Issue: <one line>
- Suggested fix: <one line>

# Evidence

List files read and any limitations. Do not invent evidence.

# Deferred Or Follow-Up

List non-blocking follow-ups, or `None.`.
