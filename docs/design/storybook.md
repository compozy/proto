# Storybook

`apps/app/.storybook` renders the stories of `packages/ui/src/**/*.stories.tsx` and
`apps/app/src/**/*.stories.tsx` using React, Tailwind and aliases from `apps/app/vite.shared.ts`.
The prototype gallery uses its own render server and `proto.canvas.tsx`. Port 6007.

```sh
bun run storybook        # dev server
bun run test:stories     # every story in Chromium, light and dark (also part of `test`)
```

Addons: docs (autodocs, docgen server), a11y (`a11y.test: "error"`: a violation fails the test),
themes (light/dark class on `<html>`) and vitest. The app's `test` script runs two browser
projects, `storybook-light` and `storybook-dark`; `build` writes `storybook-static`. Install
Chromium once with `bunx playwright install chromium` from the app folder (CI installs it).

## Authoring

- Colocate `<component>.stories.tsx` with the component, typed CSF3:
  `satisfies Meta<typeof Component>` and `StoryObj<typeof meta>`. Titles: `UI/...` for
  `packages/ui`, `App/...` for app views.
- Stories render views with typed args and `fn()` spies; no fetching, Query or auth (the
  presentation guard fails the run). `proto.canvas.tsx` provides the shared memory router and toasts.
- Pick states that change behavior (ready, empty, pending, failure, disabled). A `play` function
  that asserts behavior states its invariant and owner in a comment:
  `// Invariant: … Owner: … stories.`

## Stories in proto

Apps may opt into the proto Components area with `stories.roots` in `proto.config.ts`:

```ts
stories: {
  roots: [{ id: "app", stories: "src/**/*.stories.tsx", preview: ".storybook/preview.ts", vite: "vite.stories.ts" }],
}
```

The root Vite config installs React, CSS and aliases, without `proto()`. Move any `viteFinal`
customization there: proto never executes `.storybook/main.ts`. Install `storybook@10.6.3` and
`@storybook/react-vite@10.6.3` in each root directory. Existing CSF files stay unchanged.
Use `proto stories list --json`, `proto stories run --root app --json` and `proto stories url <id>`.
`check` validates the index only; the runner enforces guards while loading stories. Storybook's
addon panels and addon-vitest remain separate; `sb.mock` is inert and emits a warning.

Each root gets its own origin on `dev.port + 2 + index`, its own preview and dependency cache.
After reordering roots, clear the old MSW service-worker registrations and site data on those
loopback origins: a port can now belong to a different root. Static dirs and worker URLs belong
in the root configuration. Local and remote gallery builds currently omit stories and warn
`stories_not_built`. This repository's app adoption is a separate decision.
