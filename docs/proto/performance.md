# Gallery performance and React checks

The shell keeps server data in TanStack Query and preview admission in XState Store. Each shell
owns its cache and grid scheduler; each flow canvas owns a separate scheduler. Local component
state stays in React when it does not need cross-component subscriptions.

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
to every iframe. The Vite and registry watchers use the same polling fallback on macOS; other
platforms can opt into polling with `dev.poll`.

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

Hover, keyboard focus and touch intent prefetch the destination's canonical review queries. Flow
and settings code are separate chunks, loaded on intent or when visited. Existing query-string
URLs and browser history continue to use the shell's navigation contract.

The production shell was compared with `b5367df` using the same Node `gzipSync` defaults for
each emitted asset. Initial JavaScript includes the entry and every module preload in
`dist/shell/index.html`; total assets include all JavaScript and CSS chunks, excluding fonts.

| Compressed bytes       |  Before |   After | Change |
| ---------------------- | ------: | ------: | -----: |
| Initial JavaScript     | 337,000 | 279,356 | -17.1% |
| All JavaScript and CSS | 354,230 | 378,327 |  +6.8% |

The cache libraries add code to the complete distribution; deferred flow and settings chunks
reduce the initial load. These are transfer-size measurements, not a latency benchmark. The
complete compressed shell remains below its existing 400 KiB build budget.

## React Compiler and Doctor

`bun run doctor:check` scans owned app and package code with React Doctor 0.9.18, the version used
by Compozy. It runs inside `bun run verify` and in the React Doctor workflow. Errors block delivery;
warning diagnostics remain visible for review. The vendored BnUI package and shell primitives are
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

## Regression evidence

The canonical suites own the behavior:

- `test/node/e2e/shell-browse.test.ts`: real Chromium, real consumer Vite, zoom round trip and
  flow/prototype body/metadata edits retain iframe documents without navigation requests.
- `test/browser/shell/preview-queue.test.ts`: bounded admission/eviction, reuse, source changes,
  settlement notification and rejection of late readiness for an obsolete source.
- `test/browser/shell/review.test.tsx`: intent prefetch and concurrent readers share one HTTP
  request; key-specific invalidation retains cached data and leaves unrelated reads fresh.
- `apps/api/tests/proto.it.test.ts`: real Postgres, Better Auth, built SPA and remote review loop,
  including retrying sign-in after the browser reconnects.

The zoom and edit regressions fail against `b5367df`: zoom removes the iframe, and an edit changes
its document time origin. The same journeys pass on the optimized implementation. The complete
`bun run verify` remains the delivery gate, including database integration suites when
`TEST_DATABASE_URL` points to the local disposable-test database server.
