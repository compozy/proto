<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/logo-light.svg">
    <img alt="proto" src="docs/assets/logo-light.svg" width="280">
  </picture>
</p>

<p align="center">
  <strong>Prototype with your real components. Review with people and agents.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@compozy/proto"><img alt="npm" src="https://img.shields.io/npm/v/@compozy/proto?color=e52c8f&label=%40compozy%2Fproto"></a>
  <img alt="status: experimental" src="https://img.shields.io/badge/status-experimental%200.x-ff70b7">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-0b0b0e"></a>
</p>

---

`@compozy/proto` is a prototype gallery and review loop for React + Vite apps. You write
`*.proto.tsx` files beside your views, using the components you ship. `proto dev` opens a review
shell where people pin comments to elements, regions or flow steps. Each comment records the JSX
source chain of what was clicked, so a coding agent can open the exact line, fix it and answer
through the CLI or MCP. Agents never approve; people do.

<!-- screenshots -->
<!-- The review shell: overview, screen view with pinned comments, flow canvas. -->
<!-- /screenshots -->

> [!WARNING]
> **Experimental (0.x).** The public surface described here is the 0.x contract and may change
> between minor versions until 1.0. See [Status](#status).

## Why

- **Prototypes become the shipped UI.** Prototypes compose your production views and design
  system, not throwaway HTML, so the reviewed state is the code that ships.
- **Comments point at source.** Every comment stores the selector, the element text, the rects
  and the `file:line:column` chain of the JSX that rendered it, plus the commit, state, theme,
  role and viewport.
- **Agents run the review loop.** List, read, reply, resolve, attach screenshots and capture
  evidence from the CLI (`--json`) or MCP. Everything except approval works without a browser.
- **Prototypes can't reach production.** Build guards fail the build when prototype code
  reaches your production bundle, or when a prototype reaches your data layer.

## Features

- **Gallery shell.** Overview, spec pages, screen view with states, viewports, themes and roles,
  flow canvas with live previews, comments inbox, drafts and search. Prebuilt and self-styled, so
  it never imports your design system.
- **Typed prototypes.** `definePrototype` meta (title, spec, surface, route, states, roles) is read
  statically, never executed. `proto check` reports broken literals with stable problem codes.
- **Flows.** `defineFlow` journeys across prototype states and external pages, with coverage
  warnings for states no flow reaches.
- **Anchored comments.** Pick an element, drag a region or move a crosshair with the keyboard.
  Pins follow their anchor as the layout changes. Threads support replies, image attachments,
  resolve and reopen. Each prototype or flow has its own review status (in review or approved).
- **Isolated rendering.** Prototypes render in iframes on a separate origin, compiled by your own
  Vite config. They talk to the shell only through a typed, validated `postMessage` protocol.
- **Evidence.** `proto screenshot` (PNG via Playwright Chromium) and `proto evidence` (static HTML
  without scripts) under `docs/design/<slug>/`.
- **Static build.** `proto build` writes a read-only gallery to `dist-proto/` that works on any
  static host, at `/` or under a subpath.
- **Remote review server.** `@compozy/proto/server` is a self-hosted fetch handler for comments and
  approvals behind your own sign-in, with Postgres or file storage.
- **Migration.** `proto migrate` rewrites existing v1/v2 review files to the current format
  losslessly, with a verification report.

## Quick start

Requires a React 19 + Vite 8 app. Proto uses the app's Vite installation; install React and Vite
in the consumer before adding Proto.

```sh
bun add -d @compozy/proto
bunx proto init
bunx proto dev --open
```

`init` writes the config, canvas, welcome draft and Vite plugin integration. `proto --help` lists
the commands; `proto --version` prints the installed package version.

Install these optional peers only for the features you use:

| Feature                  | Optional peer                           | Setup                                                           |
| ------------------------ | --------------------------------------- | --------------------------------------------------------------- |
| Screenshots and evidence | `playwright` (`^1.64.0`)                | `bun add -d playwright` then `bunx playwright install chromium` |
| MCP server (`proto mcp`) | `@modelcontextprotocol/sdk` (`^1.32.2`) | `bun add -d @modelcontextprotocol/sdk`                          |
| Postgres review storage  | `postgres` (`^3.4.0`)                   | `bun add postgres` in the backend that mounts the review server |

The gallery, local reviews and static builds do not require these optional integrations.

## Write a prototype

A component prototype lives beside the view it composes and renders it with fixture props:

```tsx
// src/components/login-form.proto.tsx
import { definePrototype, setParam, type PrototypeProps } from "@compozy/proto";
import { LoginForm } from "./login-form";

export const meta = definePrototype({
  title: "Sign in",
  spec: "auth",
  surface: "A1",
  route: "/login",
  standalone: true,
  states: [
    { id: "sign-in", label: "Sign in" },
    { id: "error", label: "Wrong password" },
  ],
});

export default function Prototype({ state }: PrototypeProps) {
  return (
    <LoginForm
      mode="sign-in"
      error={state === "error" ? "Invalid email or password" : null}
      pending={false}
      onModeChange={() => {}}
      onSubmit={() => setParam("state", "error")}
    />
  );
}
```

The gallery lists **Authentication → Sign in** with both states, without a reload.

- **Component prototypes** (`src/**/*.proto.tsx`) compose views. Unless they set `standalone`,
  they render inside your production chrome (`Frame`).
- **Drafts** (`src/drafts/<slug>/index.proto.tsx`) may use free markup for early exploration.
- `useSearch`, `setParam(s)` and `protoHref` keep prototype state in the URL, so every state has
  a shareable link and comments record the state the reviewer saw.

`proto.canvas.tsx` provides your app's providers and chrome:

```tsx
import type { CanvasProps, FrameProps } from "@compozy/proto";
import "./src/styles.css"; // your CSS loads on the render origin only
import { ThemeProvider } from "@acme/ui/theme";
import { AppShellView } from "./src/systems/shell/app-shell-view";

/** Providers around every rendered state. */
export function Canvas({ children, theme }: CanvasProps) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

/** Production chrome around component prototypes (not drafts, not `standalone`). */
export function Frame({ route, children }: FrameProps) {
  return <AppShellView activeRoute={route}>{children}</AppShellView>;
}
```

## Flows

Flows chain prototype states (and external pages) into journeys:

```ts
// flows/sign-in.flow.ts
import { defineFlow } from "@compozy/proto/flow";

export const flow = defineFlow({
  title: "Sign in",
  spec: "auth",
  start: ["site"],
  nodes: {
    site: { external: "site", url: "/" },
    "sign-in": { proto: "login-form", state: "sign-in" },
    error: { proto: "login-form", state: "error" },
    home: { proto: "welcome", state: "default", end: true },
  },
  edges: [
    ["site", "sign-in", { on: "Sign in" }],
    ["sign-in", "error", { on: "Wrong password", kind: "overlay" }],
    ["error", "home", { on: "Signed in", kind: "redirect" }],
  ],
});
```

`proto flow show|list|coverage` print the steps; `proto check` reports unknown prototypes or states
and warns about states that no flow covers.

## The review loop

1. A reviewer opens the gallery, presses **C** and clicks an element (or drags a region), writes a
   comment and optionally attaches images.
2. An agent reads open comments with their source chain and attachments, fixes the code and
   replies or resolves:

   ```console
   $ proto comments list
   login-form-7  error  reviewer  4m  The error should sit under the password field…  src/components/login-form.tsx:58:27

   $ proto comments resolve login-form-7 --note "Fixed in src/components/login-form.tsx."
   ✓ login-form-7 resolved
   ```

3. The reviewer approves the prototype in the shell or with `proto review approve`. Approval
   records the commit and the number of comments still open. A new comment on an approved
   prototype puts it back in review. Locally, approval is trust-based (anyone with the repository
   can approve); on a remote gallery only a browser session with the `review` scope can.

Every command has `--json` output with stable shapes and exit codes. `proto mcp` exposes the same
capabilities as MCP tools over stdio (`proto_comments_list`, `proto_comments_reply`,
`proto_comments_resolve`, `proto_screenshot`, …), and the results equal the CLI `--json`.
Approval, credentials, migration and process lifecycle are intentionally not MCP tools:
**agents never approve**.

`proto init --skills` installs the `author-prototype` and `apply-prototype-comments` agent skills.

Local review data lives in `proto/review/<key>.json` (one file per prototype or flow, committed with
your code), written under a per-key lock so the CLI, MCP and the dev server can write concurrently.

## Remote review

Set the deployed gallery URL, including its base path, in the app's `proto.config.ts`:

```ts
import { defineProtoConfig } from "@compozy/proto/config";

export default defineProtoConfig({
  title: "Acme",
  review: { remote: { url: "https://acme.com/proto/" } },
});
```

Run `proto build --remote` from that app (in this repository,
`bun run proto build --remote --app app`). The boolean `--remote` flag uses `PROTO_REMOTE_URL`
or the configured `review.remote.url` and emits a render host that trusts the public origin.
Rebuild when that origin changes. Plain `proto build` always produces an offline, read-only
gallery for static hosting, even when a remote URL is configured. Node callers select remote
mode with `buildProject(project, { remote: "https://acme.com" })` from `@compozy/proto/node`.

Mount the self-hosted review server in your backend, pointing `gallery.dir` at that build:

```ts
import { createReviewServer, postgresStorage } from "@compozy/proto/server";

// sql is your postgres.js connection; install the optional postgres peer in this backend.
const storage = postgresStorage(sql);
await storage.migrate(); // shipped DDL

export const protoReview = createReviewServer({
  storage, // or fileStorage(dir)
  basePath: "/proto/",
  publicOrigin: "https://acme.com", // gallery + API
  renderOrigin: "https://acme-proto.net", // prototypes, on another registrable domain
  ticketSecret: process.env.PROTO_TICKET_SECRET!,
  gallery: { dir: "../app/dist-proto" },
  signIn: (_request, returnTo) =>
    Response.redirect(`https://acme.com/login?next=${encodeURIComponent(returnTo)}`, 302),
  authorize: async request => identityFromSession(request), // { id, name, scopes } | null
  credentialOwner: async ownerId => identityOfUser(ownerId),
});
```

Route `/proto/*` on `acme.com` and **all paths** on `acme-proto.net` to the returned
`protoReview(request)` fetch handler. Preserve the original Host header. Both origins require
HTTPS (loopback excepted); use separate registrable domains, not two subdomains of one domain.
Keep review session cookies host-only. The ticket secret must be at least 32 bytes.

The repository's `apps/api` already mounts this handler and migrates its tables at startup.
Set `PROTO_PUBLIC_ORIGIN`, `PROTO_RENDER_ORIGIN`, `PROTO_TICKET_SECRET`, `PROTO_GALLERY_DIR`
(the absolute path to `apps/app/dist-proto`) and the comma-separated `PROTO_REVIEW_EMAILS`.
Only allowlisted Better Auth users with verified email addresses receive review/comment scopes.
This template has no email sender: an operator must independently confirm address ownership and
provision verification as described in [reviewer provisioning](apps/api/src/platform/proto.md).
See [deployment details](docs/proto/deployment.md) for routing and login setup.

- **Sign-in is yours.** Browser sessions become reviewers with the `review` and/or `comment` scopes
  your `authorize` returns.
- **Agents use bearer credentials.** Reviewers create credentials in Settings → Credentials. A
  credential always has only the `comment` scope (comment, reply, resolve, attach), so it can
  never approve, delete comments or manage credentials. The CLI stores it with `proto auth login`
  and uses it with `--remote`.
- **Prototype code can't act as the reviewer.** Prototypes render on a separate origin that holds
  no review cookies, behind short-lived render tickets. Cookie-authenticated writes require the
  gallery's origin plus an `X-Proto-Request` header.

Sign in to the gallery, then run:

```sh
proto auth login --remote https://acme.com/proto/
proto auth credentials --json
proto comments list --remote --json
proto comments reply login-form-7 --note "Fixed." --remote
```

Login prints the browser's credential settings URL and accepts a pasted token without echoing it.
The CLI saves it locally with mode 0600; tokens are never printed. Store commands use
`review.remote.url` (or `PROTO_REMOTE_URL`) with `--remote`; `PROTO_REMOTE_TOKEN` can override the
saved token. Manage server credentials, including revocation, in the browser.

Local and remote review are separate; a project chooses where a review happens (no syncing).

## Guards

`proto()` in your `vite.config.ts` and `protoPresentation()` in Storybook and Vitest enforce two
boundaries:

- **Production boundary.** `vite build` of your app fails if a `.proto.tsx`, a prototype fixture or
  gallery code reaches the production bundle.
- **Network guard.** A prototype, draft or story whose runtime imports reach a module listed in
  `guards.forbidRuntimeImports` (your API client, for example) fails Storybook, Vitest,
  `proto check` and `proto build`. Your application routes may import it.

```ts
// vite.config.ts
import { proto } from "@compozy/proto/vite";
export default defineConfig({ plugins: [react(), proto()] });

// vitest.config.ts / .storybook/main.ts (viteFinal)
import { protoPresentation } from "@compozy/proto/vite";
plugins: [react(), protoPresentation()];
```

## CLI

Every command accepts `--app <dir>` (default: cwd), `--json` and `--verbose`. Store-backed commands
accept `--remote`. Exit codes: `0` ok · `1` problems or user error · `2` usage · `3` missing
dependency · `4` remote or auth.

| Command                                                    | What it does                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `proto init [--skills]`                                    | Write the config, canvas, a first draft and the Vite plugin      |
| `proto dev [--port 4400] [--open]`                         | Gallery on `port`, render origin on `port + 1`                   |
| `proto build`                                              | Read-only `dist-proto/`; `--remote` builds for the review server |
| `proto list`                                               | Prototypes and flows                                             |
| `proto check`                                              | Problems and warnings, network guard, no-write render build      |
| `proto new <slug> [--draft] [--in <view>] [--spec <id>]`   | Scaffold a prototype or draft                                    |
| `proto flow new\|show\|list\|coverage`                     | Scaffold and inspect flows                                       |
| `proto url <slug> [--state <id>] [--bare]`                 | Gallery URL, or the bare render URL                              |
| `proto comments list\|show\|add\|reply\|resolve\|reopen`   | Read and answer threads (`--status`, `--waiting`, …)             |
| `proto comments attach\|detach\|edit\|attachments\|delete` | Images, edits, downloads; `delete` is reviewer-only              |
| `proto review status\|approve\|reopen`                     | Review status; approval is for people                            |
| `proto review unlock <key> --force`                        | Recover a review lock left by another machine                    |
| `proto screenshot <slug> [--state] [--theme] [--width]`    | PNG under `docs/design/<slug>/` (Playwright Chromium)            |
| `proto evidence <slug> [--state]`                          | Static HTML evidence, no scripts                                 |
| `proto migrate --from <dir> [--dry-run]`                   | Rewrite v1/v2 review files to v3 with a verification report      |
| `proto mcp`                                                | MCP server over stdio                                            |
| `proto auth login\|logout --remote <url>`                  | Store or remove a local remote credential                        |
| `proto auth credentials --json`                            | List local credentials without tokens or network access          |
| `proto auth revoke <id> --remote <url>`                    | Print the browser-only credential management URL                 |

## Configuration

`proto.config.ts` at the app root is the only config file. The Vite plugins, the CLI and `proto mcp`
read it.

```ts
import { defineProtoConfig } from "@compozy/proto/config";

export default defineProtoConfig({
  title: "Acme",
  specs: { auth: "Authentication", billing: "Billing" },
  roles: { member: "Member", admin: "Admin" },
  guards: { forbidRuntimeImports: ["src/lib/api.ts", "src/lib/gateway-*.ts"] },
});
```

| Key                           | Default                | Meaning                                                                      |
| ----------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `title`                       | —                      | Gallery title                                                                |
| `prototypes`                  | `"src/**/*.proto.tsx"` | Glob(s) of component prototypes                                              |
| `drafts`                      | `"src/drafts"`         | Drafts directory (free markup allowed)                                       |
| `flows`                       | `"flows"`              | Directory of `*.flow.ts` files                                               |
| `canvas`                      | `"proto.canvas.tsx"`   | File exporting `Canvas` and optional `Frame`                                 |
| `specs`                       | —                      | `{ id: label }`, or `(root) => Record<string, string> \| null`               |
| `roles`                       | —                      | `{ id: label }` offered by the role picker                                   |
| `siteUrl`                     | —                      | Resolves `site` nodes in flows                                               |
| `locale`                      | `"en"`                 | Shell language: `"en"` or `"pt-BR"`                                          |
| `guards.forbidRuntimeImports` | `[]`                   | Module ids, globs or RegExp that prototypes, drafts and stories can't import |
| `guards.productionBoundary`   | `true`                 | Fail the app build when prototype or gallery code reaches it                 |
| `review.remote.url`           | —                      | Default `--remote` target for CLI/MCP (including `build --remote`)           |
| `evidence.dir`                | `"docs/design"`        | Where screenshots and evidence are written                                   |
| `build.includeReview`         | `false`                | Ship review history in static builds                                         |
| `dev.port`                    | `4400`                 | Gallery port; the render origin is `port + 1`                                |
| `dev.poll`                    | `false`                | Polling file watcher                                                         |
| `dev.allowedHosts`            | `[]`                   | Extra `Host` values accepted by the dev servers                              |

Environment: `PROTO_PORT`, `PROTO_POLL=1`, `PROTO_REMOTE_URL`, `PROTO_REMOTE_TOKEN`.

## Package entries

| Entry                   | For                                                                   |
| ----------------------- | --------------------------------------------------------------------- |
| `@compozy/proto`        | Authoring: `definePrototype`, `useSearch`, `setParam(s)`, `protoHref` |
| `@compozy/proto/flow`   | `defineFlow`                                                          |
| `@compozy/proto/config` | `defineProtoConfig`                                                   |
| `@compozy/proto/vite`   | `proto()`, `protoPresentation()`                                      |
| `@compozy/proto/node`   | `loadProject()`: registry, review store, URLs, screenshots            |
| `@compozy/proto/server` | `createReviewServer`, `postgresStorage`, `fileStorage`                |
| `@compozy/proto/mcp`    | The MCP server behind `proto mcp`                                     |

## Status

`@compozy/proto` is **experimental (0.x)** and under active development in this repository.

- **Milestone 1:** package, gallery shell, local review loop (shell, CLI, MCP), guards, evidence,
  `proto migrate`, static build.
- **Milestone 2:** remote review server, `--remote` CLI and MCP, credentials.
- **Then:** a documentation site.

Out of scope: frameworks other than React + Vite, replacing Storybook, visual regression diffing,
a hosted SaaS, and syncing local and remote review data.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands and
conventions, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a vulnerability, see
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Pedro Nauck and Compozy contributors
