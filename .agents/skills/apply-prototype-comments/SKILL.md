---
name: apply-prototype-comments
description: Apply review comments left in the prototype gallery (`bun run proto dev`) to drafts or to the real views composed by component prototypes, verify the commented state, and reply or resolve through the proto CLI. Use for gallery comment ids or requests to process prototype comments; excludes unrelated app features.
---

# Apply prototype comments

Reviewers pin a comment to an element, a region or a flow step in the gallery
(`http://127.0.0.1:4400`, or the port passed to `proto dev`). Apply the note to its owning source,
verify the commented state, and close the loop with `bun run proto comments`. Run every command
from the repository root; add `--app <app>` when the repository has more than one app with a
`gallery.config.ts`.

## Store

Comments are local files, `apps/<app>/gallery/comments/<slug>/comments.json` (flows use the key
`flow-<flow id>`), written only through the CLI or the gallery. The CLI works without the dev
server, and an open gallery picks up CLI changes live. Never edit the JSON by hand and never
delete a comment: deletion is the reviewer's decision.

## Commands

```bash
bun run proto list --json                                    # slugs, kind, file, spec, states
bun run proto comments list [--slug <slug>] [--spec <spec>] [--status open|resolved|all] [--json]
bun run proto comments show <id> --json                      # full thread, context, target
bun run proto comments attachments <id> --out .tmp/review-images
bun run proto comments reply <id> --note "<question or status>"
bun run proto comments resolve <id> --note "<what changed and where>"
bun run proto comments reopen <id> --note "<why>"
bun run proto comments edit <id> --note "<corrected text>" [--message <n>]
bun run proto comments attach <id> <file> [--message <n>]
bun run proto comments detach <id> <attachment-id>
```

`list` defaults to open comments. Ids look like `<slug>-<n>`. `--message` is one-based; without it
`edit`/`attach` target your latest message. Edit only your own replies, never the reviewer's
request. Download and look at attached images before deciding what a visual note asks for.

## Locate the source

`proto list` gives each slug's file and kind:

- **Draft** — `apps/<app>/src/drafts/<slug>/index.proto.tsx` (and the files beside it): free
  markup and fixtures; edit it directly.
- **Component prototype** — `*.proto.tsx` beside a view: it only supplies props and fixtures.
  Change the owning view, not a copy of its layout in the prototype. Intrinsic markup belongs in
  the view; prototypes never import API clients, queries or loaders (the presentation guard fails
  the build). A shared view change reaches production and other prototypes; check their callers.

Read `context.state`, `context.theme`, `context.role` and `context.viewport`: a note made in dark
mode or at 390 px may concern only that combination. `thread[0]` is the request; later messages are
discussion — read the whole thread.

`target.source` is the repo-relative JSX location (`apps/<app>/src/...:<line>:<column>`) of the
element; `target.sourceChain` lists more specific locations first, then the components that
produced them up to the prototype. Pick the location nearest the reviewed screen; fall back to
`selector`, `testId` and `text` when source is missing. `context.commit` is the commit the reviewer
saw; when it differs from HEAD, line numbers may have moved — re-find the element by text.

Flow comments (`flow-<id>`) target a step (`target.node`) or the whole flow (`null`) and usually ask
to change `apps/<app>/flows/<id>.flow.ts` (steps, transitions, labels). When one is about a
screen, open the step's prototype and state from the flow file first.

## Apply and verify

1. List and show the comments in scope, group them by slug, read each prototype's metadata once.
2. Read the project rules first: `CLAUDE.md`, `docs/design/prototyping.md` and the UI tokens in
   `packages/ui/src/styles/theme.css`. Reuse `@<scope>/ui` components; do not change `packages/ui`
   for a prototype note without authorization.
3. Make the smallest change that satisfies the note for its state, theme, role and width.
4. Run `bun run proto check`, the app typecheck (`bun run --cwd apps/<app> typecheck`) and
   lint/format for the touched files; run the owning tests when a real view changed.
5. Open the commented state (`bun run proto url <slug> --state <state> --theme <theme>`) in the
   running gallery, or start `bun run proto dev` if nothing listens on its port. Look at it at the
   comment's viewport width, plus a narrow width when layout changed; `proto evidence <slug>
   --state <state>` saves a static DOM snapshot when a record is needed.
6. Resolve only after the change exists and was verified; the note says what changed and in which
   files. When the note is ambiguous, conflicts with another one or needs work outside its scope,
   `reply` with the concrete question and leave it open.

Report resolved and still-open comments and the checks you ran. Do not commit unless asked.
