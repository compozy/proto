# Proto

Bun + Turborepo monorepo. `CLAUDE.md` is canonical; `AGENTS.md` is a symlink made by
`scripts/postinstall.sh`.

## Stack

- `apps/api`: Hono + `@hono/zod-openapi` on Bun. `src/platform/*` holds env, auth, HTTP and
  errors; `src/modules/<area>/*` holds one feature each. Port 3001, contract at `/openapi.json`.
- `apps/app`: React 19 SPA on Vite, TanStack Router (code routes in `src/router.tsx`) and Query.
  Calls the API only through `openapi-fetch` (`src/lib/api.ts`). Port 3002.

- `packages/db`: Drizzle + postgres.js. Schema in `src/schema`, migrations in `drizzle/`,
  integration harness in `src/testing.ts`.
- `packages/ui`: the BnUI library (shadcn Base Nova primitives on Base UI plus the BnUI modules),
  vendored as is (`packages/ui/README.md`). Theme tokens in `src/styles/theme.css`; icons from
  `@proto/ui/lib/icons`, never `lucide-react`. Add components with `bunx shadcn add` from
  `packages/ui`.
- `packages/gallery`: the prototype gallery and `proto` CLI (`packages/gallery/CLAUDE.md`).
- Auth: Better Auth (email + password) with the Drizzle adapter. Validation: zod 4.
- React Compiler is on: never write `memo`, `useMemo` or `useCallback`.

## Commands

| Command                              | What                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `bun run db:up`                      | Start Postgres (docker compose, port from `.env.local`)                           |
| `bun run db:generate` / `db:migrate` | Create / apply a migration after a schema change                                  |
| `bun dev`                            | Every app in watch mode                                                           |
| `bun run proto dev`                  | Prototype gallery on <http://127.0.0.1:4400>                                      |
| `bun run storybook`                  | Storybook of the UI and app views                                                 |
| `bun run verify`                     | Format check, lint, codegen check, typecheck, test, build. The definition of done |

`bun run codegen` regenerates `apps/api/openapi.json` and `apps/app/src/generated/api.d.ts` from
the API routes; `verify` fails when they are stale.

Integration tests (`*.it.test.ts`) run only when `TEST_DATABASE_URL` is set; locally use the
`DATABASE_URL` from `.env.local` (each suite creates and drops its own database). CI sets it.

## Rules

- Run `bun run verify` before calling work done. Fix the code, never weaken a test.
- Env lives in the root `.env.local` (template: `.env.example`). Add every new key to both.

- Every API route is declared with `createRoute` so it reaches the contract; run `bun run codegen`
  after changing one. Protected routes use `requireSession(auth)`.
- The SPA never imports `@proto/db`; persistence goes through the API.

- Shared code moves to `packages/*` only when a second app needs it.
- Add dependencies with an exact version (`bunfig.toml` pins); keep one version per package
  across the workspace.
- Commits follow Conventional Commits without scope (`feat: ...`), enforced by commitlint.
- Code and docs in English.

## Prototypes & Storybook

- Explore and review UI as prototypes before building routes: `*.proto.tsx` beside the view
  they compose, drafts in `src/drafts/<slug>/index.proto.tsx`, journeys in `flows/*.flow.ts`.
  Contract, URLs and the `proto` CLI: `docs/design/prototyping.md`. Answer review comments with
  `bun run proto comments`.
- Views take props and callbacks; routes own data and auth. Prototypes and stories never import
  the data layer (the presentation guard and the production boundary enforce it).
- Stories (`*.stories.tsx`, `docs/design/storybook.md`) run in Chromium in light and dark with
  a11y checks as part of `test`; a `play` assertion names its invariant and owner.

## Skills and recipes

- Skills are installed from `pedronauck/skills` into `.agents/skills` (lock: `skills-lock.json`).
  Add one with `npx skills add pedronauck/skills --skill <name> -a claude-code -a codex -y`;
  restore with `npx skills experimental_install`.
- Optional modules (jobs, email, error reporting, cron) live in `recipes/*.md`. Apply one by
  following its steps, then run `bun run verify`.
