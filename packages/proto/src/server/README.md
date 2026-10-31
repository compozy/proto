# Remote review server

`@compozy/proto/server` exports `createReviewServer(options)`, `fileStorage(dir)`,
`postgresStorage(sql)`, `createRemoteAuthorizer`, `ReviewEvents`, and the types `Identity`,
`Principal`, `ReviewServerOptions`, `ReviewStorage`, `Credential`, and `ReviewStore`.

`createReviewServer` returns `(request: Request) => Promise<Response>`. The public host serves
`<basePath>api/`, `<basePath>sign-in`, and the gallery. The render host serves only
`/__proto/render/`, behind a render grant. No CORS is enabled. Both origins must be canonical
origins, without trailing paths; `basePath` starts and ends with `/`.

The gallery directory contains `index.html`, `__proto/bootstrap.json`,
`__proto/registry.json`, and `__proto/render/index.html` plus its assets. Render builds must
use `mode: "remote"`, the configured public origin as `shellOrigin`, and path-form URLs.
The server overrides the static bootstrap's URLs and principal. Private review snapshots,
dotfiles, symlinks outside the root, and render files on the public host are not served.

`fileStorage(dir)` accepts the review directory itself. Its `.server/credentials.json` contains
only SHA-256 hashes and metadata, is mode 0600 inside a mode 0700 directory, and is gitignored.
Use a directory outside the public gallery. `postgresStorage(sql)` takes a postgres.js 3.4.9
client; postgres is an optional peer and is never imported at runtime by the file adapter.
Call `await storage.migrate()` during deployment. Migrations are shipped under
`@compozy/proto/server/migrations/*`; version 1 creates the normalized review tables. Migration
runs on a reserved connection under a session advisory lock and an explicit transaction.
Every request checks the schema version, including static and sign-in routes.

Review mutations share `ReviewEngine` with FileStore. PostgreSQL adapters lock the key row
before loading/mutating state, and claim pending uploads with a conditional UPDATE inside
that same transaction. Reads use repeatable-read snapshots. File and message `extra` values
round-trip through JSONB; event and attachment order are persisted explicitly.

The storage seam exposes `store`, `checkSchema`, `configure(registry, commit)`, and credential
`create/find/list/revoke/used` operations. The server owns authorship, CSRF, principal derivation,
and capability checks. Store methods own message/upload identity checks. Stable owner ids,
not display names, determine ownership. `configure` supplies build registry and commit to the
adapter; applications should use one configured storage per gallery.

For slice 8: `GET session` returns `{ principal }`. Credentials POST accepts `{ name }` and
returns `{ credential, token }` once; GET returns `{ credentials }` without tokens or hashes;
DELETE `credentials/:id` is idempotent and owner-scoped. Bearers are `pcr_` + 64 hexadecimal
characters. Every bearer request revalidates its owner's current comment scope. Review HTTP
routes and JSON envelopes remain those of `createReviewRouter`. The canonical transport
contract is `test/node/store/contract.ts::runStoreContract`; the server test adapter demonstrates
HTTP mapping without changing that suite.

Render ticket GET returns `{ ticket, url, expiresAt }`. Tickets last 60 seconds; exchange
redirects to a URL without the ticket and sets `__Host-proto-render` (Secure, HttpOnly,
SameSite=None, Path=/), valid one hour for every slug. Expired HTML emits protocol-v1
`auth:expired` with the frame nonce; HEAD returns 401 for the render host's expiry probe.
The ticket and grant signatures use separate purpose values and the render origin as audience.
`tldts` checks the full Public Suffix List, including private suffixes; this deliberately avoids
an incomplete vendored suffix subset. Same-site rendering requires explicit acknowledgement.

Logs contain only route pathname, status, principal kind and elapsed milliseconds. Application
loggers can consume these through `options.log`. They never receive bodies, cookies, bearer
values, ticket queries, or credential hashes.
