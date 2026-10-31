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
The integrated package emits every public entry, SQL migrations under `src/server/migrations/`,
and the skills used by `proto init --skills`. The tarball adoption test has no slice skips: it
imports every entry, resolves migration SQL, runs the installed Node/Bun bin, scaffolds a fresh
Vite React app, and serves the prebuilt shell, bootstrap and render origin through `proto dev`.

## Automated release

Pushes to `main` run git-cliff 2.7.0 against Conventional Commits, compute the next version, and
open/update `release/v<version>`. The PR contains the manifest and lockfile bump, `CHANGELOG.md`,
and `.release-notes/v<version>.md`. Its title and squash merge subject must be
`build: release v<version>`. The initial version is `0.1.0`.

The `compozy` organization provides `RELEASE_TOKEN` and `NPM_TOKEN` with ALL repository
visibility, so this repository inherits both. `RELEASE_TOKEN` needs contents and pull-request
write access so generated PRs trigger CI. `NPM_TOKEN` is used only for first-package bootstrap.
CI remains in
`ci.yml`; release PRs additionally run package contract tests, build, dry-run pack and real tarball
adoption. Never bypass a failed required CI check to merge a release PR.

Merging the release PR selects publication rather than creating another PR. The workflow validates
the committed version against the merge subject, builds, validates the tarball, publishes to npm
with OIDC and provenance, then creates the tag and GitHub Release. No GitHub Release claims a
publication before npm succeeds. Publication runs are serialized and non-cancellable; ordinary
pushes use a separate group. Failed publication can be retried by dispatching `main` while it
still contains the same release version and channel; registry failures other than 404 fail closed.

For an explicit release, land the intended version and matching lockfile on `main`, then dispatch
`release.yml` with the branch selector set to `main`, plus `version` and `channel`. Both stable and
beta publication require `refs/heads/main`: the job/steps and the publication script reject other
branches and tags. PRs retain dry-run validation. No environment is added, so the npm trusted
publisher environment field remains blank. Protect `main` and workflow changes with required PR
reviews; npm's workflow identity alone does not restrict the source branch. Stable versions are `X.Y.Z` and use npm
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
Node 24, npm 11.9.0 and `id-token: write`. The bootstrap secret is exposed only to the main-only publication step.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for the authoritative UI
and minimum runtime requirements.

The first release publishes the real stable `0.1.0` from GitHub Actions, with provenance:

1. Merge the validated `release/v0.1.0` PR with subject `build: release v0.1.0`, or dispatch
   `release.yml` on `main` with version `0.1.0` and channel `stable`.
2. The script checks the package endpoint (not the version endpoint). Only HTTP 404 enables
   bootstrap, and only for stable `0.1.0`. It maps the inherited `NPM_TOKEN` to `NODE_AUTH_TOKEN`
   for the npm publish child using a temporary private npmrc, removed afterward. The token must
   authorize creating a public package in the npm `compozy` organization and unattended publishing.
   `--provenance` and `id-token: write` remain enabled. No local npm login or beta is needed.
3. After npm integrity, tag and provenance verification succeeds, the workflow creates the git
   tag and GitHub Release. Failure withholds both.
4. Open the npm access URL above and configure the trusted publisher using the exact table values.
   Once the package exists, its HTTP 200 selects OIDC even though the org bootstrap secret remains
   available. The secret is stripped before subprocess execution; direct `NPM_TOKEN` or
   `NODE_AUTH_TOKEN` inputs are refused. A missing new version never re-enables bootstrap.
5. Verify npm `latest`, provenance and GitHub `v0.1.0`. Subsequent releases and retries require
   trusted publishing; registry errors other than 404 fail closed. Do not delete the npm package:
   the bootstrap condition is registry absence, not a separate persistent workflow flag.

## Runtime boundary

The in-consumer gallery has been removed. The catalog's CLI-only `build` lifecycle verb calls
`buildProject(project)`; it never builds the shell in the consumer. Shell-only `@xyflow/react`
is a development dependency and its code is bundled into `dist/shell`. There are no remaining
runtime imports of `@proto/ui`, `@tanstack/react-query` or `elkjs` in this package. The installed
consumer does not need those packages. Vendored UI attribution comments remain intact.
