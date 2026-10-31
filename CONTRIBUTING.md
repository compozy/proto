# Contributing to proto

Thanks for helping. This repository builds `@compozy/proto` (`packages/proto`) and dogfoods it:
`apps/app` is a React + Vite consumer that hosts the shell's own prototypes, and `apps/api` mounts
the review server.

## Setup

You need [Bun](https://bun.sh) (version in `.bun-version`), Node (version in `.node-version`) and
Docker for Postgres.

```console
$ bun install
$ cp .env.example .env.local
$ bun run db:up
$ bunx playwright install chromium   # browser tests and screenshots
```

## Commands

| Command                              | What                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `bun dev`                            | Every app in watch mode                                                  |
| `bun run proto dev`                  | Gallery on <http://127.0.0.1:4400>, render origin on port 4401           |
| `bun run proto <command> --app app`  | Any `proto` CLI command against `apps/app`                               |
| `bun run storybook`                  | Storybook of the UI and app views                                        |
| `bun run db:generate` / `db:migrate` | Create / apply a migration after a schema change                         |
| `bun run codegen`                    | Regenerate the OpenAPI contract and its client types                     |
| `bun run verify`                     | Format check, lint, codegen check, typecheck, test, build — run it first |

`bun run verify` is the definition of done; CI runs the same command.

## Repository layout

- `packages/proto` — the package: authoring contract, config, registry, Vite plugins, render host
  (`src/render`), review shell (`src/shell`), review model and store, CLI and MCP.
  `packages/proto/CLAUDE.md` describes its internals.
- `packages/ui` — the BnUI component library used by `apps/app` (the shell vendors its own).
- `packages/db` — Drizzle schema and migrations of the template app.
- `apps/app`, `apps/api` — the dogfood consumer and API.

Design decisions live in the spec under `.compozy/tasks/proto-library/` (`_spec.md`, `_dx.md`,
`_uiux.md`, ADRs). Changes to the public surface should agree with it; open an issue first when
they don't.

## Tests

- **Vitest** with two projects in `packages/proto/vitest.config.ts`: `node` (`test/node/**`) for
  the registry, model, store, router, CLI and MCP, and `browser` (`test/browser/**`, Playwright
  Chromium) for the shell, the render host and the shell ⇄ render protocol.
- Integration suites (`*.it.test.ts`) need Postgres: they run only when `TEST_DATABASE_URL` is set
  (use the `DATABASE_URL` from `.env.local`; each suite creates and drops its own database).
- Stories (`*.stories.tsx`) run in Chromium in light and dark with accessibility checks.
- When a test exposes a bug, fix the code; never weaken the test. Mock only at I/O boundaries.

## Prototypes

UI work starts as a prototype. Put `*.proto.tsx` beside the view it composes, drafts in
`apps/app/src/drafts/<slug>/index.proto.tsx` and journeys in `apps/app/flows/*.flow.ts`; see
`docs/design/prototyping.md`. Views take props and callbacks; routes own data. Prototypes and
stories never import the data layer, and the guards fail the build if they do.

## Conventions

- TypeScript everywhere; code and docs in English.
- Format with `oxfmt` and lint with `oxlint` (both run in `verify` and in the pre-commit hook).
- React Compiler is on: don't write `memo`, `useMemo` or `useCallback`.
- Dependencies use exact versions, one version per package across the workspace.
- Apps import icons from `@proto/ui/lib/icons`, never `lucide-react`.

## Commits and pull requests

Commits follow [Conventional Commits](https://www.conventionalcommits.org) **without a scope**,
enforced by commitlint: `feat: …`, `fix: …`, `docs: …`, `test: …`, `refactor: …`, `perf: …`,
`build: …`, `ci: …`.

1. Fork and branch from `main`.
2. Keep the change focused, with its tests and docs.
3. Run `bun run verify`.
4. Open a pull request using the template and describe what changed and how you verified it.

For larger changes, open an issue first. Security issues go through [SECURITY.md](SECURITY.md),
not public issues. Everyone follows the [Code of Conduct](CODE_OF_CONDUCT.md).

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
