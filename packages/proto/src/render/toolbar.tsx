import { MoonIcon, SunIcon } from "@proto/ui/lib/icons";

import { setParam, type PrototypeMeta } from "../contract";
import { useTheme } from "./theme";

/** The gallery view of this prototype and state, keeping theme and role. */
function galleryHref(slug: string, state: string) {
  const current = new URLSearchParams(window.location.search);
  const next = new URLSearchParams({ p: slug, state });
  for (const key of ["theme", "role"]) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  return `/?${next}`;
}

/**
 * Prototype-only control (not part of any design): state picker and theme toggle, so every
 * state can be reviewed. Hidden with `?chrome=0` for screenshots and rendered evidence.
 */
export function PrototypeToolbar({
  slug,
  meta,
  state,
}: {
  slug: string;
  meta: PrototypeMeta;
  state: string;
}) {
  const { preference, setPreference } = useTheme();
  const dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <div
      data-prototype-chrome
      className="fixed right-3 bottom-3 z-[100] flex items-center gap-1 rounded-lg bg-popover p-1 ring-1 ring-foreground/10 text-xs text-popover-foreground"
    >
      <a
        href={galleryHref(slug, state)}
        className="rounded-md px-2 py-1.5 font-mono text-muted-foreground hover:text-foreground"
        title={`Open in the gallery: ${meta.spec ?? "unsorted"} ${meta.surface}`}
      >
        {meta.surface}
      </a>
      {meta.states.length > 1 ? (
        <label className="flex items-center">
          <span className="sr-only">Prototype state</span>
          <select
            value={state}
            onChange={event => setParam("state", event.target.value)}
            className="h-7 max-w-56 rounded-md bg-muted px-1.5 text-xs"
          >
            {meta.states.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        onClick={() => setPreference(dark ? "light" : "dark")}
        className="grid size-7 place-items-center rounded-md hover:bg-muted"
        aria-label={dark ? "Use light theme" : "Use dark theme"}
      >
        {dark ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
      </button>
    </div>
  );
}
