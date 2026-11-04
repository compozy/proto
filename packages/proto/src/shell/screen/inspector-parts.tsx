/**
 * Inspector and canvas pieces shared by the screen page and the story page, so both read alike:
 * the copyable source path of the Source tab and the theme label above a compare frame.
 */
import { useState, type ReactNode } from "react";

import { copyText } from "../lib/clipboard";
import { useT } from "../lib/i18n";
import { Button } from "../ui/button";
import { Check, Copy, Moon, Sun } from "../ui/icons";

/** A file path with a copy button (Source tab). */
export function CopyablePath({ path }: { path: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{path}</code>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={copied ? t("common.copied") : t("health.copyPath")}
        onClick={async () => setCopied(await copyText(path))}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

/** The light/dark label of one compare column, with the frame width (or other aside). */
export function ThemeLabel({ theme, aside }: { theme: "light" | "dark"; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {theme === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      <span className="font-mono tracking-[0.08em] uppercase">{theme}</span>
      <span className="ml-auto flex items-center gap-2 font-mono tabular-nums">{aside}</span>
    </div>
  );
}
