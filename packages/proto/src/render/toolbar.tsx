import type { CSSProperties } from "react";

import { setParam } from "./url-state.ts";
import { useTheme } from "./theme.tsx";

type ToolbarMeta = {
  title?: string;
  surface?: string | null;
  states: readonly { id: string; label: string }[];
};

const control: CSSProperties = {
  height: 28,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "inherit",
  font: "inherit",
};

function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {dark ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ) : (
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      )}
    </svg>
  );
}

/**
 * Render-host control (not part of any design): state picker and theme toggle, so every state
 * can be reviewed on the bare render URL. Hidden with `?chrome=0` (shell iframes, screenshots,
 * evidence). Inline styles: the consumer's CSS knows nothing about the host.
 */
export function PrototypeToolbar({
  slug,
  meta,
  state,
  galleryHref = null,
}: {
  slug: string;
  meta: ToolbarMeta;
  state: string;
  /** The shell's view of this state, when the host knows where the shell is. */
  galleryHref?: string | null;
}) {
  const { theme, setPreference } = useTheme();
  const dark = theme === "dark";
  const label = meta.surface ?? slug;
  return (
    <div
      data-prototype-chrome
      data-testid="proto-toolbar"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 2147483646,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 8,
        background: dark ? "#18181b" : "#fff",
        color: dark ? "#fafafa" : "#18181b",
        boxShadow: "0 0 0 1px rgb(127 127 127 / 0.25), 0 4px 12px rgb(0 0 0 / 0.12)",
        font: "12px/1.2 ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {galleryHref ? (
        <a
          href={galleryHref}
          target="_top"
          title={`Open in the gallery: ${meta.title ?? slug}`}
          style={{ padding: "6px 8px", color: "inherit", fontFamily: "ui-monospace, monospace" }}
        >
          {label}
        </a>
      ) : (
        <span style={{ padding: "6px 8px", fontFamily: "ui-monospace, monospace" }}>{label}</span>
      )}
      {meta.states.length > 1 ? (
        <label style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            Prototype state
          </span>
          <select
            value={state}
            onChange={event => setParam("state", event.target.value)}
            style={{
              ...control,
              maxWidth: 224,
              padding: "0 6px",
              background: dark ? "#27272a" : "#f4f4f5",
            }}
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
        aria-label={dark ? "Use light theme" : "Use dark theme"}
        style={{ ...control, width: 28, display: "grid", placeItems: "center", cursor: "pointer" }}
      >
        <ThemeIcon dark={dark} />
      </button>
    </div>
  );
}
