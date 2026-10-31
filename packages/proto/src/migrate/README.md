# Local review migration

`migrateFiles(appRoot, options)` and `project.migrate(options)` return `MigrationReport`.
Options are `from` (relative to the app root for the Node API), `dryRun`, `flowPrefix`,
`themeMap`, `roleMap`, and the upgrader's optional `appPrefix`. Remote/database migration is
not implemented here.

The standalone CLI works without either config file:

```sh
proto migrate --from apps/app/gallery/comments --app app --dry-run --json
proto migrate --from apps/app/gallery/comments --app app
```

The CLI resolves `--from` from its working directory. `--app` accepts an app name or directory.
Without `--app`, a `gallery/comments` source identifies its app root; other source layouts use
cwd as their target root. Maps use `old=new,old2=new2`. The migration verb bypasses the normal
CLI app/config bootstrap so it also works before `proto.config.ts` exists.

Each key report includes source version/SHA-256, comment/message counts, attachment metadata
with byte counts and SHA-256, sequence, all upgrader rewrites, notes, status and verification.
An absent legacy sequence is seeded from retained ids with an explicit warning about ids deleted
before migration. Source bytes are never changed or deleted.

Writes serialize through the same per-key lock as FileStore. Existing unequal JSON or image
bytes produce `migration_conflict`; other keys continue. Missing target images from an interrupted
run can be copied again. Images are published before the key JSON; an interruption before the
JSON commit is resumable. A matching published key and matching images are left unchanged.
After publication the key and every image are reread and verified. Source bytes are also reread
before publication to reject a source that changed during the copy.

Non-dry runs write `proto/review/.gitignore` and `proto-migration-report.json`, including partial
failure reports. The CLI exits 1 if the report has errors. A dry run performs validation and
conflict detection but creates no files or directories; `verified` remains false until a real
copy has been read back.

If `gallery.config.ts` exists and `proto.config.ts` does not, the migrator extracts its default
object literal (or helper-call argument) without executing imports and maps title/specs/roles/
siteUrl. Computed legacy configuration requires manual conversion and is reported as
`invalid_config`; existing modern config is preserved. It does not rewrite application source.

The report lists the old comments directory as deletable only after all keys verify. It lists
`vite.presentation.ts`/`preview/` only after both Storybook and Vitest import and call
`protoPresentation()`; preview additionally requires a new canvas that no longer imports it.
These are suggestions for operator review, never automatic deletions. Consumer-specific
prototype/config migrations and remote cutover remain separate work.

Verification owner: `test/node/migrate/migrate.test.ts` (UT-063/064/082/083, IT-019). Existing
`test/node/dev/dev.test.ts` owns the real server/store/SSE wiring assertions (IT-001/003).
