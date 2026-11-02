/**
 * Review data for the shell: the API client of this bootstrap (dev, remote or read-only
 * snapshots) and small live queries over it. A query refetches when SSE `comments`/`review`
 * events name its key (IT-002) and when a mutation invalidates the key, so every surface (pins,
 * threads, counts, inbox) shows the same state without a page reload.
 */
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

import { flowKey } from "../../model/registry";
import { useShellData } from "../lib/shell-data";
import { permissionsOf, type Permissions } from "./permissions";
import { createReviewQueries, invalidateReview, type ReviewQueries } from "./queries";
import {
  createReviewApi,
  snapshotApi,
  type CommentFilter,
  type ReviewApi,
  type ReviewComment,
  type ReviewState,
} from "./api";

export type Query<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refetch: () => void;
};

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
  queries: ReviewQueries;
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
  const client = useQueryClient();
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
  const [queries] = useState(() =>
    createReviewQueries(
      api,
      new URL(bootstrap.apiBase ?? bootstrap.reviewSnapshotBase ?? ".", document.baseURI).href
    )
  );
  const [tickets] = useState(() =>
    bootstrap.mode === "remote" && api ? new RenderTickets(api) : null
  );
  useEffect(() => {
    const refresh = ({ key }: { key?: string }) => {
      void invalidateReview(client, queries, key);
    };
    const stopComments = events.subscribe("comments", refresh);
    const stopReview = events.subscribe("review", refresh);
    return () => {
      stopComments();
      stopReview();
    };
  }, [events, client, queries]);
  if (!api) return children;
  const writable = api.writable && bootstrap.mode !== "read-only";
  const permissions = permissionsOf(bootstrap, writable);
  return (
    <ReviewContext value={{ api, queries, expired, writable, permissions, tickets }}>
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

const inactive = createReviewQueries(null, "inactive");

/** Comments matching a filter, live. Without a key it follows every review (inbox). */
export function useComments(filter: CommentFilter = {}): Query<ReviewComment[]> {
  const context = use(ReviewContext);
  const query = useQuery((context?.queries ?? inactive).comments(filter));
  return {
    data: query.data,
    error: query.error,
    loading: query.isLoading,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useAllComments() {
  return useComments({ status: "all" });
}

export function useReviewState(key: string): Query<ReviewState> {
  const context = use(ReviewContext);
  const query = useQuery((context?.queries ?? inactive).state(key));
  return {
    data: query.data,
    error: query.error,
    loading: query.isLoading,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Individual canonical queries deduplicate overlapping groups and detail views. */
export function useReviewStates(keys: readonly string[]): Query<ReviewState[]> {
  const context = use(ReviewContext);
  return useQueries({
    queries: keys.map(key => (context?.queries ?? inactive).state(key)),
    combine: results => ({
      data: results.every(result => result.data !== undefined)
        ? results.map(result => result.data!)
        : undefined,
      error: results.find(result => result.error)?.error ?? null,
      loading: results.some(result => result.isLoading),
      refetch: () => {
        for (const result of results) void result.refetch();
      },
    }),
  });
}

/** Refresh all affected read models, including after ambiguous network failures. */
export function useReviewMutation() {
  const context = use(ReviewContext);
  const client = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: ({ run }: { key: string; run: (api: ReviewApi) => Promise<unknown> }) => {
      if (!context) throw new Error("No review data in this build");
      return run(context.api);
    },
    onSettled: (_data, _error, { key }) => {
      if (context) return invalidateReview(client, context.queries, key);
    },
  });
  return <T,>(key: string, run: (api: ReviewApi) => Promise<T>) =>
    mutateAsync({ key, run }) as Promise<T>;
}

/** Warm the same queries the destination observes; failures remain retryable on navigation. */
export function usePrefetchReview() {
  const context = use(ReviewContext);
  const client = useQueryClient();
  return (key: string) => {
    if (!context) return;
    void client.prefetchQuery(context.queries.state(key));
    void client.prefetchQuery(context.queries.comments({ key, status: "all" }));
  };
}
