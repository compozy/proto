import { useEffect, useId, useRef, type ReactNode } from "react";

import { renderHref } from "../../model/protocol";
import { useT } from "../lib/i18n";
import { usePreviewScheduler, usePreviewSlot } from "../lib/preview-scheduler";
import { useShellData } from "../lib/shell-data";
import { useBox, useVisibility } from "../lib/use-box";
import { TriangleAlert } from "../ui/icons";
import { cn } from "../ui/utils";
import { FrameSkeleton } from "./frame-status";
import { useRenderFrame, type FrameTarget } from "./use-render-frame";

type PreviewProps = {
  target: Omit<FrameTarget, "width">;
  title: string;
  /** Virtual viewport of the preview, scaled to the container width. */
  width?: number;
  height?: number;
  /** Scheduling priority within the surface (lower loads first). */
  order?: number;
  /** False keeps the placeholder (flow cards below 60% zoom). */
  enabled?: boolean;
  className?: string;
  /** Content over the preview in its own box (a comment pin). */
  overlay?: ReactNode;
};

const noSlugs: ReadonlySet<string> = new Set();

/**
 * An inert live preview of a state (cards, flow steps, inspector): scaled to the container
 * width, mounted only when the surface's preview queue admits it (≤ 3 loading, ≤ 12 kept) and
 * a skeleton until the render host reports `ready`. Previews never take focus or input.
 */
export function Preview({
  target,
  title,
  width = 1280,
  height = 800,
  order = 0,
  enabled = true,
  className,
  overlay,
}: PreviewProps) {
  const [ref, box] = useBox();
  const visibility = useVisibility(ref);
  const { renderUrl } = useShellData();
  const src = renderHref(renderUrl, { ...target, chrome: 0 });
  const id = useId();
  const slot = usePreviewSlot(id, {
    src,
    visible: enabled && visibility.visible,
    near: enabled && visibility.near,
    order,
  });
  const scale = box.width / width;
  return (
    <div
      ref={ref}
      className={cn("relative w-full overflow-hidden bg-[var(--shell-panel)]", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {slot === "idle" ? (
        <div className="absolute inset-0 bg-[var(--shell-panel)]" aria-hidden="true" />
      ) : (
        <PreviewFrame
          id={id}
          src={src}
          target={target}
          title={title}
          width={width}
          height={height}
          scale={scale}
        />
      )}
      {overlay}
    </div>
  );
}

function PreviewFrame({
  id,
  src,
  target,
  title,
  width,
  height,
  scale,
}: {
  id: string;
  src: string;
  target: Omit<FrameTarget, "width">;
  title: string;
  width: number;
  height: number;
  scale: number;
}) {
  const t = useT();
  const scheduler = usePreviewScheduler();
  const iframe = useRef<HTMLIFrameElement>(null);
  const frame = useRenderFrame(iframe, { ...target, width }, { slugs: noSlugs });
  const settled = frame.status.kind !== "loading" || frame.status.slow;
  useEffect(() => {
    if (settled) scheduler.settle(id, src);
  }, [settled, scheduler, id, src]);
  return (
    <>
      <div inert className="absolute inset-0">
        <iframe
          key={frame.nonce}
          ref={iframe}
          src={frame.src ?? undefined}
          title={title}
          tabIndex={-1}
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-background"
          style={{ width, height, transform: `scale(${scale})` }}
        />
      </div>
      {frame.status.kind === "loading" && <FrameSkeleton className="p-[8%]" />}
      {frame.status.kind === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-[var(--shell-panel)] p-3">
          <span className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
            <TriangleAlert className="size-3" />
            {t("frame.previewFailed")}
          </span>
        </div>
      )}
    </>
  );
}
