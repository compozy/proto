/**
 * Client of the dev-server comments API (`node/comments-plugin.ts`). A gallery-only Query cache
 * keeps one list per prototype plus the open/resolved counts; the server's `proto:comments` HMR
 * event reloads them when a file changes (gallery, CLI or hand edit).
 */
import { useSyncExternalStore } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { galleryQueryClient } from "../query";

import {
  commentsEvent,
  type CommentCounts,
  type CommentStatus,
  type NewComment,
  type ReviewComment,
} from "./model";

/** Only `proto dev` serves the API; a built gallery is a read-only static site. */
const base = "/__comments";
export const commentsAvailable = !import.meta.env.PROD;
let failure: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal }
) {
  const response = await fetch(`${base}${path}`, {
    signal: init?.signal,
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function track<T>(promise: Promise<T>) {
  return promise.then(
    value => {
      if (failure) {
        failure = null;
        emit();
      }
      return value;
    },
    (error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") throw error;
      failure = error instanceof Error ? error.message : String(error);
      emit();
      throw error;
    }
  );
}

const commentsKey = (slug: string) => ["prototype-comments", slug] as const;
const countsKey = ["prototype-comment-counts"] as const;
const empty: ReviewComment[] = [];
const emptyCounts: CommentCounts = {};

const commentsOptions = (slug: string) =>
  queryOptions({
    queryKey: commentsKey(slug),
    queryFn: ({ signal }) =>
      track(request<{ comments: ReviewComment[] }>(`/${slug}`, { signal })).then(
        value => value.comments
      ),
    refetchInterval: 15000,
  });
const countsOptions = queryOptions({
  queryKey: countsKey,
  queryFn: ({ signal }) =>
    track(request<{ counts: CommentCounts }>("", { signal })).then(value => value.counts),
  refetchInterval: 15000,
});

export function loadComments(slug: string) {
  return galleryQueryClient.invalidateQueries({ queryKey: commentsKey(slug) });
}
export function loadCounts() {
  return galleryQueryClient.invalidateQueries({ queryKey: countsKey });
}

if (import.meta.hot) {
  import.meta.hot.on(commentsEvent, (data: { slug: string }) => {
    void loadComments(data.slug);
    void loadCounts();
  });
}

export function useComments(slug: string | null) {
  const query = useQuery({
    ...commentsOptions(slug ?? ""),
    enabled: commentsAvailable && slug !== null,
  });
  return query.data ?? empty;
}
export function useCommentCounts() {
  return useQuery({ ...countsOptions, enabled: commentsAvailable }).data ?? emptyCounts;
}

/** Last API error (dev server down, invalid input), cleared by the next successful call. */
export function useCommentsFailure() {
  return useSyncExternalStore(subscribe, () => failure);
}

async function mutate<T>(slug: string, path: string, method: string, body?: unknown) {
  const result = await track(request<T>(`/${slug}${path}`, { method, body }));
  await Promise.all([loadComments(slug), loadCounts()]);
  return result;
}

export const commentsApi = {
  edit: (
    slug: string,
    id: string,
    messageId: string,
    input: { body?: string; addAttachments?: string[]; removeAttachments?: string[] }
  ) => mutate<ReviewComment>(slug, `/${id}/messages/${messageId}`, "PATCH", input),
  create: (slug: string, input: NewComment) =>
    mutate<ReviewComment>(slug, "", "POST", {
      ...input,
      context: { ...input.context, commit: import.meta.env.VITE_BUILD_COMMIT ?? null },
    }),
  reply: (slug: string, id: string, body: string, attachments: string[] = []) =>
    mutate<ReviewComment>(slug, `/${id}/replies`, "POST", {
      body,
      author: "reviewer",
      attachments,
    }),
  setStatus: (slug: string, id: string, status: CommentStatus) =>
    mutate<ReviewComment>(slug, `/${id}/status`, "POST", { status, author: "reviewer" }),
  remove: (slug: string, id: string) => mutate<ReviewComment>(slug, `/${id}`, "DELETE"),
};
