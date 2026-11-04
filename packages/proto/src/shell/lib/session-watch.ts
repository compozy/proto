/**
 * The served version and session of a share (`_uiux.md` S1, S4). Active only when the
 * bootstrap carries a `snapshot` id; ordinary galleries never leave `live`. The captured id is
 * the version on screen and is never replaced: a refetched bootstrap is read only to compare.
 *
 * - `compare()`: a `snapshot` event, a stream reconnect or a frame load failure. A different
 *   live id makes the watch `stale` (S1). A failed read changes nothing.
 * - `failure()`: a network failure on an API call or a stream that cannot reconnect. The
 *   bootstrap is retried; when that also fails the session `ended` (S4). A passing failure
 *   keeps today's behavior.
 * - `stale()`: the server refused an approval as `snapshot_stale`.
 *
 * Statuses only move forward: `live` → `stale` → `ended`; both notices are persistent.
 */
export type SessionStatus = "live" | "stale" | "ended";

const rank: Record<SessionStatus, number> = { live: 0, stale: 1, ended: 2 };

export class SessionWatch {
  /** The id this page loaded, or null outside a share. */
  readonly snapshot: string | null;
  #status: SessionStatus = "live";
  #listeners = new Set<() => void>();
  #read: () => Promise<string | null>;
  #pending: Promise<string | null> | null = null;

  /** `read` fetches the live bootstrap and resolves its `snapshot`; it rejects on any failure. */
  constructor(snapshot: string | null | undefined, read: () => Promise<string | null>) {
    this.snapshot = snapshot ?? null;
    this.#read = read;
  }

  get status() {
    return this.#status;
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Compare the live bootstrap with the captured id. */
  compare = () => {
    if (!this.snapshot) return;
    this.#once().then(
      id => this.#seen(id),
      () => {}
    );
  };

  /** Retry the bootstrap after a failure; `recovered` runs when it answers. */
  failure = (recovered?: () => void) => {
    if (!this.snapshot) return;
    this.#once().then(
      id => {
        this.#seen(id);
        recovered?.();
      },
      () => this.#set("ended")
    );
  };

  /** The server refused an approval of the captured version. */
  stale = () => {
    if (this.snapshot) this.#set("stale");
  };

  /** One bootstrap request serves every check that arrives while it runs. */
  #once() {
    this.#pending ??= this.#read().finally(() => {
      this.#pending = null;
    });
    return this.#pending;
  }

  #seen(id: string | null) {
    if (id !== this.snapshot) this.#set("stale");
  }

  #set(status: SessionStatus) {
    if (rank[status] <= rank[this.#status]) return;
    this.#status = status;
    for (const listener of this.#listeners) listener();
  }
}
