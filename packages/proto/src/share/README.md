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
