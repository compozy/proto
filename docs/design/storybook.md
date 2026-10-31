# Storybook

`apps/app/.storybook` renders the stories of `packages/ui/src/**/*.stories.tsx` and
`apps/app/src/**/*.stories.tsx` with `apps/app/vite.presentation.ts`, the same config as the
prototype gallery and the base of the SPA's own. Port 6007.

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
  presentation guard fails the run). `preview/canvas.tsx` provides the memory router and toasts.
- Pick states that change behavior (ready, empty, pending, failure, disabled). A `play` function
  that asserts behavior states its invariant and owner in a comment:
  `// Invariant: … Owner: … stories.`
