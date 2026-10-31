import { useState } from "react";

import { useT } from "../lib/i18n";
import { topFrames, type FrameStatus } from "../lib/render-channel";
import { Button } from "../ui/button";
import { Copy, RotateCcw, TriangleAlert } from "../ui/icons";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";

/** What a frame shows until the render host reports `ready`: never a blank white box. */
export function FrameSkeleton({ className }: { className?: string }) {
  const t = useT();
  return (
    <div
      role="status"
      aria-label={t("frame.loading")}
      className={cn(
        "absolute inset-0 flex flex-col gap-3 bg-[var(--shell-panel)] p-[6%]",
        className
      )}
    >
      <Skeleton className="h-[8%] w-2/5" />
      <Skeleton className="h-[5%] w-3/5" />
      <Skeleton className="mt-[4%] flex-1" />
    </div>
  );
}

/** Amber notice after 10 s without `ready` (S16 "still loading"). */
export function SlowNotice({ onReload }: { onReload: () => void }) {
  const t = useT();
  return (
    <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <div
        role="status"
        className="flex items-center gap-2 rounded-full border border-[color-mix(in_oklch,var(--tone-warning)_40%,transparent)] bg-[var(--shell-panel)] py-1 pr-1 pl-3 text-xs whitespace-nowrap text-[var(--tone-warning)] shadow-lg"
      >
        <TriangleAlert className="size-3.5" />
        {t("frame.slow")}
        <Button variant="ghost" size="xs" onClick={onReload} className="text-foreground">
          <RotateCcw data-icon="inline-start" />
          {t("frame.reload")}
        </Button>
      </div>
    </div>
  );
}

/** S16: a state that threw while rendering; the error stays inside its frame. */
export function RenderErrorCard({
  title,
  status,
  onReload,
}: {
  title: string;
  status: Extract<FrameStatus, { kind: "error" }>;
  onReload: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const frames = topFrames(status.componentStack);
  const copy = () => {
    const text = [status.message, ...frames].join("\n");
    void navigator.clipboard?.writeText(text).then(() => setCopied(true));
  };
  return (
    <div className="grid h-full w-full place-items-center overflow-auto p-6">
      <div
        role="alert"
        className="shell-frame w-full max-w-[640px] overflow-hidden rounded-xl bg-[var(--shell-panel)]"
      >
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] font-medium text-destructive">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="truncate">{t("frame.failed", { title })}</span>
        </div>
        <div className="p-4">
          <p className={status.reason ? "text-[13px]" : "font-mono text-[13px] break-words"}>
            {status.reason === "auth_loop" ? t("frame.authLoop") : status.message}
          </p>
          {frames.length > 0 && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {frames.join("\n")}
            </pre>
          )}
          <div className="mt-4 flex gap-2">
            <Button size="sm" className="font-semibold" onClick={onReload}>
              <RotateCcw data-icon="inline-start" />
              {t("frame.reloadState")}
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy data-icon="inline-start" />
              {copied ? t("common.copied") : t("frame.copyError")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
