import { useRef, type ReactNode } from "react";

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
  toolbar,
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
  /** Sibling controls may display the measured viewport without copying it into parent state. */
  toolbar?: (geometry: FrameGeometry) => ReactNode;
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
  return (
    <>
      {toolbar?.(geometry)}
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
                  {/* oxlint-disable react-doctor/iframe-missing-sandbox -- Authored prototypes require scripts and real origins; dev/remote use separate origins and static builds trust bundled code. See docs/proto/performance.md. */}
                  <iframe
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                    key={frame.nonce}
                    ref={iframe}
                    src={frame.src ?? undefined}
                    title={title}
                    className="absolute top-0 left-0 origin-top-left border-0 bg-background"
                    style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}
                  />
                  {/* oxlint-enable react-doctor/iframe-missing-sandbox */}
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
    </>
  );
}
