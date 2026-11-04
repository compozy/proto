# Share snapshots

This directory is private CLI infrastructure. Load it dynamically from the CLI; do not import it
from shell, render, model, server or the public Node entry.

`scopedProject(project, target)` delegates to the project and overrides `registry()`. A prototype
scope contains that prototype; a flow scope also contains every prototype rendered by its nodes.
Only referenced specs and matching diagnostics remain. Roles and global warnings remain, and canvas
diagnostics still fail the build. Unknown targets raise `share_target_not_found`.

The session composition root uses these helpers:

- `shareDirectory(root)` returns `<app>/node_modules/.cache/compozy-proto/share`.
- `cleanupSnapshots(root)` removes all snapshots and leftover `.proto-build-*` directories. Call at
  start and stop, after excluding another live session and serializing with builds. The narrower
  `cleanupBuildDirectories(root)` removes only crash staging directories.
- `checkDirtyTree(root, { approvers, before? })` checks from the Git top level, excluding this app's
  review directory, share cache and staging directories. Pass the pre-build result as `before` to
  check that HEAD did not move. It raises `share_dirty_tree` for uncertifiable approver builds;
  commenter-only callers receive `approvable: false` and should print the CLI's "not approvable" notice.
- `buildAndSwap(project, target, { remote, approvers, shellDir? })` performs both checks, builds a new
  version, then atomically replaces `current`. It returns `{ snapshot, commit, approvable, output,
  warnings }`. `commit` comes from the built bootstrap. Serialize refreshes in the session layer.
  Build/check/cleanup failures before publication preserve `current`. One previous version remains
  after each successful swap; older versions are pruned. On Windows, `current` is a junction.

`buildProject` accepts additive `output` (absolute directory) and `snapshot` (bootstrap version id)
options. The default still replaces `dist-proto`. Explicit output is never recursively removed by
the builder, and its parent is created before publishing the completed staging directory. Share
builds always use a fresh version directory, so the existing gallery remains untouched.

# Share provisioning

`CloudflareClient(token, baseUrl?)` is the only Cloudflare API boundary. The base URL is an explicit
constructor argument, never an environment setting. `connect` discovers resources by name before
creating them, restores adopted Access settings, and atomically saves `Connection` outside the project.
`disconnect({ running })` requires the session owner's liveness callback to refuse a running share.
The CLI passes `runningShare`; the session module implements that liveness callback.

Lists use `total_pages`, then `total_count`, then a short page to detect completion, and fail after
1,000 pages rather than returning a partial list. Status uses a five-second tunnel query with no retries
and reports `unhealthy` on errors or timeout; `ShareRuntime.statusTimeout` can shorten this bound.
Other calls retain their retry behavior.

The session uses `readConnection`, `checkConnection`, `openInvitations`, `closeInvitations`, and `setIngress`.
The start check rejects missing resources, changed Access settings and foreign application policies.
Invitation helpers act only on application-scoped policies named `proto-share invitees`.
The organization-wide email-code provider is preserved on disconnect.

`locateCloudflared` verifies the committed release asset digest before extraction or execution.
Digests come from Cloudflare's [2026.10.5 release](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.5).
`spawnCloudflared(binary, token)` returns `{ pid, sentinel, exited, close }`. Record the connector's
process start identity with its pid; close the sentinel pipe on intentional shutdown and mark that
shutdown before observing `exited`. Unexpected exits belong to the session lifecycle.
The token is passed only through `TUNNEL_TOKEN`, never argv or logging.

`session.ts` implements `startShare(project, options)`, `shareStatus`, `refreshShare`,
`stopShare`, and `runningShare`. It supervises the connector and both loopback servers; `startShare` returns summary, refresh, stop
and a `closed` promise containing an unexpected tunnel failure or null on intentional stop.
The optional third argument supplies explicit network/process paths and callbacks for tests.
`activity` carries verified identities; `log` carries only the existing request metadata.
Control commands reuse the private record and require both pid and process start identity to match.
The connection and executable I/O fixtures in `test/node/share` are reusable by that slice.

# Share transport and identity

These CLI-internal modules are not part of the public Node entry. The review server remains
provider-neutral.

Before opening a tunnel, call `await prefetchAccessAuthorizer({ teamDomain, audience, invitees })`
from `access.ts` and pass the returned function to the review server's `authorize` option. This
fetches RSA signing keys with a five-second timeout and raises `cloudflare_api_error` on failure.
The lower-level `accessAuthorizer` also exposes `await authorize.prefetch()` for composition.
`clock`, when supplied, returns Unix milliseconds. Invitations are read for every authorization;
provide approvers with `["review", "comment"]` and commenters with `["comment"]`.

Pass `notInvitedPage(project.config.locale)` from `pages.ts` as `signIn`. It returns a static,
localized 403 without reflecting request or prototype data.

`serveHandler(handler, { publicOrigin, renderOrigin, sessionId })` from `http.ts` listens on an
ephemeral loopback port, permits exactly the two configured hosts, and marks every response with
`X-Proto-Session`. Responses stream with backpressure and client disconnects abort the handler's
request signal. Request bodies are limited to 5 MB plus 64 KB, matching the dev upload envelope.
Always await `close()` during teardown: it ends SSE, closes idle connections and force-closes
remaining connections after ten seconds. Repeated calls share the same shutdown.
