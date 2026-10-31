import { useEffect } from "react";

/**
 * Keyboard shortcuts (S19). Bindings are keyed by the produced character (`j`, `[`, `?`, `1`)
 * or `mod+k` / `escape`. Single keys are ignored while typing in a field or with a modifier
 * held, so they never steal text input; `mod+k` and `escape` work everywhere.
 */
export type Bindings = Partial<Record<string, (event: KeyboardEvent) => void>>;

function editable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.getAttribute("role") === "combobox"
  );
}

export function bindingFor(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") return "mod+k";
  if (event.key === "Escape") return "escape";
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (editable(event.target)) return null;
  return event.key.length === 1 ? event.key.toLowerCase() : null;
}

export function useShortcuts(bindings: Bindings, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const binding = bindingFor(event);
      const handler = binding ? bindings[binding] : undefined;
      if (!handler) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindings, enabled]);
}

/** The shortcut sheet; the review slice appends its own rows (C comment mode). */
export const shortcutRows: { label: string; keys: string[] }[] = [
  { label: "shortcuts.search", keys: ["⌘K", "/"] },
  { label: "shortcuts.states", keys: ["J", "K"] },
  { label: "shortcuts.prototypes", keys: ["[", "]"] },
  { label: "shortcuts.views", keys: ["1", "2", "3"] },
  { label: "shortcuts.theme", keys: ["T"] },
  { label: "shortcuts.fit", keys: ["F"] },
  { label: "shortcuts.help", keys: ["?"] },
  { label: "shortcuts.close", keys: ["Esc"] },
];
