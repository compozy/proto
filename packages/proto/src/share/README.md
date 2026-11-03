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
The CLI passes `runningShare`; S5 replaces the temporary session module and implements that callback.

S5 uses `readConnection`, `checkConnection`, `openInvitations`, `closeInvitations`, and `setIngress`.
The start check rejects missing resources, changed Access settings and foreign application policies.
Invitation helpers act only on application-scoped policies named `proto-share invitees`.
The organization-wide email-code provider is preserved on disconnect.

`locateCloudflared` verifies the committed release asset digest before extraction or execution.
Digests come from Cloudflare's [2026.10.5 release](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.5).
`spawnCloudflared(binary, token)` returns `{ pid, sentinel, exited, close }`. Record the connector's
process start identity with its pid; close the sentinel pipe on intentional shutdown and mark that
shutdown before observing `exited`. Unexpected exits belong to the session lifecycle.
The token is passed only through `TUNNEL_TOKEN`, never argv or logging.

The temporary `session.ts` declares `startShare(project, options)`, `shareStatus`, `refreshShare`,
`stopShare`, and `runningShare`. Session supervision, control routes and terminal activity belong to S5.
The connection and executable I/O fixtures in `test/node/share` are reusable by that slice.
