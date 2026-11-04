import { useRef, type ReactNode, type RefObject } from "react";

import type { RenderMessage, StoryFrameTarget } from "../../model/protocol";
import { useBox } from "../lib/use-box";
import type { Width } from "../lib/view";
import { cn } from "../ui/utils";
import { FrameSkeleton, RenderErrorCard, SlowNotice } from "./frame-status";
import {
  useRenderFrame,
  type FrameContext,
  isStoryTarget,
  type FrameTarget,
  type RenderFrameHandle,
} from "./use-render-frame";

export type FrameGeometry = { width: number; height: number; scale: number };

/**
 * An interactive render frame fitted to its container (a prototype state or a story, whose
 * frame loads from its root's story server): at `fit` the document gets the whole
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
  target: Omit<FrameTarget, "width"> | Omit<StoryFrameTarget, "width">;
  width: Width;
  title: string;
  slugs: ReadonlySet<string>;
  className?: string;
  onContext?: (context: FrameContext) => void;
  onMessage?: (message: RenderMessage) => void;
  overlay?: (frame: RenderFrameHandle, geometry: FrameGeometry) => ReactNode;
  caption?: (geometry: FrameGeometry) => ReactNode;
  /**
   * Sibling controls may display the measured viewport without copying it into parent state;
   * the frame handle carries a story's `result` and `reload` (Replay).
   */
  toolbar?: (geometry: FrameGeometry, frame: RenderFrameHandle) => ReactNode;
}) {
  const [ref, box] = useBox();
  const fitted = fitFrame(box, width);
  const iframe = useRef<HTMLIFrameElement>(null);
  const frame = useRenderFrame(
    iframe,
    { ...target, width: width === "fit" ? undefined : width },
    { slugs, onContext, onMessage }
  );
  const ready = box.width > 0 && box.height > 0;
  return (
    <>
      {toolbar?.(fitted.geometry, frame)}
      <div className={cn("flex min-h-0 min-w-0 flex-col", className)}>
        <div ref={ref} className="relative grid min-h-0 min-w-0 flex-1 place-items-center">
          {ready && (
            <FrameBody
              frame={frame}
              iframe={iframe}
              title={title}
              fitted={fitted}
              keepDocument={keepsDocument(target, frame)}
              overlay={overlay}
            />
          )}
        </div>
        {ready && caption?.(fitted.geometry)}
      </div>
    </>
  );
}

type Fitted = { frameWidth: number; frameHeight: number; scale: number; geometry: FrameGeometry };

/**
 * At `fit` the document gets the whole box; at a fixed width it is scaled down (never up) to
 * fit and stretched to the box height.
 */
function fitFrame(box: { width: number; height: number }, width: Width): Fitted {
  const frameWidth = width === "fit" ? Math.max(box.width, 1) : width;
  const scale = width === "fit" ? 1 : Math.min(1, box.width / width);
  const frameHeight = scale > 0 ? Math.round(box.height / scale) : 0;
  return {
    frameWidth,
    frameHeight,
    scale,
    geometry: { width: Math.round(frameWidth), height: frameHeight, scale },
  };
}

/**
 * A failed story keeps its document, hidden behind the failure card: an edit to the story, its
 * preview or a module it imports reloads that document in place (Vite `full-reload`), and its
 * first report clears the failure (US-007.AC-2). Prototype frames drop a failed document.
 */
const keepsDocument = (target: object, frame: RenderFrameHandle) =>
  isStoryTarget(target) && frame.src !== null;

/** The scaled frame box: the failure card, the document, or both (a failed story). */
function FrameBody({
  frame,
  iframe,
  title,
  fitted,
  keepDocument,
  overlay,
}: {
  frame: RenderFrameHandle;
  iframe: RefObject<HTMLIFrameElement | null>;
  title: string;
  fitted: Fitted;
  keepDocument: boolean;
  overlay?: (frame: RenderFrameHandle, geometry: FrameGeometry) => ReactNode;
}) {
  const { status } = frame;
  const failed = status.kind === "error";
  return (
    <div
      className="shell-frame relative overflow-hidden rounded-xl bg-background"
      style={{ width: fitted.frameWidth * fitted.scale, height: fitted.frameHeight * fitted.scale }}
    >
      {status.kind === "error" && (
        <RenderErrorCard title={title} status={status} onReload={frame.reload} />
      )}
      {(!failed || keepDocument) && (
        <>
          <FrameDocument
            frame={frame}
            iframe={iframe}
            title={title}
            fitted={fitted}
            hidden={failed}
          />
          <FrameProgress frame={frame} geometry={fitted.geometry} overlay={overlay} />
        </>
      )}
    </div>
  );
}

/** The document's iframe; hidden (not removed) while a failed story waits to reload in place. */
function FrameDocument({
  frame,
  iframe,
  title,
  fitted,
  hidden,
}: {
  frame: RenderFrameHandle;
  iframe: RefObject<HTMLIFrameElement | null>;
  title: string;
  fitted: Fitted;
  hidden: boolean;
}) {
  return (
    <>
      {/* oxlint-disable react-doctor/iframe-missing-sandbox -- Authored prototypes require scripts and real origins; dev/remote use separate origins and static builds trust bundled code. See docs/proto/performance.md. */}
      <iframe
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        key={frame.nonce}
        ref={iframe}
        src={frame.src ?? undefined}
        title={title}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : undefined}
        className={cn(
          "absolute top-0 left-0 origin-top-left border-0 bg-background",
          hidden && "invisible"
        )}
        style={{
          width: fitted.frameWidth,
          height: fitted.frameHeight,
          transform: `scale(${fitted.scale})`,
        }}
      />
      {/* oxlint-enable react-doctor/iframe-missing-sandbox */}
    </>
  );
}

/** Loading skeleton, the amber "still loading" notice, or the overlay of a ready frame. */
function FrameProgress({
  frame,
  geometry,
  overlay,
}: {
  frame: RenderFrameHandle;
  geometry: FrameGeometry;
  overlay?: (frame: RenderFrameHandle, geometry: FrameGeometry) => ReactNode;
}) {
  const { status } = frame;
  if (status.kind === "ready") return overlay?.(frame, geometry) ?? null;
  if (status.kind !== "loading") return null;
  return (
    <>
      <FrameSkeleton />
      {status.slow && <SlowNotice onReload={frame.reload} />}
    </>
  );
}
