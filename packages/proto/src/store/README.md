# Review store and router

`FileStore` implements `ReviewStore` from `types.ts`. Construct it with `{ root }` (the app
root); optional `directory` overrides `<root>/proto/review`. Pass `registry` for known-key
validation and spec filtering, and `roots` for configured source confinement. `clock` and
`lockEnvironment` are I/O seams used by the filesystem tests.

The v3 JSON rename is the commit point for comments, sequence, approval and attachment claims.
Pending image bytes are copied before publication and pending metadata is removed afterwards.
A crash before publication leaves the upload claimable; after publication the JSON prevents a
second claim even if pending cleanup was interrupted. Detached/deleted image bytes are removed
after the JSON commit. Empty key files retain the sequence. Readers accept v1 and v2; writers
publish v3 only. Explicit migration remains responsible for moving legacy attachment bytes.

Locks are single-host. The machine identity comes from machine-id (Linux), IOPlatformUUID
(macOS), or MachineGuid (Windows). Process start identity comes from procfs start ticks, ps
lstart, or Windows StartTime. Unknown liveness/start time never proves death. A missing or
malformed owner also fails closed; `unlock(key, { force: true })` is explicit recovery. Known
live local owners cannot be force-evicted. Contention uses asynchronous waits bounded at five
seconds. Takeovers recheck the observed dead owner's token under the short takeover directory.

## Host integration

```ts
import { FileStore, currentCommit } from "./index.ts";
import { createReviewRouter, createDevAuthorizer, ReviewEvents } from "../review/index.ts";

const store = new FileStore({ root: appRoot, registry });
const events = new ReviewEvents();
const stop = await store.subscribe(event => events.publish(event));
const fetch = createReviewRouter({
  store,
  registry,
  events,
  authorize: createDevAuthorizer({ shellOrigin, allowedHosts }),
  roots,
  commit: () => currentCommit(appRoot),
});
// Mount fetch(Request) and call stop() when the host closes.
// Registry changes: events.publish({ type: "registry" }).
```

The router defaults to `/__proto/api`; remote hosts pass `basePath` for their API mount.
`ReviewAuthorizer(request, operation)` returns `{ author }` or a `Response`. It must enforce
its host's authorization matrix before returning an author. Operations are `read`, `comment`,
`edit`, `delete`, and `review`. Remote hosts derive the author from session/bearer principals;
no request-body author field is trusted. Ownership uses stable owner ids when present, and
local author kinds otherwise. `FileStore` deliberately does not enforce remote scopes.

`ReviewEvents.subscribe(listener)` returns an unsubscribe function. `publish` fans out typed
`comments`, `review`, or `registry` notifications; `response(signal)` serves SSE. The router
publishes its own successful mutations immediately. `FileStore.subscribe` polls published key
files every 250 ms to include CLI/other-process writes, ignores lock/tmp/pending files, and
returns a stop function. Consumers should treat events as invalidations; duplicate notifications
are permitted. The surrounding dev host still applies its Host allowlist to non-API routes.

`upgradeReviewFile(value, options)` (alias `readReviewFile`) is a pure total reader returning
`{ ok: true, file, rewrites }` or `{ ok: false, issues }`. Options: `appPrefix`, `flowPrefix`,
`themeMap`, `roleMap`. Unknown fields at any depth are retained under `file.extra.legacyUnknown`
using JSON-pointer keys. Existing `extra` fields remain intact. Missing v1 message defaults
never overwrite populated values. v3 input does not repeat migration rewrites.

## Verification ownership

- `test/node/store/contract.ts`: `runStoreContract(makeStore)` takes an async factory returning
  `{ store: ReviewStore, dispose(): Promise<void> }`. Each case gets a fresh store. The fixture
  registry must include `login-form` and `flow-sign-in`, both with spec `auth`.
- `file-store.test.ts`: real filesystem, git HEAD, lock liveness, interrupted publication,
  expiry and 20 independent Node writers. SIGSTOP/SIGCONT checks require a POSIX host; all
  process checks need permission to inspect OS processes.
- `model/upgrade.test.ts`: real legacy fixture preservation and explicit synthetic edge cases.
- `router/router.test.ts`: actual fetch router plus FileStore, SSE, multipart, source confinement,
  origin/Host rules and cross-process auto-reopen.

The shared error registry adds `invalid_input` (400), `review_has_open_comments` (409), and
`internal_error` (500): validation, unconfirmed approval and unexpected I/O failures were not
represented in the initial registry. Internal errors do not expose file paths or bodies.
