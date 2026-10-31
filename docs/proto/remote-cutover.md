# Remote clients and reloaddev cutover

This repository provides the client and migration command. Deploying reloaddev's read-only
HTTP guard, switching its reviewers and deleting its copy/tables remain separate operator work.
No command here deletes source data or copies legacy credentials.

## CLI and MCP credentials

Configure `review.remote.url` in `proto.config.ts`, or set `PROTO_REMOTE_URL` to the gallery URL
including its base path. `PROTO_REMOTE_TOKEN`, when nonempty, overrides the saved credential.
Otherwise `~/.config/compozy-proto/credentials.json` supplies it. That file is mode 0600 and keyed
by origin; entries contain token, credential id/name/scopes, plus the last gallery URL for display.

```
proto auth login --remote https://gallery.example.com/proto/
proto auth credentials --json
proto comments list --remote --json
proto comments reply login-form-1 --note 'Fixed.' --remote
proto auth logout --remote https://gallery.example.com/proto/
```

Login prints the browser credentials URL, accepts a token without terminal echo, validates it
through `GET session`, and saves it. `auth revoke` prints the browser-only management URL; it
never tries to revoke through a bearer. Local listing does not contact the server or print tokens.
HTTPS is mandatory except literal localhost/loopback hosts. Requests use `credentials: omit`
and manual redirects; any redirect fails before a second request can expose the bearer.

`HttpStore({ url, token })` implements ReviewStore. Token may be a string or an async resolver.
Author arguments are ignored on the wire: the server owns identity and always derives an agent
from the bearer. Approval, review reopening, comment deletion and unlock are unavailable to
bearers. Store-backed MCP tools accept `remote: true` and return the same data as CLI `--json`.
The shared contract suite retains session-authorized setup for administrative operations; agent
operations and reads run through HttpStore. Dedicated cases assert that HttpStore cannot elevate
itself by passing a reviewer author.

## Maintenance window and database access

1. In reloaddev, set `PROTOTYPES_READ_ONLY=1` so **every prototype write route**, including
   credentials and upload routes, returns 503. Drain in-flight requests and pending uploads.
2. Also restrict the migration's source database connection. An application environment flag
   does not make SQL read-only. Prefer a dedicated role with CONNECT, schema USAGE and SELECT
   on the five `prototype_*` tables and `user`, without INSERT/UPDATE/DELETE grants. Alternatively
   configure `default_transaction_read_only=on` for the migration connection/role. postgres.js
   supports a URL query parameter `?default_transaction_read_only=on` (append with `&` if needed).
   This connection setting protects the command; the application guard/draining still prevents
   other writers. The command checks each table with a zero-row UPDATE. SQLSTATE 25006 or 42501
   confirms write refusal; success on even one table fails with `source_not_read_only`.
3. Use a separate writable target database and a target role able to apply the shipped DDL.
   Never place a live token or password in a committed script. Pass connection URLs through
   environment variables in the operator shell.

```sh
proto migrate remote --from-database "$RELOAD_READONLY_URL" --to-database "$PROTO_DATABASE_URL" \
  --flow-prefix fluxo- --theme-map claro=light,escuro=dark --role-map membro=member --dry-run
proto migrate remote --from-database "$RELOAD_READONLY_URL" --to-database "$PROTO_DATABASE_URL" \
  --flow-prefix fluxo- --theme-map claro=light,escuro=dark --role-map membro=member
```

The source schema is the reloaddev schema documented by
`packages/proto/test/fixtures/review/reloaddev-sql/README.md`. Only `user.id/name/updated_at` are read;
legacy credential token hashes are not returned or copied (a server-side SHA-256 fingerprint detects changes). Pending attachments lack a review key
in that schema. A verified migration refuses them rather than silently dropping or guessing
ownership: drain/claim/discard them in reloaddev before running the command.

The command reads a consistent source snapshot and records counts, nullable `max(updated_at)`
and a SHA-256 content fingerprint for each table. Tables without an updated_at column report
null there; their content hash still detects changes. It rechecks after each key and at the end.
A changed fingerprint stops the run with `migration_source_changed`; already committed keys
remain available for a resume after the cause is corrected.

Each target key imports in one transaction under its key-row lock. Equal content, including
image bytes and sequence, is skipped; different content reports `migration_conflict` without
overwriting it. The report records renamed keys/fields, sequence, every comment's verification,
image byte hashes, and approval open counts as `estimated`. Counts cover the mapped source key
set, leaving unrelated target keys untouched. Credentials are explicitly recorded as not copied;
owners must issue new pcr_ credentials after cutover. Dry run writes the report but neither
creates target tables nor commits target rows. Existing compatible tables are checked for conflicts.

Inspect `proto-migration-report.json` in the invocation directory: only `verified: true`,
`sourceUnchanged: true` and an empty errors array indicate a successful cutover. A dry run is
marked planned and never claims verification of writes. Keep reloaddev read-only after success,
point reviewers at the new server, and obtain Pedro's sign-off before deleting the legacy module
or dropping its tables. This command does neither.

Node callers use `migrateRemote(options)` from `@compozy/proto/node`. PostgreSQL storage exposes
`readKey(key)` and `importKey(file, attachments, dryRun?)` for this migration path. These methods
are privileged backend operations, not HTTP endpoints; the browser/bearer API does not expose them.

Unknown source columns, including an existing `extra` column, are retained under each v3 record's `extra.legacyRow` without key collisions. Verification compares that metadata and attachment hashes directly with the source rows before marking a key verified.
