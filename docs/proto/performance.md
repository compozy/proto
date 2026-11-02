# Gallery performance and React checks

The shell keeps server data in TanStack Query and preview admission in XState Store. Each shell
owns its cache and grid scheduler; each flow canvas owns a separate scheduler. Local component
state stays in React when it does not need cross-component subscriptions.

Comment tools also use a provider-owned XState Store. Thread and pin focus live in the URL, so
direct links, navigation and browser history have one authority. Render messages are delivered
through the owning frame's validated subscription, without a module-global comment message bus.

## Preview lifetime

Ready previews remain in a bounded least-recently-used queue: at most 12 frames are retained and
at most 3 slots load concurrently per surface. Panning out of view keeps ready frames until there
is eviction pressure. Zooming below 60% hides existing previews and stops admitting new ones;
zooming back in reuses their documents. A changed target or theme starts a fresh document.
Leaving a page releases its frames.

Each preview subscribes to its own store slot. The flow graph no longer subscribes to every zoom
tick: cards observe only the 60% threshold, and the percentage readout observes zoom itself.
Unchanged measured dimensions do not update the controlled graph. Registry structural sharing
also preserves unchanged flow and prototype objects after SSE updates.

Development edits use Vite HMR. Flow edits update the shell registry; prototype metadata changes
reload only the virtual prototype registry, accepted by the render entry. Component edits use the
consumer's normal refresh pipeline. Saving a prototype or flow no longer broadcasts a full reload
to every iframe. Canvas creation/removal separately invalidates the virtual canvas. A replacement
prototype component clears a failed error boundary without remounting the unchanged Canvas.
Rerenders of the same component preserve its state; replacement components follow React/Refresh semantics.
The Vite and registry watchers use the same polling fallback on macOS; other
platforms can opt into polling with `dev.poll`.

One project observer serves all registry subscribers. While watched, repeated registry reads
share a snapshot until an authored file changes; the last unsubscribe stops observation and clears
it. Watchless CLI reads remain fresh. Polling scans configured prototypes/canvas and authored flow
files, including misplaced flows whose location must appear in live diagnostics.

## Loading and server data

Bootstrap and registry have canonical query options. Reviews share keys between single-item and
group readers, so a spec card and an open detail do not fetch the same review independently.
Comments retain their filter in the key. Live reviews stay fresh for 30 seconds; inactive queries
are collected after 10 minutes. Static snapshots and the authored registry stay fresh until
explicit invalidation. Read requests pass Query's abort signal to fetch, and a failed refresh
keeps the last successful data on screen.

SSE and mutations invalidate the changed review and comment lists that include it. They preserve
unrelated entries. Render tickets retain their short-lived, session-local sharing and existing
origin/nonce validation.

Queries and mutations use `networkMode: "always"`: a browser offline event does not pause a
reachable local server. Real transport failures retain the normal error/retry behavior. Lazy
page import failures show a retry that reloads the document, clearing rejected import promises.

The provider batches nearby review notifications for 50 ms and serializes subsequent refreshes,
so an event arriving during a read is reconciled after that read. EventSource reconnect triggers
reconciliation because the server does not replay missed events. FileStore establishes a fingerprint
baseline before polling, avoiding synthetic changes for every preexisting review on startup.

Pins and threads share the all-comments query for their key. Search derives and subscribes to its
index only while open; inbox descriptors/groups and graph adjacency use maps instead of repeated
linear scans. PostgreSQL lists read all matching keys in one repeatable-read transaction, assemble
relations using indexes, and select attachment metadata without transferring image bytes. Saves
batch each relation in foreign-key order inside the existing transaction. File operations use
four concurrent workers per batch, preserve result order and drain in-flight work on failure
before releasing locks. Migration aliases targeting the same key remain serialized.

Hover, keyboard focus and touch intent prefetch the destination's canonical review queries. Flow
and settings code are separate chunks, loaded on intent or when visited. Existing query-string
URLs and browser history continue to use the shell's navigation contract.

The production shell was compared with `b5367df` using the same Node `gzipSync` defaults for
each emitted asset. Initial JavaScript includes the entry and every module preload in
`dist/shell/index.html`; total assets include all JavaScript and CSS chunks, excluding fonts.

| Compressed bytes       |  Before |   After | Change |
| ---------------------- | ------: | ------: | -----: |
| Initial JavaScript     | 337,000 | 280,590 | -16.7% |
| All JavaScript and CSS | 354,230 | 379,518 |  +7.1% |

The cache libraries add code to the complete distribution; deferred flow and settings chunks
reduce the initial load. These are transfer-size measurements, not a latency benchmark. The
complete compressed shell remains below its existing 400 KiB build budget.

The [expanded audit](../../.audits/architectural-analysis-2026-11-01T2358.md) contains the full
82-warning baseline disposition ledger, inspected boundaries, regressions and limitations.
[Raw synthetic samples](performance-samples.json) include runtime versions and two real Chromium
workloads. Reproduce from `packages/proto` after `bun run build:shell`:

```sh
bun run scripts/benchmark-gallery.ts 120 flat
bun run scripts/benchmark-gallery.ts 120 reviews
bun run scripts/benchmark-graph.ts
```

At 120 prototypes, repeated watched registry reads reuse their snapshot instead of taking another
8–13 ms parsing pass. In the 10,000-node CPU workload, median BFS decreases from 320.65 to 0.78 ms
and layout from 261.00 to 2.70 ms. These isolate the algorithm; they do not imply that rendering
10,000 cards is inexpensive. Browser startup samples vary and do not establish a latency reduction.

Cold spec status still makes one request per review key (121 in the 120-prototype reviews sample).
Comment lists are not paginated, and a later filesystem notification may cause a second refresh
after an HTTP mutation because events carry no revision identifier. These costs remain explicit.

## React Compiler and Doctor

`bun run doctor:check` scans owned app and package code with React Doctor 0.9.18, the version used
by Compozy. It runs inside `bun run verify` and in the React Doctor workflow. Errors and warnings both block delivery. The vendored BnUI package and shell primitives are
outside this owned-code scan, consistent with their update policy. Prototype `meta` and canvas
exports are exempt only from the Fast Refresh export-shape heuristic because they are public
Proto contracts.

The shell Vite config is `packages/proto/vite.config.ts`, so Doctor detects its compiler setup.
Oxlint enables the React Compiler correctness rules for owned app, shell and render code. Builds
retain `panicThreshold: "all_errors"`. An intentional `Date.now()` render was rejected by both
Oxlint (`react/purity`) and Doctor (`react-hooks-js/purity`) with exit code 1 during validation;
the temporary negative control was removed.

The initial scan also found a login loading flag that did not handle rejected requests and a
composer that stayed busy after a successful submission. Both paths now release their busy
state; the deployed login journey exercises a real offline/reconnect cycle. A retained composer
also releases claimed image previews and starts the next draft without reusing attachment IDs.

## Iframe capability boundary

Every owned iframe now has an explicit sandbox: scripts, real origins, forms, popups, modals and
downloads are allowed for authored prototypes; top navigation is not allowed. A real Chromium
click verifies that a prototype on the separate render origin cannot navigate the gallery.
The source/origin/frame-nonce checks remain unchanged, and role values from context URLs are
confined to the catalog's presentation roles.

There are **three local Doctor exceptions**, each surrounding one literal sandbox attribute
(two package frames and the app draft preview). Doctor 0.9.18 flags the scripts/origin combination
without considering the configured origin or the trust boundary. Dev and remote rendering use
a separate origin. Static builds intentionally contain trusted application code on the same
origin; this sandbox does **not** isolate malicious same-origin code. Removing `allow-same-origin`
would make the document opaque, breaking module loading on ordinary static servers and the
origin-checked protocol. The [HTML iframe standard](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)
describes this same-origin limitation.

The missing-sandbox rule remains enabled elsewhere: a temporary un-sandboxed iframe was rejected
with exit code 1 under the warning-blocking gate, then removed. Remove these local exceptions when the
analyzer supports this explicit trusted-render policy, or when static rendering gains a separate
origin and the rule can recognize it. They must not be copied to untrusted embeds. The reported
zero-warning result includes these exceptions; it is not an independent security approval.

## Regression evidence

The canonical suites own the behavior:

- `test/node/e2e/shell-browse.test.ts`: real Chromium, real consumer Vite, zoom round trip and
  flow/prototype body/metadata edits retain iframe documents; canvas creation/removal updates
  without restart, failed page chunks retry, local writes survive offline events, and sandboxed
  render-origin scripts cannot navigate the shell even after user activation.
- `test/browser/shell/preview-queue.test.ts`: bounded admission/eviction, reuse, source changes,
  settlement notification and rejection of late readiness for an obsolete source.
- `test/browser/shell/review.test.tsx`: intent prefetch and concurrent readers share one HTTP
  request; key-specific invalidation retains cached data and leaves unrelated reads fresh;
  notification bursts share a read and edits arriving during it are reconciled afterward.
- `test/node/registry/registry.test.ts` and `test/node/store/file-store.test.ts`: real filesystem
  snapshot/watch lifetimes, configured prototype globs and directory moves in polling/native watchers, and
  notifications only after a subsequent edit. Dev startup establishes the review baseline before
  accepting HTTP requests or SSE connections.
- `test/node/dev/dev.test.ts`: dev shutdown stops accepting HTTP connections, releases idle
  preconnects and lets accepted review writes return their response. SSE drains on finish or
  disconnect; a stream that stops reading is destroyed after one second. Consumer Vite cleanup
  runs alongside HTTP cleanup, and automatic reconnects cannot keep shutdown open.
- `test/node/e2e/shell-browse.test.ts` and `shell-review.test.ts`: real server restart recovers a
  missed edit; deep links, pins and browser history agree on focused comments.
- `test/node/server/postgres.it.test.ts`: collection query count remains bounded as keys grow,
  collection reads and attachment claims transfer no image bodies (with a positive control that
  detects an attachment read)
  and thread/attachment ownership is preserved.
- `test/browser/render/protocol.test.ts`: replacement components recover failed rendering while
  rerenders of the same component preserve state; context roles are confined to the catalog.
  A picker popover inside the active native modal receives pointer and keyboard input without
  removing the authored modal's focus trap; Escape cancels picking without closing the modal.
  Both `react-dom` entry points are pre-bundled so opening the picker does not trigger a late
  dependency optimization and reload the render document.
- `test/node/concurrency.test.ts`: bounded, ordered work drains on failure before the caller exits
  and reports the lowest failing input index regardless of worker completion order.
- `test/node/migrate/migrate.test.ts`: legacy aliases and v3 keys sharing a destination remain
  ordered, including dry-run conflicts for identical descriptors with different attachment bytes.
  Prefix rewriting never rewrites an existing v3 key.
- `test/browser/shell/render-frame.test.tsx`: clipboard denial remains retryable without false
  success or an unhandled rejection.
- `apps/api/tests/proto.it.test.ts`: real Postgres, Better Auth, built SPA and remote review loop,
  including retrying sign-in after the browser reconnects.

The zoom and edit regressions fail against `b5367df`: zoom removes the iframe, and an edit changes
its document time origin. The same journeys pass on the optimized implementation. The complete
`bun run verify` remains the delivery gate, including database integration suites when
`TEST_DATABASE_URL` points to the local disposable-test database server.
