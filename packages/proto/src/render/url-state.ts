/**
 * URL state of a rendered prototype: the runtime helpers `@compozy/proto` exports. The query
 * string is the state (`state`, `theme`, `role`, plus any parameter a prototype owns); the render
 * host subscribes to it and posts `context` to the shell after every change, so a prototype that
 * calls `setParam` moves the review context with it.
 */
import { useSyncExternalStore } from "react";
import { renderPathPrefix, type RenderConfig } from "../model/render-host.ts";

type Place = { pathname: string; search: string };

/** The slug a render URL names: `…/__proto/render/<slug>` (path form) or `?slug=` (query form). */
export function resolveSlug(place: Place, form: RenderConfig["form"]) {
  if (form === "query") return new URLSearchParams(place.search).get("slug");
  const at = place.pathname.lastIndexOf(renderPathPrefix);
  if (at < 0) return null;
  const rest = place.pathname.slice(at + renderPathPrefix.length).replace(/\/+$/, "");
  if (!rest || rest.includes("/")) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

/** Calls `listener` after `setParam(s)` or history navigation (back, forward) changed the URL. */
export function subscribeSearch(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

const currentSearch = () => window.location.search;

export function useSearch() {
  return useSyncExternalStore(subscribeSearch, currentSearch);
}

export function setParam(name: string, value: string | null) {
  setParams({ [name]: value });
}

/** Updates several query parameters at once; `push` adds a history entry (back button). */
export function setParams(values: Record<string, string | null>, options?: { push?: boolean }) {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(values)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  if (url.href === window.location.href) return;
  if (options?.push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  listeners.forEach(listener => listener());
}

/** Parameters a link to another prototype keeps: how it is viewed and which frame it is in. */
const keptParams = ["theme", "role", "w", "chrome", "frame"];

/**
 * Link to another prototype on the render origin, keeping theme, role, width, chrome and the
 * frame nonce of the current one. Path form `/__proto/render/<slug>` or, in a static build, the
 * same `index.html` with `?slug=`.
 */
export function protoHref(slug: string, state?: string) {
  const current = new URLSearchParams(window.location.search);
  const next = new URLSearchParams();
  const queryForm = current.has("slug") || window.location.pathname.endsWith(".html");
  if (queryForm) next.set("slug", slug);
  if (state) next.set("state", state);
  for (const key of keptParams) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  const search = next.toString();
  const query = search ? `?${search}` : "";
  if (queryForm) return `${window.location.pathname}${query}`;
  const match = /^(.*\/__proto\/render\/)[^/]*$/.exec(window.location.pathname);
  return `${match?.[1] ?? "/__proto/render/"}${encodeURIComponent(slug)}${query}`;
}
