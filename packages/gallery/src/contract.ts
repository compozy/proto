import { useSyncExternalStore, type ReactNode } from "react";

export type PrototypeState = { id: string; label: string };

/**
 * Literal metadata of a prototype, read statically by discovery (never executed). `spec` names a
 * group from the app's `gallery.config.ts` (prototypes without one are listed under "Unsorted"),
 * `roles` a subset of its roles, and `standalone` opts a component prototype out of the app frame
 * (`PrototypeFrame` in `preview/canvas.tsx`), for full-page screens such as sign-in.
 */
export type PrototypeMeta = {
  title: string;
  spec?: string;
  surface: string;
  route: string;
  blocks?: readonly string[];
  states: readonly [PrototypeState, ...PrototypeState[]];
  roles?: readonly [string, ...string[]];
  standalone?: boolean;
};

export type PrototypeProps = { state: string; role: string | null };

/**
 * Props of the `PrototypeFrame` an app exports from `preview/canvas.tsx`: it wraps component
 * prototypes (not drafts, not `standalone` ones) in the app's production chrome for `route`.
 */
export type PrototypeFrameProps = {
  route: string;
  role: string | null;
  state: string;
  children: ReactNode;
};

export function definePrototype<const Meta extends PrototypeMeta>(meta: Meta): Meta {
  return meta;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function useSearch() {
  return useSyncExternalStore(subscribe, () => window.location.search);
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

/** Link to another prototype, keeping the theme and chrome parameters of the current one. */
export function protoHref(slug: string, state?: string) {
  const current = new URLSearchParams(window.location.search);
  const next = new URLSearchParams();
  for (const key of ["theme", "chrome"]) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  if (state) next.set("state", state);
  const query = next.toString();
  return `/${slug}${query ? `?${query}` : ""}`;
}
