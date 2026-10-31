---
name: proto
description: How @compozy/proto works and how to author with it. Use when creating or editing `*.proto.tsx` prototypes, drafts under `src/drafts/`, `*.flow.ts` flows or `proto.canvas.tsx`; when setting up proto or changing `proto.config.ts` and its Vite, Storybook or Vitest guards; when running the `proto` CLI or MCP tools; or when asked how proto works or why `proto check`, `proto dev` or a capture fails. Not for ordinary UI edits that touch no prototype, and not for answering gallery review comments (use proto-apply-comments).
---

# proto

`@compozy/proto` is a prototype gallery and review loop for React + Vite apps. A prototype renders
the app's **real, shipped views** with fixture props, one state at a time. People open the gallery,
pin comments to rendered elements, and each comment records the JSX source chain of what they
clicked. Agents fix that source and answer through the CLI or MCP. **People approve; agents never
do.** The point is that the reviewed screen _is_ the code that ships, so there is nothing to
translate from a mockup afterwards.

This skill is the shipped contract and is replaced by `proto init --skills` on upgrade. Put
project rules (which views exist, where fixtures live, which specs to use) in the project's
`AGENTS.md` or `CLAUDE.md`, not in this file.

## Mental model

- **Component prototype**: `<view>.proto.tsx` beside the view it composes. It imports the view
  and picks props per state. It contains no markup of its own: any lowercase JSX tag (`<div>`)
  is a `markup` problem. Layout belongs in the view.
- **Draft**: `src/drafts/<slug>/index.proto.tsx`, an exploration that may use free markup. Drafts
  never get the production `Frame`.
- **Flow**: `flows/<id>.flow.ts`, a journey across prototype states and external pages.
- **`meta` is data, never code.** `export const meta = definePrototype({...})` (and
  `export const flow = defineFlow({...})`) is read from the syntax tree and never executed. Only
  string, boolean, array and object literals are allowed: no variables, numbers, spreads,
  template strings or computed values.
- **Two origins.** The shell (gallery and review API) runs on `127.0.0.1:<dev.port>` (4400 by
  default). It is prebuilt and never imports app code. Prototypes render on the render origin,
  `port + 1`, compiled by the app's own `vite.config.ts` in the `proto-render` mode, one state
  per iframe document. The two talk only through a validated `postMessage` protocol. App CSS
  loads on the render origin only.
- **Canvas and Frame.** `proto.canvas.tsx` exports `Canvas` (providers around every state; it
  receives `theme` and `role`) and an optional `Frame` (production chrome around component
  prototypes that are not `standalone`).
- **Review store.** `proto/review/<key>.json` per prototype (key = slug) or flow
  (key = `flow-<id>`), committed with the code. Comment ids are `<key>-<n>`. Each key is
  `in_review` or `approved`; approval records the commit and is a human act. A new comment on an
  approved prototype puts it back in review.
- **Guards.** `proto()` in the app's `vite.config.ts` fails the production build when
  prototype-only code (prototypes, `*.fixtures.ts(x)` and `*.stories.ts(x)` modules, drafts,
  flows, the canvas, proto itself) reaches the bundle. The network guard fails `proto check`,
  `proto build`, and Storybook/Vitest with `protoPresentation()`, when a prototype, draft or
  story reaches a module listed in `guards.forbidRuntimeImports` through runtime imports. It
  only knows the listed modules, so it cannot catch a global `fetch` or an unlisted client.

## Proto or Storybook

- **Proto**: screens and journeys that people review and approve: states of a real view inside
  the app chrome, flows across states, comments anchored to source, evidence for a spec.
- **Storybook**: the component catalog, args and controls, per-component interaction and a11y
  tests. Proto does not replace it. Both render views from fixtures, and both sit behind the
  same network guard.
- **Neither**: a UI change with no prototype to update. Edit the view and run its own checks.

## Hard rules

1. **Never weaken a guard to make something render.** Do not remove `forbidRuntimeImports`
   entries, set `guards.productionBoundary: false`, drop `proto()` or `protoPresentation()`, or
   move a file out of a guarded path. A guard failure means a view reaches data access. Move
   that access to the route and pass props instead.
2. **Prototypes compose views with fixtures.** When a state needs something the view cannot show,
   add a prop to the view. Never copy the view's JSX into the `.proto.tsx`.
3. **Import the view's own module.** Do not import a barrel that also re-exports routes, hooks or
   API clients. It drags the data layer into the graph, and the network guard fails it as
   `network_import` once those modules are listed.
4. **Agents never approve or reopen reviews**, never run `review unlock`, and delete comments only
   when a person asks. Resolving a comment is not approval.
5. **Never edit `proto/review/**` by hand.** Use the CLI, MCP or the gallery.

## Working loop

1. Orient: `proto list --json`, `proto flow list --json`, and `proto check --json` for the
   current problems. Add `--app <dir>` in a monorepo.
2. Scaffold: `proto new --in src/<path>/<view>.tsx` (component prototype),
   `proto new <slug> --draft` (draft), or `proto flow new <id>` (flow).
3. Edit, then run `proto check --json` until it exits 0, with an empty `problems` and no `error`.
   Warnings never fail. The compile step, and with it `network_import`, only runs once the
   registry problems are gone.
4. Look at the result: with `proto dev` running, open `proto url <slug> --state <id> --bare`, or
   capture `proto screenshot <slug> --state <id>` without a server.
5. Report the gallery URL and any evidence. Approval stays with people.

Invoke the binary the way the project does: `bunx proto`, `npx proto`, or a package script such as
`bun run proto <command> --app app`.

## References

Read only the one you need:

- `references/authoring.md`: before writing or editing a prototype, draft, flow or canvas
  (meta fields, states, fixtures, URL state, flow nodes and edges).
- `references/setup.md`: when installing proto, editing `proto.config.ts`, or wiring Vite,
  Storybook or Vitest (config keys and defaults, guards, the render origin, skills install).
- `references/cli.md`: when you need a command's flags, JSON output, exit codes, error codes or
  the MCP tools.
- `references/troubleshooting.md`: when `check`, `build`, `dev`, Storybook or a capture fails,
  or the gallery renders something unexpected.

For gallery review comments (a comment id like `login-form-7`), use the `proto-apply-comments`
skill.
