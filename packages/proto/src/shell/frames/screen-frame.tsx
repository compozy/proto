import { useEffect, useRef, type ReactNode } from "react";

import type { RenderMessage } from "../../model/protocol";
import { useBox } from "../lib/use-box";
import type { Width } from "../lib/view";
import { cn } from "../ui/utils";
import { FrameSkeleton, RenderErrorCard, SlowNotice } from "./frame-status";
import {
  useRenderFrame,
  type FrameContext,
  type FrameTarget,
  type RenderFrameHandle,
} from "./use-render-frame";

export type FrameGeometry = { width: number; height: number; scale: number };

/**
 * An interactive render frame fitted to its container: at `fit` the prototype gets the whole
 * box; at a fixed width it is scaled down (never up) to fit and stretched to the box height.
 * `overlay` renders in the frame's own coordinates (pins, pick outlines of the review slice).
 */
export function ScreenFrame({
  target,
  width,
  title,
  slugs,
  className,
  onContext,
  onMessage,
  overlay,
  caption,
  onGeometry,
}: {
  target: Omit<FrameTarget, "width">;
  width: Width;
  title: string;
  slugs: ReadonlySet<string>;
  className?: string;
  onContext?: (context: FrameContext) => void;
  onMessage?: (message: RenderMessage) => void;
  overlay?: (frame: RenderFrameHandle, geometry: FrameGeometry) => ReactNode;
  caption?: (geometry: FrameGeometry) => ReactNode;
  /** The frame's viewport size changed (the toolbar shows the width `fit` resolves to). */
  onGeometry?: (geometry: FrameGeometry) => void;
}) {
  const [ref, box] = useBox();
  const frameWidth = width === "fit" ? Math.max(box.width, 1) : width;
  const scale = width === "fit" ? 1 : Math.min(1, box.width / width);
  const frameHeight = scale > 0 ? Math.round(box.height / scale) : 0;
  const geometry = { width: Math.round(frameWidth), height: frameHeight, scale };
  const iframe = useRef<HTMLIFrameElement>(null);
  const frame = useRenderFrame(
    iframe,
    { ...target, width: width === "fit" ? undefined : width },
    { slugs, onContext, onMessage }
  );
  const ready = box.width > 0 && box.height > 0;
  useEffect(() => {
    if (ready) onGeometry?.({ width: geometry.width, height: geometry.height, scale });
  }, [ready, geometry.width, geometry.height, scale, onGeometry]);
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      <div ref={ref} className="relative grid min-h-0 min-w-0 flex-1 place-items-center">
        {ready && (
          <div
            className="shell-frame relative overflow-hidden rounded-xl bg-background"
            style={{ width: frameWidth * scale, height: frameHeight * scale }}
          >
            {frame.status.kind === "error" ? (
              <RenderErrorCard title={title} status={frame.status} onReload={frame.reload} />
            ) : (
              <>
                <iframe
                  key={frame.nonce}
                  ref={iframe}
                  src={frame.src ?? undefined}
                  title={title}
                  className="absolute top-0 left-0 origin-top-left border-0 bg-background"
                  style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}
                />
                {frame.status.kind === "loading" && <FrameSkeleton />}
                {frame.status.kind === "loading" && frame.status.slow && (
                  <SlowNotice onReload={frame.reload} />
                )}
                {frame.status.kind === "ready" && overlay?.(frame, geometry)}
              </>
            )}
          </div>
        )}
      </div>
      {ready && caption?.(geometry)}
    </div>
  );
}
