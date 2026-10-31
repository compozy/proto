/**
 * Review data for the shell: the API client of this bootstrap (dev, remote or read-only
 * snapshots) and small live queries over it. A query refetches when SSE `comments`/`review`
 * events name its key (IT-002) and when a mutation invalidates the key, so every surface (pins,
 * threads, counts, inbox) shows the same state without a page reload.
 */
import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { flowKey } from "../../model/registry";
import { useShellData } from "../lib/shell-data";
import { permissionsOf, type Permissions } from "./permissions";
import {
  createReviewApi,
  snapshotApi,
  type CommentFilter,
  type ReviewApi,
  type ReviewComment,
  type ReviewState,
} from "./api";

type Entry<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Review keys whose changes refetch this query; null = any key. */
  keys: ReadonlySet<string> | null;
  load: () => Promise<T>;
  listeners: Set<() => void>;
  generation: number;
};

export type Query<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refetch: () => void;
};

/** Query cache keyed by a string; entries refetch on `invalidate(reviewKey)`. */
export class ReviewCache {
  #entries = new Map<string, Entry<unknown>>();
  #snapshots = new Map<string, Query<unknown>>();

  entry<T>(id: string, keys: ReadonlySet<string> | null, load: () => Promise<T>) {
    let entry = this.#entries.get(id) as Entry<T> | undefined;
    if (!entry) {
      entry = {
        data: undefined,
        error: null,
        loading: false,
        keys,
        load,
        listeners: new Set(),
        generation: 0,
      };
      this.#entries.set(id, entry as Entry<unknown>);
    }
    entry.load = load;
    return entry;
  }

  subscribe(id: string, listener: () => void) {
    const entry = this.#entries.get(id);
    if (!entry) return () => {};
    entry.listeners.add(listener);
    if (entry.data === undefined && !entry.loading) void this.fetch(id);
    return () => {
      entry.listeners.delete(listener);
    };
  }

  snapshot<T>(id: string): Query<T> {
    const entry = this.#entries.get(id);
    const cached = this.#snapshots.get(id);
    if (
      cached &&
      entry &&
      cached.data === entry.data &&
      cached.error === entry.error &&
      cached.loading === entry.loading
    )
      return cached as Query<T>;
    const next: Query<unknown> = {
      data: entry?.data,
      error: entry?.error ?? null,
      loading: entry?.loading ?? true,
      refetch: () => void this.fetch(id),
    };
    this.#snapshots.set(id, next);
    return next as Query<T>;
  }

  async fetch(id: string) {
    const entry = this.#entries.get(id);
    if (!entry) return;
    const generation = ++entry.generation;
    entry.loading = true;
    this.#notify(entry);
    try {
      const data = await entry.load();
      if (generation !== entry.generation) return;
      entry.data = data;
      entry.error = null;
    } catch (error) {
      if (generation !== entry.generation) return;
      entry.error = error;
    }
    entry.loading = false;
    this.#notify(entry);
  }

  /** Refetch every watched query that depends on `key` (or on any key). */
  invalidate(key?: string) {
    for (const [id, entry] of this.#entries) {
      if (!entry.listeners.size) {
        // Unwatched entries go stale and reload on their next subscription.
        if (!key || !entry.keys || entry.keys.has(key)) entry.data = undefined;
        continue;
      }
      if (!key || !entry.keys || entry.keys.has(key)) void this.fetch(id);
    }
  }

  #notify(entry: Entry<unknown>) {
    for (const listener of entry.listeners) listener();
  }
}

/**
 * Render tickets of a remote gallery (`GET render-ticket`): a ticket lives 60 s and is not bound
 * to a slug, so frames loading together share one; `auth:expired` invalidates it.
 */
export class RenderTickets {
  #pending: { value: Promise<string>; at: number } | null = null;
  #api: ReviewApi;

  constructor(api: ReviewApi) {
    this.#api = api;
  }

  /** A ticket; the server checks that `slug`/`state` exist, then the grant covers every slug. */
  next(slug: string, state: string) {
    if (!this.#pending || Date.now() - this.#pending.at > 40_000) {
      const value = this.#api.renderTicket(slug, state);
      this.#pending = { value, at: Date.now() };
      value.catch(() => {
        this.#pending = null;
      });
    }
    return this.#pending.value;
  }

  invalidate() {
    this.#pending = null;
  }
}

type ReviewContextValue = {
  api: ReviewApi;
  cache: ReviewCache;
  /** Set when a request answered 401 `auth_required` (session expired, S18). */
  expired: { signInUrl: string | null } | null;
  /** True when this shell may write (dev, or remote with a principal); false read-only. */
  writable: boolean;
  permissions: Permissions;
  /** Remote mode only. */
  tickets: RenderTickets | null;
};

const ReviewContext = createContext<ReviewContextValue | null>(null);

/** Every review key of the registry: prototype slugs and `flow-<id>`. */
export function reviewKeys(registry: { prototypes: { slug: string }[]; flows: { id: string }[] }) {
  return [
    ...registry.prototypes.map(item => item.slug),
    ...registry.flows.map(item => flowKey(item.id)),
  ];
}

/**
 * Review data for the shell. Absent (children rendered without it) in a read-only build that
 * does not include review history: then `useReviewData()` is null and review UI stays hidden.
 */
export function ReviewProvider({
  keys,
  children,
}: {
  keys: readonly string[];
  children: ReactNode;
}) {
  const { bootstrap, events } = useShellData();
  const [expired, setExpired] = useState<{ signInUrl: string | null } | null>(null);
  const [cache] = useState(() => new ReviewCache());
  const [api] = useState<ReviewApi | null>(() => {
    if (bootstrap.apiBase) {
      return createReviewApi({
        apiBase: bootstrap.apiBase,
        onAuthRequired: signInUrl => setExpired({ signInUrl: signInUrl ?? bootstrap.signInUrl }),
      });
    }
    if (bootstrap.reviewSnapshotBase)
      return snapshotApi({ reviewSnapshotBase: bootstrap.reviewSnapshotBase, keys });
    return null;
  });
  const [tickets] = useState(() =>
    bootstrap.mode === "remote" && api ? new RenderTickets(api) : null
  );
  useEffect(() => {
    const refresh = ({ key }: { key?: string }) => cache.invalidate(key);
    const stops = [events.subscribe("comments", refresh), events.subscribe("review", refresh)];
    return () => {
      for (const stop of stops) stop();
    };
  }, [events, cache]);
  if (!api) return children;
  const writable = api.writable && bootstrap.mode !== "read-only";
  const permissions = permissionsOf(bootstrap, writable);
  return (
    <ReviewContext value={{ api, cache, expired, writable, permissions, tickets }}>
      {children}
    </ReviewContext>
  );
}

/** The review context, or null when this build has no review data at all. */
export function useReviewData() {
  return use(ReviewContext);
}

/** The remote render tickets, or null outside a remote gallery. */
export function useRenderTickets() {
  return use(ReviewContext)?.tickets ?? null;
}

export function useReviewApi() {
  const context = use(ReviewContext);
  if (!context) throw new Error("useReviewApi outside a ReviewProvider with review data");
  return context.api;
}

function useQuery<T>(
  id: string,
  keys: ReadonlySet<string> | null,
  load: (api: ReviewApi) => Promise<T>
): Query<T> {
  const context = use(ReviewContext);
  const cache = context?.cache;
  if (cache && context) cache.entry(id, keys, () => load(context.api));
  return useSyncExternalStore(
    listener => (cache ? cache.subscribe(id, listener) : () => {}),
    () => (cache ? cache.snapshot<T>(id) : idle)
  );
}

const idle: Query<never> = { data: undefined, error: null, loading: false, refetch: () => {} };

/** Comments matching a filter, live. Without a `key` it follows every key (inbox). */
export function useComments(filter: CommentFilter = {}): Query<ReviewComment[]> {
  const id = `comments:${JSON.stringify(filter)}`;
  return useQuery(id, filter.key ? new Set([filter.key]) : null, api => api.listComments(filter));
}

/** Every comment of the app (open and resolved), live: counts, inbox, search. */
export function useAllComments() {
  return useComments({ status: "all" });
}

/** The review state of a key (status, open count, events), live. */
export function useReviewState(key: string): Query<ReviewState> {
  return useQuery(`review:${key}`, new Set([key]), api => api.review(key));
}

/** Review states of several keys in one live query (spec cards). */
export function useReviewStates(keys: readonly string[]): Query<ReviewState[]> {
  return useQuery(`reviews:${keys.join(",")}`, new Set(keys), api =>
    Promise.all(keys.map(key => api.review(key)))
  );
}

/**
 * Runs a review mutation and refreshes every query of `key` (SSE refreshes other tabs and
 * windows; this keeps the acting tab immediate even without SSE).
 */
export function useReviewMutation() {
  const context = use(ReviewContext);
  return async <T,>(key: string, run: (api: ReviewApi) => Promise<T>) => {
    if (!context) throw new Error("No review data in this build");
    return run(context.api).finally(() => context.cache.invalidate(key));
  };
}
