# @compozy/proto

Authoring entries: `.`, `/flow`, `/config`; Node API: `/node`; Vite plugins: `/vite`.
The CLI is `bun run proto <command> --app app`.

- `proto.config.ts` supplies `defineProtoConfig`; `proto.canvas.tsx` exports `Canvas` and optional
  `Frame`. The consumer Vite config installs `proto()`; Storybook and browser tests install
  `protoPresentation()`. Shared aliases, styles and React Compiler stay in `vite.shared.ts`.
- `loadProject(root)` validates configuration, discovers prototype and flow literals without
  executing them, returns registry snapshots and watches authored files. Paths are app-relative.
- `startDev(project, { port, review })` starts shell/API on port 4400 and the consumer render
  server on 4401. Configured story roots render on separate servers at 4402 + root index;
  `DevOptions.storyRoots` selects which roots start. Stories never render on the prototype server. `mountReview(handler)` replaces the fetch handler for review API requests;
  `publish("comments" | "review" | "registry", data)` sends SSE events. `close()` stops every server it started.
- The shell is served from `dist/shell` (`bun run build:shell`, config `vite.config.ts`); a
  missing bundle explains how to build it. It is its own React app: it imports only `src/model`
  and its vendored BnUI in `src/shell/ui` (never `@proto/ui`), learns its environment from
  `bootstrap.json` and talks to render iframes only through the protocol. Iterate on it with
  `bun run dev:shell` (fixtures and a fake render host, `test/harness/`); review-slice controls
  plug into the slots in `src/shell/app/slots.tsx`. The render
  host is compiled by the consumer pipeline at `/__proto/render/<slug>`. `renderPlugins` injects
  `virtual:proto/render-config`, `virtual:proto/prototypes`, and `virtual:proto/canvas`.
- `proto check` checks registry problems and compiles all prototypes without writing build output.
  `proto build` / `buildProject(project)` always writes read-only `dist-proto` with query-form render
  assets. `proto build --remote` explicitly selects a remote build using `PROTO_REMOTE_URL` or
  `review.remote.url`, with path-form render URLs and the public shell origin. The Node API selects
  this mode with `buildProject(project, { remote: publicOrigin })`. Offline review snapshots are opt-in with `build.includeReview`.
  Story config/index diagnostics appear in `check`; it never loads or builds story graphs.
  Local builds include lazy story roots under `__stories/<root>/` and optional `story--` snapshots;
  story index problems and missing/unsupported peers fail local builds. Remote builds omit stories
  with `stories_not_built`. MSW needs a base-aware worker URL and root-local scope (README).
  Invalid prototype/flow registries and guard/build failures leave no output. `screenshot` and `evidence` use the capture implementation;
  `store()` returns FileStore; `store({ remote: true })` returns HttpStore using the configured URL
  and credential. `migrate` delegates to local file migration; the Node entry also exports
  `migrateRemote` for the database cutover.
- Runtime imports from configured data modules fail only graphs rooted in stories or prototypes.
  Production builds reject prototype-only modules. Source tags use app-relative paths.
- Keep `src/node` out of browser modules. The shell and render host communicate across origins.
  Migrated review history lives in `apps/app/proto/review`; the legacy source remains preserved.

## Temporary sharing

`proto share connect` provisions a per-user Cloudflare setup. `proto share <slug>`, `--flow <id>`
or `--all` serves only a built snapshot to repeatable `--approver` / `--commenter` invitations.
`status`, `refresh`, `stop` and `disconnect` support `--json`; start prints once when ready and runs
until stopped. Press `r` to refresh. Approvers require a clean committed tree; review file edits are
excluded. `src/share/session.ts` owns the private singleton record, authenticated loopback control,
FileStore event filtering and tunnel supervision. Share is CLI-only; agents never approve.
See `docs/proto/share.md` for setup, permissions, safety boundaries and live conformance.

## Capability delivery

`src/capabilities/catalog.ts` owns CLI names, MCP names, authority and exclusions. Both transports
execute `executeCapability`; `runCli` supplies the CLI parser and JSON/exit-code boundary. The
canonical `ReviewStore` interface is exported by `src/store/index.ts`. The CLI contract suite uses
real FileStore with an isolated app copy; transport handlers call `project.store()` so the store
implementation is shared by CLI, MCP and the dev review router.

`skills/` holds the shipped agent skills: `proto` (concepts, authoring, setup, CLI and
troubleshooting, with `references/`) and `proto-apply-comments` (the comment loop). They are the
consumer contract, so every command, flag, key and error code they name must match the source.
`proto init --skills` syncs them into the Git top level's `.agents/skills/` (the app root outside
Git), also in an app that is already set up, and reports 0.1.x copies under `legacySkills`. After
editing a skill, sync the same files into this repository's `.agents/skills` copy (normally with
`bun run proto init --skills --app app`).
Agents never approve reviews. MCP excludes review transitions, unlock, credentials, migrations and
process lifecycle. Store commands accept `--remote`, and store-backed MCP tools accept `remote: true`,
using HttpStore with bearer credentials. Remote approval/deletion is denied to bearers. Capture uses
the optional Playwright peer, starts a temporary server when necessary, and saves app-relative
evidence under `docs/design/<slug>/`.

`proto mcp` uses the optional `@modelcontextprotocol/sdk` peer over stdio; stdout is reserved for MCP.
Tests cover parity through the SDK transport, real Chromium screenshots and inert HTML, static
packaging, and fresh-tarball consumer adoption.

`proto stories list/run/url` and MCP `proto_stories_list/run/url` expose the story index and runner.
MCP run requires a root or filter. Runs verify `projectId` before server reuse and close only owned
resources. Story comments use `story--<component slug>` and require a valid story id in `--state`.
