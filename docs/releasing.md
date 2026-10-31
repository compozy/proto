# Releasing @compozy/proto

## Package and validation

Workspace exports point at TypeScript sources, so Vite, Bun and TypeScript consumers work before
`dist` exists. `bun run --cwd packages/proto build` uses tsdown to emit ESM and declarations into
`packages/proto/dist/package/src`, preserves relative module locations, and copies the render host
sources for compilation by the consumer's Vite. The manifest in `dist/package` points at JavaScript
and declarations; it has no development dependencies or lifecycle scripts. The workspace manifest
is never rewritten. Pack **the staging directory**, not the workspace source:

```sh
bun install --frozen-lockfile
bun run --cwd packages/proto build
bun run --cwd packages/proto test --project node test/node/package/package.test.ts
bun run --cwd packages/proto test:tarball
npm pack ./packages/proto/dist/package --ignore-scripts --dry-run
npm pack ./packages/proto/dist/package --ignore-scripts
```

`bun run --cwd packages/proto pack` is the build-and-pack shorthand. Direct packing of the source
package fails with an instruction to use the staging directory, preventing an accidental TS-only
release. The package build checks aggregate per-file gzip size of shell JS, CSS and HTML against
400 KiB. When `build:shell` is present, it must emit `dist/shell/index.html`; errors are fatal.
During slice integration, missing shell and `/server` or `/mcp` sources emit explicit skip messages.
Absent optional entrypoints are omitted from the staged exports rather than pointing to missing files.
No fake modules are generated. Shell absence blocks publication. The tarball test always runs export,
Node/Bun CLI help, bootstrap and render compilation checks. Only shell and new CLI-dependent steps
are skipped while those slices are absent.

## Automated release

Pushes to `main` run git-cliff 2.7.0 against Conventional Commits, compute the next version, and
open/update `release/v<version>`. The PR contains the manifest and lockfile bump, `CHANGELOG.md`,
and `.release-notes/v<version>.md`. Its title and squash merge subject must be
`build: release v<version>`. The initial version is `0.1.0`.

Set the repository secret `RELEASE_TOKEN` to a GitHub token with contents and pull-request write
access. This lets generated PRs trigger CI; it is unrelated to npm authentication. CI remains in
`ci.yml`; release PRs additionally run package contract tests, build, dry-run pack and real tarball
adoption. Never bypass a failed required CI check to merge a release PR.

Merging the release PR selects publication rather than creating another PR. The workflow validates
the committed version against the merge subject, builds, validates the tarball, publishes to npm
with OIDC and provenance, then creates the tag and GitHub Release. No GitHub Release claims a
publication before npm succeeds. Publication runs are serialized and non-cancellable; ordinary
pushes use a separate group. Failed publication can be retried by dispatching the same source ref,
version and channel; registry failures other than 404 fail closed.

For an explicit release, commit the intended version and matching lockfile on the selected ref,
then dispatch `release.yml` with `version` and `channel`. Stable versions are `X.Y.Z` and use npm
`latest`; beta versions are `X.Y.Z-beta.N` and use npm `beta` with a GitHub prerelease. Dispatch
never silently changes the selected commit's version. Do not dispatch an older stable version after
a newer release; dist-tags are part of the release identity.

## npm trusted publisher and first release

Live registry checks on 2026-10-31 returned 404 for `@compozy/proto`; `@compozy/extension-sdk`
and `@compozy/client` exist at `0.4.6`, both with public SLSA provenance attestations. Compozy's reference workflow publishes its SDK packages with npm 11.9.0 and
OIDC/provenance, rejecting npm tokens. Their private npm account settings cannot be confirmed from
repository files or public registry metadata.

In the logged-in browser, open <https://www.npmjs.com/package/@compozy/proto/access> (or the
package page's Settings tab). Under **Trusted Publisher**, select **GitHub Actions** and enter:

| Field                | Value                       |
| -------------------- | --------------------------- |
| Organization or user | `compozy`                   |
| Repository           | `proto`                     |
| Workflow filename    | `release.yml`               |
| Environment          | Leave blank                 |
| Allowed actions      | Enable direct `npm publish` |

The filename has no `.github/workflows/` prefix. The workflow uses GitHub-hosted Ubuntu runners,
Node 24, npm 11.9.0 and `id-token: write`. Do not add `NPM_TOKEN` or `NODE_AUTH_TOKEN` secrets.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for the authoritative UI
and minimum runtime requirements.

If npm requires an existing package before attaching a trusted publisher, use this one-time
bootstrap after the integration PR and validation have completed:

1. In a clean release checkout, set the package version to `0.1.0-beta.0`, refresh `bun.lock`, and
   commit it. Run the package validation commands above and the orchestrator's full `bun run verify`.
2. Authenticate locally with `npm login` as an authorized member of the `compozy` npm organization.
   Browser login alone does not authenticate the CLI.
3. Run `npm publish ./packages/proto/dist/package --ignore-scripts --access public --tag beta --provenance=false`.
   This deliberately publishes an initial **unprovenanced beta**, not the stable release. Local
   publishing cannot produce GitHub Actions provenance. Do not pretend it does or republish it.
4. Configure the trusted publisher with the fields above. Restore the intended stable `0.1.0`
   through a normal version-change commit (no history reset), refresh the lockfile, and validate.
5. Merge the generated `release/v0.1.0` PR using the exact subject `build: release v0.1.0`.
   For recovery after a failed publication, dispatch `release.yml` on that merge commit with
   `version=0.1.0`, `channel=stable`.
6. Verify npm `latest` is `0.1.0`, inspect its provenance link to `compozy/proto`/`release.yml`,
   install the public package in a fresh consumer, and verify GitHub tag/release `v0.1.0` targets
   that commit. The beta bootstrap remains an immutable, clearly identified exception.

No automated bootstrap credential is stored. These are operator steps, not actions performed by
the worker implementing the release system.

## Remaining workspace UI imports at the W8 base

These files are excluded from the emitted Node package. The shell build must vendor their UI
before publication; `@proto/ui` is a development dependency only. The tarball adoption installs
without `@proto/ui`. The shell worker owns removing these source imports.

- `packages/proto/src/main.tsx`
- `packages/proto/src/shell/overview.tsx`
- `packages/proto/src/shell/side-panel.tsx`
- `packages/proto/src/shell/shortcuts.tsx`
- `packages/proto/src/shell/sidebar-levels.tsx`
- `packages/proto/src/shell/sidebar.tsx`
- `packages/proto/src/shell/toolbar.tsx`
- `packages/proto/src/shell/sidebar-flows.tsx`
- `packages/proto/src/shell/topbar.tsx`
- `packages/proto/src/shell/flow-toolbar.tsx`
- `packages/proto/src/shell/comments/overlay.tsx`
- `packages/proto/src/shell/flows/side.tsx`
- `packages/proto/src/shell/canvas.tsx`
- `packages/proto/src/shell/sidebar-rows.tsx`
- `packages/proto/src/shell/comments/message.tsx`
- `packages/proto/src/shell/viewport-control.tsx`
- `packages/proto/src/shell/flows/flow-edge.tsx`
- `packages/proto/src/shell/flows/membership.tsx`
- `packages/proto/src/shell/flows/nodes.tsx`
- `packages/proto/src/shell/flows/inspector.tsx`
- `packages/proto/src/shell/flows/flow-view.tsx`
- `packages/proto/src/shell/flows/chrome.tsx`
- `packages/proto/src/shell/comments/flow-composer.tsx`
- `packages/proto/src/shell/comments/composer.tsx`
- `packages/proto/src/shell/comments/pins.tsx`
- `packages/proto/src/shell/comments/panel.tsx`
- `packages/proto/src/shell/gallery.tsx`
- `packages/proto/src/shell/comments/attachments.tsx`
