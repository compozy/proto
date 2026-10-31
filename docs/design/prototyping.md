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
providers: apps/app/proto.canvas.tsx
typecheck: bun run --cwd apps/app typecheck
dev: bun run proto dev
preview: "http://127.0.0.1:4401/__proto/render/{slug}?chrome=0"
evidence: bun run proto evidence {slug}
verified: 2026-10-28
---

# Prototyping

The gallery (`packages/proto`) serves a prebuilt shell on port 4400 and compiles the app's
prototypes through the consumer Vite pipeline on port 4401. Storybook uses `vite.shared.ts`
and `protoPresentation()`. When several apps have `proto.config.ts`, pass `--app <name>`.

`proto build` validates registry and render compilation before producing the existing legacy
`dist-gallery` output. The new isolated static packaging is supplied by slice 6.

## Authoring

- Component prototypes sit beside the view they compose: `src/**/<slug>.proto.tsx`. They render
  components only (no intrinsic JSX: `proto check` rejects it) with local fixtures. Routes own
  data, auth and navigation; views take props and callbacks (`src/components/login-form.tsx`).
- Drafts explore freely in `src/drafts/<slug>/index.proto.tsx` and are labeled as drafts.
- Each file exports a literal `meta = definePrototype({...})` from `@compozy/proto` and a default
  component receiving `{ state, role }`. `meta` requires `title` and `states`; `surface` and `route` are optional;
  optional `spec` (a group of `proto.config.ts`; the rest are "Unsorted"), `roles` (a subset of
  its roles), `blocks` and `standalone` (skip the app's `Frame`). Discovery reads it
  statically; the slug is the file stem, or the folder for `index.proto.tsx`.
- `bun run proto new <slug> --in src/components/view.tsx --app <app>` or `--draft` scaffolds one.
- Prototypes and stories never reach the data layer: the presentation guard fails the gallery
  and Storybook when they import (at runtime) the modules and packages listed in
  `proto.config.ts`. Production lint and the production build guard keep prototypes,
  fixtures, stories, drafts, flows and preview tooling out of the app. Do not weaken them.
- Every canvas gets `proto.canvas.tsx`: a fresh memory router, toasts and tooltips; no
  QueryClient. Links between prototypes use `protoHref(slug, state)`; state changes use
  `setParam("state", id)`.

## URLs

`/__proto/render/<slug>?state=<id>&theme=light|dark&role=<id>&chrome=0` is the standalone canvas and screenshot
URL. The gallery at `/` gives every level its own link: `?spec=<id>`, `?p=<slug>`,
`?p=<slug>&state=<id>` (plus `theme`, `role`, `w=320–3840`, `compare=themes`, `comments=1`,
`comment=<id>`), and flows `?flow=<id>&node=<id>`. `bun run proto url <slug> [--bare]` prints one.

## Flows

Journeys live in `apps/<app>/flows/<id>.flow.ts` as a literal `flow = defineFlow({...})` from
`@compozy/proto/flow`, importing nothing else: `title`, optional `spec` and `description`, `start`,
`nodes` (`{ proto, state, role?, end? }` or `{ external: "site" | "auth" | "payment" | "email" |
"other", label?, url?, end? }`) and `edges` (`[from, to, { on, kind? }]`, kinds `navigate`,
`overlay`, `redirect`, `external`). External `url`s are absolute HTTPS, or paths when
`proto.config.ts` sets `siteUrl`. `proto check` rejects unknown prototypes, states and roles,
unreachable nodes and dead ends, and warns on states of a touched spec that no flow uses.
`proto flow new|list|show|coverage` author and inspect them.

## Review comments

Comment mode (C) pins a note to an element or area; flows take notes per step. Comments and
images are local JSON in `apps/<app>/proto/review/<slug>/` (commit them with the work), served
by `proto dev` only. Agents use `bun run proto comments list|show|add|reply|resolve|reopen|edit|
delete|attach|detach|attachments`; `show` prints the source location and the commit the note was
written on. Resolve with a note saying what changed.

## Evidence

`bun run proto evidence <slug> [--state id] [--theme dark]` saves the
rendered DOM to the app-relative `docs/design/<slug>/index.html` through Playwright's Chromium.

## Package integration

The application Vite config installs `proto()`. Storybook and browser tests install
`protoPresentation({ sourceTags: true })` when source annotations are needed. Shared Tailwind,
aliases and React Compiler configuration lives in `vite.shared.ts`.

`proto dev --app app` serves the prebuilt shell and API at `http://127.0.0.1:4400` and the consumer
render host at `http://127.0.0.1:4401/__proto/render/<slug>`. `--port` moves both ports together;
`PROTO_PORT` and `PROTO_POLL=1` configure defaults. Both ports are strict. Hosts must match loopback
or `dev.allowedHosts`, and localhost redirects to the canonical loopback origin.

The shell reads `/__proto/bootstrap.json`, `/__proto/api/registry` and the SSE stream
`/__proto/api/events`. Review integrations mount a fetch handler through `startDev` and publish
`comments` and `review` events on that stream. The consumer canvas owns its own CSS imports.

`loadProject(appRoot)` from `@compozy/proto/node` exposes `registry`, `watch` and `url`. Registry
paths and `data-proto-src` coordinates are app-relative. Discovery uses TypeScript AST literals;
prototype and flow modules are never evaluated in Node. `proto check --json` compiles all
prototypes without writing output and exits nonzero for problems.

## CLI and agent integrations

Every CLI operation accepts `--json`, `--app` and `--verbose`. The package capability catalog also
produces the 22 MCP tools (`proto mcp`, optional `@modelcontextprotocol/sdk` peer). Store-backed
commands share `project.store()` and do not need a running gallery. The local FileStore is wired; remote transport is wired in slice 8. Until then `--remote` fails
explicitly, and remote review approval/deletion is denied.

- `proto list`, `proto check`, `proto url <slug> [--bare]` inspect the current project.
- `proto new <slug> --draft` or `proto new --in src/components/view.tsx` scaffolds a prototype.
- `proto flow new <id>`, `flow list`, `flow show <id>` and `flow coverage` operate on flows.
- `proto comments list|show|add|reply|resolve|reopen|edit|attach|detach|attachments|delete` operate
  on threads. `--message` is one-based; omitted means the author's most recent message.
- `proto review status|approve|reopen|unlock` operates on review state. Unlock requires `--force`.
  Approval with open comments requires `--confirm-open`. Agents never approve or reopen reviews.
- `proto screenshot <slug> --state <id> --width 1440` writes a PNG; `proto evidence <slug>` writes
  inert HTML under `docs/design/<slug>/`. Both can start and stop their own temporary dev server.
- `proto migrate --from gallery/comments --dry-run` previews local legacy review migration; omit
  `--dry-run` to write migrated files while preserving the source. Migration is CLI-only.
- `proto init --skills` writes the config, canvas, welcome draft, Vite integration and design record,
  plus review ignore rules and the two shipped authoring/review skills. Existing configuration is
  skipped unless `--force` is supplied.

Playwright and the MCP SDK are optional peers; install them only for those features. JSON results
and registered errors are shared across CLI and MCP. CLI exit codes are 0 success, 1 problems,
2 usage, 3 missing dependency and 4 remote/auth failure.
