import { createContext, use, useEffect, useSyncExternalStore, type ReactNode } from "react";

import { setParam, useSearch } from "../contract";

export type ThemePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Gallery stand-in for an app ThemeProvider: `?theme=light|dark`; no param means "system". */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const search = useSearch();
  const param = new URLSearchParams(search).get("theme");
  const preference: ThemePreference = param === "light" || param === "dark" ? param : "system";

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = preference === "dark" || (preference === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  const value = (() => ({
    preference,
    setPreference: (next: ThemePreference) => setParam("theme", next === "system" ? null : next),
  }))();

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
