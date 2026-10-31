# @compozy/proto

Prototype gallery shared by the apps: authoring contract (`@compozy/proto`: `definePrototype`,
`useSearch`, `setParam(s)`, `protoHref`; `@compozy/proto/flow`: `defineFlow`;
`@compozy/proto/config`: `defineGalleryConfig`), Vite plugins for the apps' own configs
(`@compozy/proto/vite`) and the `proto` CLI (`bun run proto <command> [--app <name>]`). Contract,
URLs and commands: `docs/design/prototyping.md`.

- An app opts in with `gallery.config.ts`, `vite.presentation.ts` (shared with Storybook) and
  `preview/{canvas.tsx,gallery.css}`. `canvas.tsx` exports `PresentationCanvas` (providers of
  every canvas) and `PrototypeFrame` (production chrome around component prototypes).
- `src/node` and `src/cli` run in Bun/Node; `src/shell` and `src/render` in the browser. Keep the
  shell free of `node/` imports and `registry-model`, `view`, `flow-graph` pure (no DOM).
- Discovery reads `meta` and `flow` literals statically and never executes prototype or flow
  files. Flows import only `@compozy/proto/flow`. External flow nodes never become iframes; flow
  previews are inert and trust status messages only from their own iframe.
- Comments are local files, `apps/<app>/gallery/comments/<slug>/comments.json` (flows use the
  reserved key `flow-<id>`, so slugs cannot start with `flow-`), written through
  `node/comments-store.ts` by the dev server and the CLI alike. New comments carry
  `context.commit`; keep it through parsing and replies. A built gallery is read-only.
- The production-boundary build guard and the presentation guard live in `src/node`; never
  weaken them to make a prototype render.
