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
release. Declaration emission canonicalizes union types and property-only type literals through the TypeScript AST because inferred union
ordering varies with compiler scheduling. The package build checks aggregate per-file gzip size of shell JS, CSS and HTML against
400 KiB. When `build:shell` is present, it must emit `dist/shell/index.html`; errors are fatal.
The integrated package emits every public entry, SQL migrations under `src/server/migrations/`,
and the skills used by `proto init --skills`. The tarball adoption test has no slice skips: it
imports every entry, resolves migration SQL, runs the installed Node/Bun bin, scaffolds a fresh
Vite React app, and serves the prebuilt shell, bootstrap and render origin through `proto dev`.

## Automated release

Releases use **pr-release** ([`github.com/compozy/releasepr`](https://github.com/compozy/releasepr),
the release tool shared by the Compozy repositories; agent guide: the `releasepr` skill), pinned
as `PR_RELEASE_MODULE` in `.github/workflows/release.yml`, with git-cliff 2.7.0.

A push to `main` runs `pr-release pr-release --force --enable-rollback --ci-output`. It computes
the next version from Conventional Commits with `cliff.toml`, writes `CHANGELOG.md`,
`RELEASE_BODY.md` (this release) and `RELEASE_NOTES.md` (history), archives custom notes, pushes
`release/v<version>` and opens or updates the pull request `build: release v<version>`. A failed
step rolls back. `.pr-release.yaml` adds three `release_artifacts` steps:
`scripts/release/sync-version.mjs` sets the version in `packages/proto/package.json` and undoes
pr-release's own rewrite of the private root `package.json`, `bun install --lockfile-only` updates
`bun.lock`, and oxfmt formats the generated files. The squash merge subject must stay
`build: release v<version>`.

Versioning follows the Compozy repositories: while the major version is 0, `feat`, `fix` and every
other type bump the **patch**, and only a breaking change (`feat!`, `BREAKING CHANGE`) bumps the
minor (`[bump]` in `cliff.toml`). Because the version stays the same until a release merges, new
commits update the one open release pull request instead of opening another. To force a version,
add a `Release-As: X.Y.Z` footer to a commit. For prose a commit subject cannot carry, add a note
before the release; it is folded into the next release body and archived under
`.release-notes/archive/v<version>/`:

```sh
go run github.com/compozy/releasepr@v0.0.35 add-note --title "..." --type feature --body "..."
```

The `compozy` organization provides `RELEASE_TOKEN` and `NPM_TOKEN` with ALL repository
visibility, so this repository inherits both. `RELEASE_TOKEN` needs contents and pull-request
write access so generated PRs trigger CI. `NPM_TOKEN` is used only for first-package bootstrap.
CI remains in
`ci.yml`; release PRs additionally run package contract tests, build, dry-run pack and real tarball
adoption. Never bypass a failed required CI check to merge a release PR.

Merging the release PR selects publication rather than creating another PR. The workflow checks
the merge subject against the committed version, then `pr-release plan` proves the release identity
(tag free, HEAD is the release commit) and `pr-release release-body` renders the GitHub Release
body for exactly the planned range. Release PRs run the same plan as validation. It then builds, validates the tarball, publishes to npm
with OIDC and provenance, then creates the tag and GitHub Release. No GitHub Release claims a
publication before npm succeeds. Publication runs are serialized and non-cancellable; ordinary
pushes use a separate group. Failed publication can be retried by dispatching `main` while it
still contains the same release version and channel; the plan then accepts an existing tag only
when it is annotated and points to the release commit. Registry failures other than 404 fail
closed.

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

The first release required a one-time local bootstrap `0.1.0-beta.0`, now deprecated,
because the organization `NPM_TOKEN` cannot create packages. The trusted publisher was then
configured with `npm trust github`; stable `0.1.0` was published by GitHub Actions with provenance.
The bootstrap code remains restricted to an absent package and stable `0.1.0`; existing packages
always use OIDC, with token credentials stripped from subprocesses.

Registry processing can take several minutes after npm accepts a publication. Verification uses
exponential backoff from 5 seconds to a 60-second cap, with a ten-minute deadline and progress
logs. `NPM_VERIFY_TIMEOUT_MS` can shorten that deadline (1–600000 ms).
A fresh publication must match the candidate integrity. A retry of an existing immutable version
instead checks the registry SLSA v1 attestation: its SHA-512 subject must match published integrity,
and its source repository, main ref, release workflow and resolved commit must identify this run.
Both paths require the expected dist-tag and provenance before GitHub finalization. Mismatches
and registry errors fail closed. Existing matching tags and Releases are reused without regenerating
release notes; conflicting commit or prerelease identity is refused.

## Runtime boundary

The in-consumer gallery has been removed. The catalog's CLI-only `build` lifecycle verb calls
`buildProject(project)`; it never builds the shell in the consumer. Shell-only `@xyflow/react`
is a development dependency and its code is bundled into `dist/shell`. There are no remaining
runtime imports of `@proto/ui`, `@tanstack/react-query` or `elkjs` in this package. The installed
consumer does not need those packages. Vendored UI attribution comments remain intact.
