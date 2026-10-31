import { createContext, use, useEffect, useSyncExternalStore, type ReactNode } from "react";

import { setParam, useSearch } from "./url-state.ts";

export type ThemePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  /** What renders now: the preference, or the system scheme when it is "system". */
  theme: "light" | "dark";
  setPreference: (value: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const darkQuery = "(prefers-color-scheme: dark)";

function subscribeScheme(listener: () => void) {
  const media = window.matchMedia(darkQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

const systemDark = () => window.matchMedia(darkQuery).matches;

/** `?theme=light|dark`; no parameter means "system". */
export function themePreference(search: string): ThemePreference {
  const param = new URLSearchParams(search).get("theme");
  return param === "light" || param === "dark" ? param : "system";
}

/** Applies `?theme=` to the page root (`.dark` and `color-scheme`) and provides it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = themePreference(useSearch());
  const dark = useSyncExternalStore(subscribeScheme, systemDark);
  const theme = preference === "system" ? (dark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const value: ThemeContextValue = {
    preference,
    theme,
    setPreference: next => setParam("theme", next === "system" ? null : next),
  };

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const value = use(ThemeContext);
  if (!value) throw new Error("useTheme needs ThemeProvider");
  return value;
}

function subscribeRootClass(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Whether the page root is in dark mode right now (ThemeProvider toggles `.dark` on <html>). */
export function useRootDark() {
  return useSyncExternalStore(subscribeRootClass, () =>
    document.documentElement.classList.contains("dark")
  );
}
