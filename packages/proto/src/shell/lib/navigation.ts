/**
 * Navigation over `history`: the shell's only router. Every change goes through `navigate`, so
 * `useLocation` re-renders on pushes, replaces and back/forward alike.
 */
import { useEffect, useSyncExternalStore } from "react";

import { parseView, viewSearch, type Location, type ThemeChoice, type View } from "./view";

const changeEvent = "proto:navigate";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

const readSearch = () => window.location.search;

/** The current location; a non-canonical URL (clamped width, conflicting params) is rewritten. */
export function useLocation(): Location {
  const search = useSyncExternalStore(subscribe, readSearch);
  const { view, theme, canonical } = parseView(search);
  const current = search === "?" ? "" : search;
  useEffect(() => {
    if (canonical !== current) replaceSearch(canonical);
  }, [canonical, current]);
  return { view, theme };
}

function replaceSearch(search: string) {
  const url = `${window.location.pathname}${search}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(changeEvent));
}

/** The href (relative to the shell document) of a location. */
export function hrefOf(location: Location) {
  return viewSearch(location) || window.location.pathname;
}

export function navigate(location: Location, options: { replace?: boolean } = {}) {
  const search = viewSearch(location);
  if (search === window.location.search) return;
  const url = `${window.location.pathname}${search}`;
  if (options.replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  window.dispatchEvent(new Event(changeEvent));
}

/** Navigates to a view keeping the current theme. */
export function go(view: View, options?: { replace?: boolean }) {
  navigate({ view, theme: parseView(window.location.search).theme }, options);
}

export function setTheme(theme: ThemeChoice) {
  navigate({ view: parseView(window.location.search).view, theme }, { replace: true });
}
