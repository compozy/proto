# Architectural and performance audit of the Proto gallery

Date: 2026-11-01, America/Sao_Paulo. Baseline: `a1ac904` (the first performance delivery),
with bundle comparison also retained against `b5367df` (main before that delivery).

## Scope and evidence boundary

The first delivery fixed preview churn and initial loading, but its green tests did not justify
an exhaustive architectural conclusion. This follow-up traces registry discovery/watchers,
Vite HMR, iframe admission and messages, comment state, query invalidation and reconnects,
search/inbox derivations, graph traversal, FileStore notifications, and PostgreSQL collections.
It also classifies **every one of the 82 baseline React Doctor warnings** below.

Doctor analyzed 218 files in the baseline (36 app, 182 package). This is tool coverage, not a
claim that every line received manual review. Manual inspection followed the paths in the
findings and diagnostic dispositions. Public Node/CLI/server entries and their canonical
contract, integration, browser and tarball suites supply compatibility evidence.

Not exhaustively inspected: vendored BnUI internals, database administration, production traffic,
a security threat model, migration throughput at production volume, and every possible consumer
configuration. No production data or service was modified. Browser samples use generated local
projects; database tests create and drop their own databases on local Postgres.

## Findings and disposition

| ID   | Finding and evidence                                                                                                                                                                                      | Change / validation                                                                                                                                                                                                                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | `src/node/project.ts`: each registry read rediscovered and parsed all files; each subscriber owned a poller. Ten reads of 120 prototypes repeatedly cost about 8–13 ms after the first.                   | One observer and cached snapshot while watched. Changes invalidate it; the last unsubscribe releases it. CLI reads without a watcher remain fresh. The real filesystem test checks shared snapshots, change/add/delete, subscriber lifetimes, and diagnostics for misplaced flows.                  |
| A-02 | `src/store/file-store.ts`: an empty initial fingerprint treated all preexisting reviews as changes.                                                                                                       | Establish a baseline before polling. Regression failed with two initial events and now sees only subsequent changes.                                                                                                                                                                                |
| A-03 | `src/shell/lib/shell-data.tsx`: EventSource reconnect had no replay or reconciliation; infinitely fresh registry data could stay stale after downtime.                                                    | Reconcile all observed slices after an interrupted connection. Real server-stop/edit/restart journey fails before and passes after. Initial open does not duplicate reads.                                                                                                                          |
| A-04 | `src/shell/review/queries.ts`: paired events and mutation settlement canceled/restarted the same active query. Three notifications caused three additional HTTP reads.                                    | A provider-owned 50 ms batch unions affected keys; subsequent batches wait for the preceding read. The HTTP-boundary test proves one read for the burst and a fresh result for an edit arriving during that read.                                                                                   |
| A-05 | Comment focus had two authorities: URL and provider state. A direct link opened a thread but left its pin unselected; provider focus could outlive navigation.                                            | The URL owns focus. Remove the redundant focus context/bridge and thread merge hook. The real journey covers direct links, pin toggles, another prototype and browser back. Its fixture is isolated from other review numbering.                                                                    |
| A-06 | Comment-mode context broadcast tool/focus updates, while a module-global listener set relayed messages across frame lifetimes.                                                                            | XState Store owns the scoped tool state and tool consumers select it. Each frame exposes its own validated message subscription. Existing cross-origin, stale-nonce, picking, anchor and forged-result browser suites pass.                                                                         |
| A-07 | Screen pins requested both open and all comments while threads observed all comments separately.                                                                                                          | Pins derive open comments from the same all-comments query. One cache entry owns the key's thread list.                                                                                                                                                                                             |
| A-08 | `Browse` built all registry/comment search items and subscribed to comment changes while the palette was closed.                                                                                          | Build and subscribe inside the mounted search palette. Search ranking and the real search journey remain covered.                                                                                                                                                                                   |
| A-09 | `src/server/postgres.ts`: list used one complete read transaction per key and selected attachment bytea bodies merely to render metadata. With 2 then 12 keys, the observed SQL count grew from 15 to 89. | Read the collection in one repeatable-read transaction, fetch only image descriptors, and group rows once by key/comment/message. The real Postgres regression asserts bounded query growth, zero transferred attachment bytes, and correct thread/image association; the full SQL contract passes. |
| A-10 | BFS numbering and flow layout scanned every edge for every visited node; layout also shifted its queue and copied column arrays.                                                                          | Share a small ordered adjacency index; use a queue cursor and append to column groups. Existing flow numbering/discovery and real canvas journeys preserve behavior. The isolated 10,000-node CPU workload drops median BFS from 320.65 ms to 0.78 ms and layout from 261.00 ms to 2.70 ms.         |
| A-11 | Inbox looked up each comment's prototype/flow repeatedly and searched accumulated groups linearly.                                                                                                        | Index registry descriptors and groups once; describe each comment once. Existing real inbox, author reply and flow-context journeys validate navigation and grouping.                                                                                                                               |
| A-12 | Clipboard rejection was unhandled in five controls. The draft modal lacked an accessible name.                                                                                                            | One clipboard boundary catches denied/unavailable access; retry coverage checks no false success and subsequent success. Require a name in the draft modal and provide both labels.                                                                                                                 |

Paths above are relative to `packages/proto/` unless otherwise stated. The draft modal is under
`apps/app/src/drafts/proto-shell/`.

## Measurements and limits

Raw samples and runtime versions: [`performance-samples.json`](../docs/proto/performance-samples.json).
Reproduce after `bun run --cwd packages/proto build:shell`:

```sh
cd packages/proto
bun run scripts/benchmark-gallery.ts 120 flat
bun run scripts/benchmark-gallery.ts 120 reviews
bun run scripts/benchmark-graph.ts
```

The graph benchmark runs one warmup and five samples per size. The gallery benchmark opens a
real Vite consumer in Chromium, scrolls away/back and searches. It generates and removes its own
files. The reviews workload adds ten specs and one comment per prototype. Browser timing is a
single illustrative sample, varies with compilation/cache/system load, and is **not** a claim of
lower end-to-end latency: the final flat sample was slower than the first baseline sample.

| Observable                                           | Baseline                                      | Expanded implementation                            |
| ---------------------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Repeated watched registry reads, 120 prototypes      | Reparse each time; warm samples 8.10–12.75 ms | Same snapshot; warm samples under 0.005 ms         |
| Three nearby review invalidations                    | Three new HTTP reads                          | One read, with later edits queued for another read |
| Collection read, 2 → 12 review keys                  | 15 → 89 SQL statements                        | Query count remains bounded; no attachment bodies  |
| BFS, 10,000-node chain, median of five               | 320.65 ms                                     | 0.78 ms                                            |
| Layout, same chain, median of five                   | 261.00 ms                                     | 2.70 ms                                            |
| Flat gallery, 120 prototypes after scroll round trip | 12 retained frames                            | 12 retained frames                                 |
| Initial JS gzip, versus original main                | 337,000 bytes                                 | 280,590 bytes (-16.7%)                             |
| Total JS + CSS gzip, versus original main            | 354,230 bytes                                 | 379,518 bytes (+7.1%)                              |

The initial transfer improvement comes from the earlier lazy-route change. The total package is
larger because of the cache/store libraries, still below the existing 400 KiB shell budget. These
numbers are Node gzip defaults and exclude fonts; they do not measure network or interaction latency.

Known limits retained explicitly:

- Spec status still uses the existing per-key endpoint. The 120-prototype reviews workload made
  121 review-state requests, one registry request, one event connection and one all-comments read.
  Query deduplication removes overlapping consumers, not this cold per-key fan-out. A bulk status
  contract or viewport deferral is a separate public/interaction change; this audit does not claim
  that the current protocol is constant-request at arbitrary gallery size.
- The polling bridge can send another invalidation after an HTTP-originated mutation; without
  revision identifiers it cannot safely distinguish that notification from an external CLI edit.
  Batching removes nearby duplicates while preserving later invalidations.
- Comment collections and DOM lists remain proportional to history/gallery size. No pagination
  or list virtualization was added without a measured product workload and navigation contract.
- Sequential FileStore list/stat scans and migration verification are recorded below; local
  samples do not establish their throughput on slow mounted filesystems or production datasets.

## Architecture, dead code and types

The shell still imports model code and its vendored UI, not Node/storage implementations.
Server data belongs to Query; tool/preview admission belongs to surface-owned XState stores;
URL-addressable focus belongs to navigation. Local drafts and transient controls remain React state.

Removed dead responsibilities: the module-global frame listener bus, its routing export, the
comment-focus context/bridge, and the hook merging competing focus values. The search action
builder is private to the palette. No published export was removed based on repository-only usage.

`PostgresStore` retains its existing dynamic SQL-row type, followed by `reviewFileSchema.parse`.
This is an explicit boundary, not proof of end-to-end static SQL typing. Migration row conversion
and public generated contracts were not rewritten as speculative type cleanup. No new dependency,
public endpoint, schema migration, or generic state/cache framework was introduced in this follow-up.

## React Doctor disposition ledger

The locations below refer to the **baseline `a1ac904`**, so they remain stable even when edits move
lines. All 82 warnings are enumerated; repeated warnings on the same location are distinct rules.
The follow-up at `af373af` still had 78 warnings. Retaining those diagnostics was not a completed
repair; the dispositions below now describe the implementation changes. The current complete
scan covers **223 files (36 app, 187 package), with 0 errors and 0 reported warnings**. Warning
severity now fails both the local gate and CI. Three literal iframe sandbox attributes have
local exceptions for the required scripts/origin combination; these are explicit policy
exceptions, not a claim that the scanner independently approves that combination. Their
compatibility boundary and removal condition are documented in `docs/proto/performance.md`.
The mutation cache operation is now named `invalidateReview`, accurately exposing its batched
invalidation behavior to callers and analysis without removing batching or adding duplicate reads.

- Independent FileStore, export and migration I/O uses a four-worker executor. It preserves
  result order, stops scheduling on failure, and drains started work before a key lock is released.
  Migration aliases sharing a destination remain serialized in source order; reports retain
  deterministic ordering. Verification still precedes publication and follows it.
- PostgreSQL saves batch comments, messages, attachment links and events by relation, preserving
  foreign-key order and transaction rollback. Claims check ownership and expiry before one
  conditional update; attachment order is restored from the requested IDs.
- Independent relation reads share their existing repeatable-read transaction. Overlapping
  promises do not imply parallel execution on a single PostgreSQL connection.
- The previous URL-parse disposition missed `PROTO_REMOTE_URL`, which bypassed configuration
  validation. The URL builder now validates it and reports `invalid_config`; the canonical
  transport suite exercises that environment override.

| ID     | Baseline location                                                  | Rule                                     | Disposition and reason                                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RD-001 | `apps/app/src/drafts/proto-shell/index.proto.tsx:70`               | `no-high-complexity-react-function`      | Fixed. Extracted independent canvas variants, toolbar/geometry composition, inspector tab state, coverage derivation, pin/feedback rendering and thread status controls; render-host loading and error presentation have distinct owners.           |
| RD-002 | `apps/app/src/drafts/proto-shell/index.proto.tsx:149`              | `no-high-complexity-react-function`      | Fixed. Extracted independent canvas variants, toolbar/geometry composition, inspector tab state, coverage derivation, pin/feedback rendering and thread status controls; render-host loading and error presentation have distinct owners.           |
| RD-003 | `apps/app/src/drafts/proto-shell/preview.tsx:64`                   | `iframe-missing-sandbox`                 | Sandbox added. Explicit capabilities preserve executable authored prototypes; top navigation is blocked on the separate render origin. Local exceptions retain the required scripts/origin combination; see the documented trusted-static boundary. |
| RD-004 | `apps/app/src/drafts/proto-shell/shell.tsx:290`                    | `dialog-has-accessible-name`             | Fixed. Draft ShellModal now requires a label; both callers provide it.                                                                                                                                                                              |
| RD-005 | `apps/app/src/drafts/proto-shell/shell.tsx:291`                    | `prefer-html-dialog`                     | Fixed. The draft uses showModal on a native dialog; the flow composer uses a nonmodal native dialog.                                                                                                                                                |
| RD-006 | `packages/proto/scripts/build.mjs:14`                              | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-007 | `packages/proto/scripts/build.mjs:66`                              | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-008 | `packages/proto/scripts/check-size.mjs:10`                         | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-009 | `packages/proto/src/capabilities/catalog.ts:291`                   | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-010 | `packages/proto/src/migrate/index.ts:258`                          | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-011 | `packages/proto/src/migrate/index.ts:297`                          | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-012 | `packages/proto/src/migrate/index.ts:314`                          | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-013 | `packages/proto/src/migrate/index.ts:328`                          | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-014 | `packages/proto/src/migrate/remote.ts:22`                          | `js-set-map-lookups`                     | Fixed. JPEG markers, mapped migration columns and detached attachment IDs use sets.                                                                                                                                                                 |
| RD-015 | `packages/proto/src/migrate/remote.ts:163`                         | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-016 | `packages/proto/src/migrate/remote.ts:313`                         | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-017 | `packages/proto/src/migrate/remote.ts:323`                         | `no-json-parse-stringify-clone`          | Fixed. Metadata verification compares canonical JSON strings, preserving JSONB Date/Buffer normalization and object-key independence without a serialize/parse clone.                                                                               |
| RD-018 | `packages/proto/src/migrate/remote.ts:384`                         | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-019 | `packages/proto/src/model/protocol.ts:138`                         | `url-prefilled-privileged-action`        | Fixed. Render-reported preview roles are validated against catalog roles before URL adoption. Preview roles never grant session permissions.                                                                                                        |
| RD-020 | `packages/proto/src/node/image.ts:30`                              | `js-set-map-lookups`                     | Fixed. JPEG markers, mapped migration columns and detached attachment IDs use sets.                                                                                                                                                                 |
| RD-021 | `packages/proto/src/node/project.ts:190`                           | `no-unguarded-throwing-parse-call`       | Fixed. URL.canParse validates remote environment overrides and returns the public invalid_config error instead of a raw URL exception.                                                                                                              |
| RD-022 | `packages/proto/src/render/host.tsx:42`                            | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-023 | `packages/proto/src/render/host.tsx:56`                            | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-024 | `packages/proto/src/render/host.tsx:64`                            | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-025 | `packages/proto/src/render/host.tsx:73`                            | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-026 | `packages/proto/src/render/host.tsx:181`                           | `no-high-complexity-react-function`      | Fixed. Extracted independent canvas variants, toolbar/geometry composition, inspector tab state, coverage derivation, pin/feedback rendering and thread status controls; render-host loading and error presentation have distinct owners.           |
| RD-027 | `packages/proto/src/render/theme.tsx:27`                           | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-028 | `packages/proto/src/server/postgres.ts:87`                         | `server-sequential-independent-await`    | Fixed. Independent relation reads are grouped within the existing transaction, and lock host/process identity lookups overlap after directory setup.                                                                                                |
| RD-029 | `packages/proto/src/server/postgres.ts:90`                         | `server-sequential-independent-await`    | Fixed. Independent relation reads are grouped within the existing transaction, and lock host/process identity lookups overlap after directory setup.                                                                                                |
| RD-030 | `packages/proto/src/server/postgres.ts:160`                        | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-031 | `packages/proto/src/server/postgres.ts:163`                        | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-032 | `packages/proto/src/server/postgres.ts:167`                        | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-033 | `packages/proto/src/server/postgres.ts:176`                        | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-034 | `packages/proto/src/server/postgres.ts:195`                        | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-035 | `packages/proto/src/server/postgres.ts:205`                        | `js-index-maps`                          | Fixed. Import payloads and edited-message attachment ownership use indexes built once before lookup.                                                                                                                                                |
| RD-036 | `packages/proto/src/server/postgres.ts:208`                        | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-037 | `packages/proto/src/server/postgres.ts:239`                        | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-038 | `packages/proto/src/shell/app/cards.tsx:196`                       | `no-floating-then-in-jsx-handler`        | Fixed. Shared copyText handles denied/unavailable clipboard and preserves retry; all five equivalent controls use it.                                                                                                                               |
| RD-039 | `packages/proto/src/shell/app/chrome.tsx:153`                      | `no-array-index-as-key`                  | Fixed. Breadcrumbs and diagnostics use their semantic target/content identity instead of their current list position.                                                                                                                               |
| RD-040 | `packages/proto/src/shell/app/chrome.tsx:416`                      | `no-static-element-interactions`         | Fixed. The modal backdrop is a native close button; dialog Escape handling and focus restoration remain intact.                                                                                                                                     |
| RD-041 | `packages/proto/src/shell/app/search-palette.tsx:37`               | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-042 | `packages/proto/src/shell/flow/flow-canvas.tsx:53`                 | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-043 | `packages/proto/src/shell/flow/flow-canvas.tsx:62`                 | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-044 | `packages/proto/src/shell/flow/flow-canvas.tsx:71`                 | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-045 | `packages/proto/src/shell/flow/flow-canvas.tsx:484`                | `no-array-index-as-key`                  | Fixed. Breadcrumbs and diagnostics use their semantic target/content identity instead of their current list position.                                                                                                                               |
| RD-046 | `packages/proto/src/shell/flow/flow-page.tsx:38`                   | `no-high-complexity-react-function`      | Fixed. Extracted independent canvas variants, toolbar/geometry composition, inspector tab state, coverage derivation, pin/feedback rendering and thread status controls; render-host loading and error presentation have distinct owners.           |
| RD-047 | `packages/proto/src/shell/frames/preview.tsx:112`                  | `iframe-missing-sandbox`                 | Sandbox added. Explicit capabilities preserve executable authored prototypes; top navigation is blocked on the separate render origin. Local exceptions retain the required scripts/origin combination; see the documented trusted-static boundary. |
| RD-048 | `packages/proto/src/shell/frames/screen-frame.tsx:59`              | `no-pass-data-to-parent`                 | Fixed. ScreenFrame renders the viewport toolbar with its measured geometry; no Effect copies geometry into parent state.                                                                                                                            |
| RD-049 | `packages/proto/src/shell/frames/screen-frame.tsx:73`              | `iframe-missing-sandbox`                 | Sandbox added. Explicit capabilities preserve executable authored prototypes; top navigation is blocked on the separate render origin. Local exceptions retain the required scripts/origin combination; see the documented trusted-static boundary. |
| RD-050 | `packages/proto/src/shell/lib/i18n.tsx:15`                         | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-051 | `packages/proto/src/shell/lib/shell-data.tsx:34`                   | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-052 | `packages/proto/src/shell/lib/shell-data.tsx:55`                   | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-053 | `packages/proto/src/shell/lib/shell-data.tsx:75`                   | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-054 | `packages/proto/src/shell/lib/shell-data.tsx:125`                  | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-055 | `packages/proto/src/shell/lib/shell-data.tsx:133`                  | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-056 | `packages/proto/src/shell/pages/health.tsx:44`                     | `no-array-index-as-key`                  | Fixed. Breadcrumbs and diagnostics use their semantic target/content identity instead of their current list position.                                                                                                                               |
| RD-057 | `packages/proto/src/shell/review/approval/approval.tsx:21`         | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-058 | `packages/proto/src/shell/review/auth/auth.tsx:18`                 | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-059 | `packages/proto/src/shell/review/auth/auth.tsx:43`                 | `anchor-has-content`                     | Fixed. Sign-in anchors carry explicit accessible names, including through the Base UI render prop.                                                                                                                                                  |
| RD-060 | `packages/proto/src/shell/review/auth/auth.tsx:81`                 | `anchor-has-content`                     | Fixed. Sign-in anchors carry explicit accessible names, including through the Base UI render prop.                                                                                                                                                  |
| RD-061 | `packages/proto/src/shell/review/comment-mode/screen-layer.tsx:40` | `no-high-complexity-react-function`      | Fixed. Extracted independent canvas variants, toolbar/geometry composition, inspector tab state, coverage derivation, pin/feedback rendering and thread status controls; render-host loading and error presentation have distinct owners.           |
| RD-062 | `packages/proto/src/shell/review/comment-mode/state.tsx:59`        | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-063 | `packages/proto/src/shell/review/comment-mode/state.tsx:66`        | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-064 | `packages/proto/src/shell/review/comment-mode/tools.tsx:126`       | `prefer-html-dialog`                     | Fixed. The draft uses showModal on a native dialog; the flow composer uses a nonmodal native dialog.                                                                                                                                                |
| RD-065 | `packages/proto/src/shell/review/data.tsx:34`                      | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-066 | `packages/proto/src/shell/review/data.tsx:74`                      | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-067 | `packages/proto/src/shell/review/inbox/inbox.tsx:41`               | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-068 | `packages/proto/src/shell/review/review-ui.tsx:26`                 | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-069 | `packages/proto/src/shell/review/review-ui.tsx:48`                 | `only-export-components`                 | Fixed. Implementation-only helpers are private; shared URL, registry and comment navigation helpers live in their existing pure modules. Consumers use bootstrap/review-slot hooks.                                                                 |
| RD-070 | `packages/proto/src/shell/review/threads/thread-card.tsx:271`      | `click-events-have-key-events`           | Fixed. A visible native Open thread button owns activation; the article has no click handler.                                                                                                                                                       |
| RD-071 | `packages/proto/src/shell/review/threads/thread-card.tsx:271`      | `no-noninteractive-element-interactions` | Fixed. A visible native Open thread button owns activation; the article has no click handler.                                                                                                                                                       |
| RD-072 | `packages/proto/src/shell/review/threads/threads-panel.tsx:41`     | `no-high-complexity-react-function`      | Fixed. Extracted independent canvas variants, toolbar/geometry composition, inspector tab state, coverage derivation, pin/feedback rendering and thread status controls; render-host loading and error presentation have distinct owners.           |
| RD-073 | `packages/proto/src/shell/screen/screen-page.tsx:45`               | `no-high-complexity-react-function`      | Fixed. Extracted independent canvas variants, toolbar/geometry composition, inspector tab state, coverage derivation, pin/feedback rendering and thread status controls; render-host loading and error presentation have distinct owners.           |
| RD-074 | `packages/proto/src/store/engine.ts:139`                           | `js-index-maps`                          | Fixed. Import payloads and edited-message attachment ownership use indexes built once before lookup.                                                                                                                                                |
| RD-075 | `packages/proto/src/store/engine.ts:146`                           | `js-set-map-lookups`                     | Fixed. JPEG markers, mapped migration columns and detached attachment IDs use sets.                                                                                                                                                                 |
| RD-076 | `packages/proto/src/store/file-store.ts:111`                       | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-077 | `packages/proto/src/store/file-store.ts:116`                       | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-078 | `packages/proto/src/store/file-store.ts:172`                       | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-079 | `packages/proto/src/store/file-store.ts:201`                       | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-080 | `packages/proto/src/store/file-store.ts:259`                       | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-081 | `packages/proto/src/store/file-store.ts:378`                       | `async-await-in-loop`                    | Fixed. Finite build work is concurrent; independent file/export/migration I/O uses bounded workers that drain on failure. SQL writes are batched by relation; same-destination migrations remain ordered.                                           |
| RD-082 | `packages/proto/src/store/lock.ts:180`                             | `server-sequential-independent-await`    | Fixed. Independent relation reads are grouped within the existing transaction, and lock host/process identity lookups overlap after directory setup.                                                                                                |

## Validation receipts

Historical validation at `af373af`: `bun run verify` with local `TEST_DATABASE_URL` passed all 13 tasks without cache (267 package, 28 app, 5 API and 1 DB tests). `bun run --cwd packages/proto test:tarball` passed all 8 fresh-consumer tests. Final CI results and the exact PR head are recorded in the PR description. The first full follow-up
gate exposed fixture interference in the new focus test (it advanced a shared comment sequence);
the new test now owns an isolated temporary gallery. Existing assertions were preserved. Diff review also caught a polling scope regression for misplaced flows; its added case failed before the production fix and passed afterward.

## Review follow-up

CodeRabbit review `af373af` posted eight comments. The implementation now pins both workflow
actions to verified commit SHAs, resets failed render boundaries on component replacement,
handles rejected lazy page imports with a real reload retry, executes local queries/mutations
through offline browser events, preserves the first duplicate-slug descriptor, and refreshes
the virtual canvas when the file appears or disappears. The clipboard regression awaits the
failed operation, and the PostgreSQL byte counter has a positive control. Exact comment IDs,
final test receipts and the reviewed head are recorded on PR #16. Greptile is outside the
completion criterion, as corrected by the user.

Validation at `c2d57ed`: `bun run verify` passed all 13 tasks without cache (274 package,
28 app, 5 API and 1 DB tests: 308 total), using local PostgreSQL and real Chromium.
The canonical HMR journey also preserves state in the unchanged Canvas through prototype
replacement; the boundary clears its failure without remounting that Canvas. The protocol suite
separately verifies recovery from a throwing component and state retention for same-component
rerenders. A temporary un-sandboxed iframe failed the warning-blocking Doctor gate (exit 1),
then was removed. `test:tarball` passed all 8 fresh-consumer tests after the final package build.
The exact reviewed commit and CI receipts remain in PR #16.

The subsequent CodeRabbit review of `c2d57ed` reported six inline findings and one outside the
diff. Native modal picking now uses an interactive descendant popover and has a Chromium
regression that failed before the fix. Migration grouping and upgrading share the version-aware
destination key, and dry runs detect conflicting aliases. Bounded I/O reports the first failing
input after draining all started operations. Attachment claims select only ownership/descriptor
columns. Dev startup captures the file-store baseline before listening, and native registry
watchers use the same configured patterns as polling and discovery. Canonical suites cover
modal input, migration conflicts, concurrent failures, attachment bytes and custom glob updates.

The suggestion to weaken the full Doctor scan to `blocking: error` or `none` is not applicable:
the baseline is clean and warning regressions must fail on PRs and main. The workflow documents
this intent; the review thread links the successful full-scan CI receipt. Greptile remains excluded.

Second-review validation: `bun run verify` passed all 13 tasks without cache (278 package,
28 app, 5 API and 1 DB tests: 312 total), with real PostgreSQL and Chromium. The full Doctor
scan reported zero errors and zero warnings across 223 files, including the three documented
local iframe exceptions. A fresh tarball consumer passed all 8 tests after this package build.

The complete CodeRabbit walkthrough also reported 38.24% docstring coverage against its 80%
minimum. Function-level contracts now document the touched operations and state owners,
including migration ordering, query consistency, frame trust and error recovery. Comparing the
TypeScript syntax trees before and after this documentation pass confirmed no executable changes.
The subsequent review and its documentation-check result remain recorded on PR #16.

The documentation candidate passed `bun run verify --concurrency=2` with
`VITEST_MAX_WORKERS=2`, real PostgreSQL/Chromium, all 13 tasks uncached and the same 312 tests.
An earlier run during concurrent workstation test activity timed out in the existing registry
check and Chromium teardown; its failed receipt is retained separately. No assertion, test
timeout or repository configuration was changed to obtain the passing run.

CI on `d935b0b` exposed a separate shutdown race in the real reconnect journey: closing SSE
before stopping HTTP admission allowed a reconnect while Vite cleanup was still running. The
dev host now stops HTTP admission first, flushes SSE and closes remaining HTTP connections
alongside Vite, including startup failure cleanup. The existing dev lifecycle suite reproduces the defect with a real consumer
cleanup barrier: the old host accepted a new SSE connection during shutdown, while the fixed
host refuses it and releases idle preconnects. Tracing isolated the remaining wait to HTTP
connections after Vite had already closed; the unchanged browser reconnect test now passes.
Its original assertions and timeout remain unchanged.

Shutdown repair validation: all 13 verification tasks passed uncached with real PostgreSQL and
Chromium (279 package, 28 app, 5 API and 1 DB tests: 313 total), using the same reduced local
concurrency as above. Doctor still reports no errors or warnings. The final rebuilt package
also passed all 8 fresh-consumer tarball tests.

The CodeRabbit review of `29610dc` passed docstring coverage at 98.11% (80% required)
and reported four additional findings. Dry-run migration now compares attachment hashes for
colliding destination keys, including an equal-byte positive control. Native registry watching
invalidates directory moves/removals using the previous snapshot and discovers newly added
authored directories. The canonical lifecycle regression fails against the old watcher on Linux
when a directory leaves the app, and passes with the correction.

Shutdown now drains accepted HTTP requests instead of destroying their connections. It tracks
unclaimed TCP preconnects separately from active requests. SSE completion observes both finish
and close, clears its deadline on completion, and destroys only stalled SSE streams after one
second. Real regressions reproduce an accepted write losing its response and a non-reading SSE
client blocking shutdown before the fixes; the corrected host returns 201 and persists the write.
The new SSE cases use independent consumer fixtures; their first shared-app setup exposed Vite
dependency-cache writes racing fixture removal, without changing the transport assertions.

The three owning local suites pass all 32 tests. Linux validation uses an isolated container
with a real native watcher; its minimal OS initially lacked `/etc/machine-id`, so a normal dbus
machine identity was initialized before validating real FileStore writes. No source fallback
or test assertion was added to bypass that environment prerequisite. Final full-gate receipts
and the exact reviewed head remain on PR #16.

The full gate then exposed a late Vite dependency optimization during E2E-007: the new picker
portal imports `react-dom`, but only `react-dom/client` was pre-bundled. The render document
reloaded during comment selection and the existing composer assertion timed out. The render
plugin and its browser harness now include both entry points. The original comment journey
and its timeout are unchanged; this repairs the dependency setup rather than retrying a lost pick.

Third-review validation passed all 13 tasks uncached with real PostgreSQL and Chromium:
283 package, 28 app, 5 API and 1 DB tests (317 total). The full React Doctor scan still reports
zero errors and zero warnings with the same three documented iframe exceptions. The original
comment journey passes after the pre-bundling repair, without changing its assertions or timeout.

An additional CodeRabbit CLI review of `199af66` found one minor lifecycle gap: an accepted
HTTP upload could outlive shutdown indefinitely from the caller's perspective. The same canonical
dev suite now accepts an upload with HTTP 100 Continue and leaves its body unfinished. It failed
before the fix. Shutdown gives HTTP requests ten seconds to finish, then closes remaining
connections; the deadline is cleared on completion or failure and applies to startup-failure
cleanup too. The earlier accepted-write case still verifies a 201 response and exactly one write
within the grace period. SSE keeps its independent one-second drain deadline.

CLI follow-up validation passed all 13 verification tasks uncached with real PostgreSQL and
Chromium (284 package, 28 app, 5 API and 1 DB tests: 318 total). The rebuilt package passed
all 8 fresh-consumer tests, and React Doctor still reports no errors or warnings.
