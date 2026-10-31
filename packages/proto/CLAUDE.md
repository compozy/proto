# @compozy/proto

Authoring entries: `.`, `/flow`, `/config`; Node API: `/node`; Vite plugins: `/vite`.
The CLI is `bun run proto <command> --app app`.

- `proto.config.ts` supplies `defineProtoConfig`; `proto.canvas.tsx` exports `Canvas` and optional
  `Frame`. The consumer Vite config installs `proto()`; Storybook and browser tests install
  `protoPresentation()`. Shared aliases, styles and React Compiler stay in `vite.shared.ts`.
- `loadProject(root)` validates configuration, discovers prototype and flow literals without
  executing them, returns registry snapshots and watches authored files. Paths are app-relative.
- `startDev(project, { port, review })` starts shell/API on port 4400 and the consumer render
  server on 4401. `mountReview(handler)` replaces the fetch handler for review API requests;
  `publish("comments" | "review" | "registry", data)` sends SSE events. `close()` stops both servers.
- The shell is served from `dist/shell` (`bun run build:shell`, config `vite.shell.config.ts`); a
  missing bundle explains how to build it. It is its own React app: it imports only `src/model`
  and its vendored BnUI in `src/shell/ui` (never `@proto/ui`), learns its environment from
  `bootstrap.json` and talks to render iframes only through the protocol. Iterate on it with
  `bun run dev:shell` (fixtures and a fake render host, `test/harness/`); review-slice controls
  plug into the slots in `src/shell/app/slots.tsx`. The render
  host is compiled by the consumer pipeline at `/__proto/render/<slug>`. `renderPlugins` injects
  `virtual:proto/render-config`, `virtual:proto/prototypes`, and `virtual:proto/canvas`.
- `proto check` checks registry problems and compiles all prototypes without writing build output.
  The existing legacy static output remains available; new static packaging is a later slice. `store`, `screenshot`, `evidence`, and `migrate` are explicit
  later-slice integration points on the project API.
- Runtime imports from configured data modules fail only graphs rooted in stories or prototypes.
  Production builds reject prototype-only modules. Source tags use app-relative paths.
- Keep `src/node` out of browser modules. The shell and render host communicate across origins.
  Existing `apps/app/gallery` review history is preserved for the migration slice.
