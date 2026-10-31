---
target: library
library:
  ["@proto/ui/components/*", "@proto/ui/hooks/*", "@proto/ui/lib/utils", "@proto/ui/lib/icons"]
catalog:
  - packages/ui/src/components
  - packages/ui/README.md
  - packages/ui/components.json registries (@bnui)
  - "*.stories.tsx (bun run storybook)"
authority: [CLAUDE.md, packages/ui/src/styles/theme.css]
host: vite-app
prototypes: apps/app/src/drafts
entry: "{slug}/index.proto.tsx"
providers: apps/app/preview/canvas.tsx
typecheck: bun run --cwd apps/app typecheck
dev: bun run proto dev
preview: "http://127.0.0.1:4400/{slug}?chrome=0"
evidence: bun run proto evidence {slug}
verified: 2026-10-28
---

# Prototyping

The gallery (`packages/proto`) serves `apps/app`'s prototypes on its own Vite server
(`bun run proto dev`, port 4400) with `apps/app/vite.presentation.ts`, the base of the SPA's own
config. Storybook uses the same config.

`bun run proto build` writes a static, read-only gallery to `apps/<app>/dist-gallery` (part of the
app build). When several apps have a `gallery.config.ts`, pass `--app <name>` to `proto`.

## Authoring

- Component prototypes sit beside the view they compose: `src/**/<slug>.proto.tsx`. They render
  components only (no intrinsic JSX: `proto check` rejects it) with local fixtures. Routes own
  data, auth and navigation; views take props and callbacks (`src/components/login-form.tsx`).
- Drafts explore freely in `src/drafts/<slug>/index.proto.tsx` and are labeled as drafts.
- Each file exports a literal `meta = definePrototype({...})` from `@compozy/proto` and a default
  component receiving `{ state, role }`. `meta` has `title`, `surface`, `route` and `states`;
  optional `spec` (a group of `gallery.config.ts`; the rest are "Unsorted"), `roles` (a subset of
  its roles), `blocks` and `standalone` (skip the app's `PrototypeFrame`). Discovery reads it
  statically; the slug is the file stem, or the folder for `index.proto.tsx`.
- `bun run proto new <slug> --in apps/<app>/src/<folder>` or `--draft` scaffolds one.
- Prototypes and stories never reach the data layer: the presentation guard fails the gallery
  and Storybook when they import (at runtime) the modules and packages listed in
  `vite.presentation.ts`. Production lint and the production build guard keep prototypes,
  fixtures, stories, drafts, flows and preview tooling out of the app. Do not weaken them.
- Every canvas gets `preview/canvas.tsx`: a fresh memory router, toasts and tooltips; no
  QueryClient. Links between prototypes use `protoHref(slug, state)`; state changes use
  `setParam("state", id)`.

## URLs

`/<slug>?state=<id>&theme=light|dark&role=<id>&chrome=0` is the standalone canvas and screenshot
URL. The gallery at `/` gives every level its own link: `?spec=<id>`, `?p=<slug>`,
`?p=<slug>&state=<id>` (plus `theme`, `role`, `w=320–3840`, `compare=themes`, `comments=1`,
`comment=<id>`), and flows `?flow=<id>&node=<id>`. `bun run proto url <slug> [--gallery]` prints one.

## Flows

Journeys live in `apps/<app>/flows/<id>.flow.ts` as a literal `flow = defineFlow({...})` from
`@compozy/proto/flow`, importing nothing else: `title`, optional `spec` and `description`, `start`,
`nodes` (`{ proto, state, role?, end? }` or `{ external: "site" | "auth" | "payment" | "email" |
"other", label?, url?, end? }`) and `edges` (`[from, to, { on, kind? }]`, kinds `navigate`,
`overlay`, `redirect`, `external`). External `url`s are absolute HTTPS, or paths when
`gallery.config.ts` sets `siteUrl`. `proto check` rejects unknown prototypes, states and roles,
unreachable nodes and dead ends, and warns on states of a touched spec that no flow uses.
`proto flow new|list|show|coverage|url` author and inspect them.

## Review comments

Comment mode (C) pins a note to an element or area; flows take notes per step. Comments and
images are local JSON in `apps/<app>/gallery/comments/<slug>/` (commit them with the work), served
by `proto dev` only. Agents use `bun run proto comments list|show|add|reply|resolve|reopen|edit|
delete|attach|detach|attachments`; `show` prints the source location and the commit the note was
written on. Resolve with a note saying what changed.

## Evidence

`bun run proto evidence <slug> [--state id] [--theme dark]` (with `proto dev` running) saves the
rendered DOM to `docs/design/<app>/<slug>/index.html` through Playwright's Chromium.
