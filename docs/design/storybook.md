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
in the root configuration. Local `proto build` includes each root's Vite output, public directory
and static mounts under `__stories/<root>/`, with lazy story chunks and query-form story URLs.
Story index problems, missing/unsupported peers and root build failures fail local publication.
`build.includeReview` includes local `story--` snapshots. `proto build --remote` omits stories
permanently with `stories_not_built`; remote review does not accept story keys.

For MSW, place `mockServiceWorker.js` in that root's public directory or a static mount at `/`,
and initialize it in the preview with a base-aware URL:

```ts
const base = new URL(import.meta.env.BASE_URL, window.location.href);
initialize({
  serviceWorker: {
    url: new URL("mockServiceWorker.js", base).href,
    options: { scope: base.pathname },
  },
});
```

Static workers stay scoped to `__stories/<root>/`, away from the gallery shell and other roots.
Do not serve them with a broader `Service-Worker-Allowed` header. Use HTTPS or loopback HTTP;
other HTTP hosts report that service workers need a secure context. Consumers with a hard-coded
`/mockServiceWorker.js` must update their own preview; proto leaves previews unchanged.

Static story assets use the same base as the worker: `static` mounts and `publicDir` assets
live under `__stories/<root>/`, including the gallery's hosting subpath. Consumers must use
base-relative URLs, for example
`new URL("vendor/emojibase/en/data.json", new URL(import.meta.env.BASE_URL, window.location.href))`.
A hard-coded `/vendor/emojibase/...` or `/fonts/...` requests the gallery origin's root and can
404 in a static build even when it works on the separate dev origin. proto does not publish
these assets at the gallery root or rewrite string URLs in consumer code.

This repository's app adoption is a separate decision.
