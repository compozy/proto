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
verified: 2026-10-31
---

# Prototyping

Run commands from the repository root with `bun run proto … --app app`. The root script uses
`@compozy/proto`'s public `proto` binary. The app consumes only the package's public entries:
`@compozy/proto`, `/config`, `/flow` and `/vite`; Node integrations use `/node` and MCP uses `/mcp`.

## App integration

`apps/app/proto.config.ts` defines specs, roles, discovery paths, guards and dev/build options with
`defineProtoConfig`. `proto.canvas.tsx` exports `Canvas` and optional `Frame`, owns CSS imports and
provides the memory router/toasts. `vite.config.ts` installs `proto()`. Storybook and Vitest install
`protoPresentation()`; use `{ sourceTags: true }` when source annotations are needed. They share
Tailwind, aliases and app React Compiler settings through `vite.shared.ts`.

- Component prototypes (`src/**/<slug>.proto.tsx`) compose real views with fixture props. Routes
  own data, auth and navigation. Intrinsic JSX belongs in the view, not its component prototype.
- Drafts (`src/drafts/<slug>/index.proto.tsx`) allow free markup. Both kinds export literal
  `meta = definePrototype({ title, states, … })` and a default component receiving state and role.
  Optional metadata includes spec, surface, route, roles, blocks and standalone.
- Flows (`flows/<id>.flow.ts`) export a literal `flow = defineFlow({ title, start, nodes, edges })`
  from `/flow`. Nodes reference prototype states/roles or external destinations. Discovery uses
  the AST and never executes prototype or flow modules in Node.
- The network guard rejects runtime data-layer imports reachable from prototypes, drafts and
  stories. Type imports are allowed. The production boundary rejects prototype-only modules
  entering the application's production build. Keep both boundaries enabled.

`bun run proto check --app app --json` validates the registry, flow references, network graph and
consumer render build without writing output. JSON contains `problems` and `warnings`; problems
or a build error exit 1, warnings alone exit 0.

## Dev and URLs

Build the prebuilt shell once with `bun run --cwd packages/proto build:shell`, then run
`bun run proto dev --app app`. The Node shell/API is at `http://127.0.0.1:4400`; the app's Vite
render server is at `http://127.0.0.1:4401`. `--port` moves the strict pair together. `PROTO_PORT`
and `PROTO_POLL=1` configure defaults. Hosts must match loopback or `dev.allowedHosts`; localhost
redirects to 127.0.0.1. A missing shell bundle tells you to run its build.

Shell URLs on port 4400:

| URL                                                       | View                                         |
| --------------------------------------------------------- | -------------------------------------------- |
| `/`                                                       | Overview                                     |
| `/?spec=auth`                                             | Spec page                                    |
| `/?p=login-form&state=error&w=1440&theme=dark&role=admin` | Screen state                                 |
| `/?p=login-form&state=error&compare=themes`               | Theme comparison                             |
| `/?flow=sign-in&node=error`                               | Flow and selected step                       |
| `/?comments=open`                                         | Comments inbox; also `waiting` or `resolved` |
| `/?p=login-form&comment=login-form-7`                     | Focused thread                               |
| `/?drafts`                                                | Drafts                                       |
| `/?settings=credentials` or `/?settings=health`           | Settings                                     |

The bare render URL is
`http://127.0.0.1:4401/__proto/render/login-form?state=error&theme=dark&role=admin&chrome=0`.
Use `bun run proto url login-form --state error --app app` for a shell URL, or add `--bare` for
rendering. `protoHref` and `setParam`/`setParams` from the public authoring entry update prototype
navigation. Source attributes use app-relative `src/…:line:column` coordinates.

The shell loads `/__proto/bootstrap.json`, `/__proto/api/registry` and `/__proto/api/events` (SSE).
Registry changes and CLI review writes update an open dev shell.

## CLI and reviews

All commands accept `--app`, `--json` and `--verbose`. Exit codes are 0 success, 1 problems/user
error, 2 usage, 3 missing optional dependency and 4 remote/auth failure.

```sh
bun run proto list --app app --json
bun run proto new review-digest --draft --app app
bun run proto new --in src/components/example.tsx --spec auth --app app
bun run proto flow new checkout --spec auth --app app
bun run proto flow list --app app --json
bun run proto flow show sign-in --app app --json
bun run proto flow coverage --app app --json
bun run proto comments list --app app --json
bun run proto comments show proto-shell-1 --app app --json
```

The local v3 store is `apps/app/proto/review/<key>.json`, containing sequence, review state,
events and comment threads. Images live in `<key>/attachments/`; flow keys use `flow-<id>`.
Commit review files and referenced images. Locks, temporary files and pending uploads are ignored.
The repository's old review source has been migrated and removed; the verification record is
`apps/app/proto-migration-report.json`. Never edit review JSON manually.

Review commands work without a running dev server. Read the entire thread and download attachments
with `comments attachments <id> --out .tmp/review-images`. Match context.state, theme, role, viewport
and commit; use target.sourceChain to find the owning view. Change component views or draft sources,
then verify the reviewed state. Reply with `comments reply <id> --note "…"` and resolve with
`comments resolve <id> --note "…"` only after verification. Other comment verbs are add, reopen,
edit, attach, detach and delete. `--message` is one-based and defaults to the author's latest message.

`review status <key>` reports review state. Human reviewers use `review approve` and `review reopen`;
open comments require `--confirm-open` for approval. Agents never approve or reopen reviews, and
never delete comments on their own initiative. `review unlock <key> --force` is operator recovery.
Follow `.agents/skills/apply-prototype-comments/SKILL.md` when applying assigned comments.

## Evidence and static delivery

```sh
bun run proto screenshot proto-shell --state overview --width 1440 --app app
bun run proto evidence proto-shell --state overview --app app
bun run proto build --app app
```

Playwright Chromium is required for capture (missing installation exits 3). Both capture commands
start and stop temporary dev servers when needed. PNGs are saved under the app-relative
`docs/design/<slug>/<state>--<theme>--<width>.png`; evidence writes `docs/design/<slug>/index.html`
as static DOM without scripts.

`proto build` validates and writes `apps/app/dist-proto/`, using the prebuilt shell. Failures remove
stale output. Deploy it at `/` or a subpath such as `/gallery/` with a plain static server, without
rewrites. Bootstrap has mode `read-only`, null API/events/auth endpoints and relative URLs. Static
render URLs use `__proto/render/index.html?slug=<slug>&state=<state>`.

Review history is excluded by default. Set `build: { includeReview: true }` to publish snapshots
at `__proto/review/<key>.json` and their referenced images. No pending or orphaned uploads are
included. A later default build removes exported history while preserving the local store.

## MCP and setup

`bun run proto mcp --app app` serves the catalog's 22 tools over stdio through the optional
`@modelcontextprotocol/sdk` peer. CLI JSON and MCP results share execution and error contracts.
Stdout belongs to MCP. Review transitions, unlock, credentials, migration and process lifecycle
are excluded from agent tools. Store tools expose `remote`, but remote CLI transport is still a
separate integration; remote approval/deletion is denied.

`proto init --skills` writes config, canvas, welcome draft, Vite integration, design record and
review ignore rules, and installs authoring/review skills. Existing configuration is preserved
unless `--force` is supplied. For another legacy app, `proto migrate --from gallery/comments
--dry-run` previews the local v3 migration; removing `--dry-run` writes the verified report and
preserves its source until the operator deletes it.
