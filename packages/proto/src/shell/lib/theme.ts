import { useEffect, useSyncExternalStore } from "react";

import type { ThemeChoice } from "./view";

const query = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** `system` resolved against the OS preference. */
export function useResolvedTheme(choice: ThemeChoice): "light" | "dark" {
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
  return choice === "system" ? (systemDark ? "dark" : "light") : choice;
}

/** The shell document follows the theme; previews follow it only through `?theme=`. */
export function useDocumentTheme(theme: "light" | "dark", locale: string) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.lang = locale;
  }, [theme, locale]);
}

export function nextTheme(theme: "light" | "dark"): ThemeChoice {
  return theme === "dark" ? "light" : "dark";
}
