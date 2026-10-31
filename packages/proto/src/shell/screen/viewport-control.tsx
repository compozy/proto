import { useState } from "react";

import { useT } from "../lib/i18n";
import { clampWidth, maxWidth, minWidth, presets, type Width } from "../lib/view";
import { Button } from "../ui/button";
import { Maximize2, Monitor, Smartphone, Tablet } from "../ui/icons";
import { cn } from "../ui/utils";

const icons = { desktop: Monitor, tablet: Tablet, phone: Smartphone };

/** Viewport presets (desktop 1440, tablet 834, phone 390), `fit`, and a free width 320–3840. */
export function ViewportControl({
  width,
  fitWidth,
  onWidth,
}: {
  width: Width;
  /** The width `fit` resolves to right now, shown while fitting. */
  fitWidth: number;
  onWidth: (width: Width) => void;
}) {
  const t = useT();
  const shown = width === "fit" ? fitWidth : width;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const value = Number(draft);
    setDraft(null);
    if (draft.trim() && Number.isFinite(value)) onWidth(clampWidth(value));
  };
  return (
    <div
      role="group"
      aria-label={t("viewport.label")}
      className="flex items-center gap-0.5 rounded-xl border border-border bg-[var(--shell-panel)] p-1"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("viewport.fit")}
        aria-pressed={width === "fit"}
        className={cn(width === "fit" && "bg-accent text-foreground")}
        onClick={() => onWidth("fit")}
      >
        <Maximize2 />
      </Button>
      {presets.map(preset => {
        const Icon = icons[preset.id];
        return (
          <Button
            key={preset.id}
            variant="ghost"
            size="icon-sm"
            aria-label={t(`viewport.${preset.id}`, { width: preset.width })}
            aria-pressed={width === preset.width}
            className={cn(width === preset.width && "bg-accent text-foreground")}
            onClick={() => onWidth(preset.width)}
          >
            <Icon />
          </Button>
        );
      })}
      <label className="hidden items-center xl:flex">
        <span className="sr-only">{t("viewport.width")}</span>
        <input
          inputMode="numeric"
          min={minWidth}
          max={maxWidth}
          value={draft ?? String(Math.round(shown))}
          onChange={event => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setDraft(null);
          }}
          className="h-7 w-14 rounded-md bg-transparent px-1.5 text-center font-mono text-xs tabular-nums outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-primary/50"
        />
      </label>
    </div>
  );
}
