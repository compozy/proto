/**
 * The canvas renders the selected prototype in an iframe on its standalone URL
 * (`/<slug>?chrome=0&theme=…&state=…&role=…`), so themes and global styles stay isolated and the
 * evidence URL is exactly what reviewers see. Widths wider than the area scale down to fit.
 * Switching state, theme or role rewrites the iframe URL in place (no reload, like the standalone
 * toolbar); switching prototype replaces its location without adding history entries. Both edges
 * of the frame drag (or take arrow keys) to any width from 320 to 3840 px, kept in `?w=` on release.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { useIsMobile } from "@proto/ui/hooks/use-mobile";
import { cn } from "@proto/ui/lib/utils";

import { CommentOverlay } from "./comments/overlay";
import type { ElementTarget, ReviewComment } from "./comments/model";
import { Frame, type FrameInfo } from "./frame";
import { frameSrc, maxWidth, minWidth, updateView, type Viewport } from "./view";

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

type CanvasProps = {
  slug: string;
  title: string;
  state: string;
  theme: string | null;
  role: string | null;
  width: Viewport;
  compare: boolean;
  picking: boolean;
  comments: ReviewComment[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (
    target: ElementTarget,
    body: string,
    viewport: { width: number; height: number },
    attachments: string[]
  ) => Promise<void>;
  onExitPicking: () => void;
  onInfo: (info: FrameInfo | null) => void;
};

function fit(available: { width: number; height: number }, viewport: Viewport) {
  const width = viewport === "fit" ? available.width : viewport;
  const scale = width > 0 ? Math.min(1, available.width / width) : 1;
  return { width, height: Math.floor(available.height / scale), scale };
}

const clampWidth = (width: number) => Math.round(Math.min(maxWidth, Math.max(minWidth, width)));

type Drag = { side: -1 | 1; x: number; width: number; scale: number };

/**
 * A draggable edge of the frame. The frame stays centered, so moving one edge by `d` screen px
 * changes the width by `2d` (divided by the scale, for frames wider than the area).
 */
function Edge({
  side,
  width,
  scale,
  onDrag,
  onCommit,
}: {
  side: -1 | 1;
  width: number;
  scale: number;
  onDrag: (width: number | null) => void;
  onCommit: (width: number) => void;
}) {
  const drag = useRef<Drag | null>(null);
  const widthAt = (event: PointerEvent) => {
    const start = drag.current;
    if (!start) return width;
    return clampWidth(start.width + (2 * start.side * (event.clientX - start.x)) / start.scale);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 100 : 10;
    const delta = { ArrowLeft: -side * step, ArrowRight: side * step }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    onCommit(clampWidth(width + delta));
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 1 ? "Right canvas edge" : "Left canvas edge"}
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuetext={`${width} px`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { side, x: event.clientX, width, scale };
        onDrag(width);
      }}
      onPointerMove={event => {
        if (drag.current) onDrag(widthAt(event));
      }}
      onPointerUp={event => {
        const next = widthAt(event);
        drag.current = null;
        onDrag(null);
        onCommit(next);
      }}
      onPointerCancel={() => {
        drag.current = null;
        onDrag(null);
      }}
      className={cn(
        "group/edge absolute top-0 z-10 flex h-full w-3 cursor-ew-resize touch-none items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        side === 1 ? "-right-3" : "-left-3"
      )}
      data-testid={side === 1 ? "canvas-edge-right" : "canvas-edge-left"}
    >
      <span className="h-10 w-1 rounded-full bg-border transition-colors group-hover/edge:bg-muted-foreground group-active/edge:bg-primary" />
    </div>
  );
}

type Fitted = ReturnType<typeof fit>;

/** Light and dark side by side, in the same state, role and width. */
function CompareFrames({
  props,
  frame,
  height,
}: {
  props: CanvasProps;
  frame: Fitted;
  height: number;
}) {
  return (["light", "dark"] as const).map(theme => (
    <div key={theme} className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="font-mono text-[11px] text-muted-foreground uppercase">{theme}</span>
      <div
        className="overflow-hidden rounded-[14px] bg-background"
        style={{ width: frame.width * frame.scale, height: height - 22 }}
      >
        <Frame
          src={frameSrc(props.slug, { state: props.state, theme, role: props.role })}
          title={`${props.title} · ${theme}`}
          width={frame.width}
          height={Math.floor((height - 22) / frame.scale)}
          scale={frame.scale}
        />
      </div>
    </div>
  ));
}

/** The reviewed frame: comments overlay, drag edges and its width (and scale) below. */
function SingleFrame({
  props,
  frame,
  height,
  resizable,
  dragWidth,
  onDrag,
}: {
  props: CanvasProps;
  frame: Fitted;
  height: number;
  resizable: boolean;
  dragWidth: number | null;
  onDrag: (width: number | null) => void;
}) {
  const [info, setInfo] = useState<FrameInfo | null>(null);
  const report = (next: FrameInfo | null) => {
    setInfo(next);
    props.onInfo(next);
  };
  const canvas = { width: frame.width, height: frame.height };
  return (
    <div className="relative" style={{ width: frame.width * frame.scale, height }}>
      <div className="relative size-full overflow-hidden rounded-[14px] bg-background">
        <Frame
          src={frameSrc(props.slug, { state: props.state, theme: props.theme, role: props.role })}
          title={props.title}
          width={frame.width}
          height={frame.height}
          scale={frame.scale}
          onInfo={report}
        />
        <CommentOverlay
          slug={props.slug}
          doc={info?.doc ?? null}
          canvas={canvas}
          scale={frame.scale}
          picking={props.picking}
          comments={props.comments}
          state={props.state}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
          onCreate={(target, body, attachments) =>
            props.onCreate(target, body, canvas, attachments)
          }
          onExit={props.onExitPicking}
        />
        {/* While dragging, the iframe must not swallow the pointer. */}
        {dragWidth === null ? null : <div className="absolute inset-0 cursor-ew-resize" />}
      </div>
      {(resizable ? ([-1, 1] as const) : []).map(side => (
        <Edge
          key={side}
          side={side}
          width={Math.round(frame.width)}
          scale={frame.scale}
          onDrag={onDrag}
          onCommit={width => updateView({ width })}
        />
      ))}
      <span
        className={cn(
          "pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 font-mono text-[10.5px] leading-4 whitespace-nowrap text-muted-foreground",
          dragWidth !== null && "text-foreground"
        )}
        aria-live="polite"
        data-testid="canvas-size"
      >
        {Math.round(frame.width)} px
        {frame.scale < 1 ? ` · ${Math.round(frame.scale * 100)}%` : ""}
      </span>
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  const [ref, size] = useSize();
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  // Phones have no room for the drag edges; the device presets cover them.
  const resizable = !useIsMobile() && !props.compare;
  const columns = props.compare ? 2 : 1;
  // Room between compared frames, for the drag edges of a single frame and for its size below.
  const reserved = props.compare
    ? { width: 12, height: 0 }
    : { width: resizable ? 32 : 0, height: 20 };
  const area = {
    width: Math.max(0, (size.width - reserved.width) / columns),
    height: Math.max(0, size.height - reserved.height),
  };
  const frame = fit(area, dragWidth ?? props.width);
  const ready = size.width > 0 && size.height > 0;

  return (
    <div
      ref={ref}
      className="relative flex min-h-0 min-w-0 flex-1 justify-center gap-3 rounded-[20px] bg-card p-2"
      data-testid="canvas"
    >
      {!ready ? null : props.compare ? (
        <CompareFrames props={props} frame={frame} height={size.height} />
      ) : (
        <SingleFrame
          props={props}
          frame={frame}
          height={area.height}
          resizable={resizable}
          dragWidth={dragWidth}
          onDrag={setDragWidth}
        />
      )}
    </div>
  );
}
