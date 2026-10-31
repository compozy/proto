/**
 * Layer over the canvas iframe: pins of the current state's comments and, in comment mode, the
 * picker (hover highlight, click an element or drag a region) and the composer. It lives outside
 * the scaled frame so pins and the composer keep their size; positions are canvas px × `scale`.
 */
import { useEffect, useState } from "react";

import { cn } from "@proto/ui/lib/utils";

import { CommentComposer } from "./composer";
import { locateTarget, type Size } from "./dom";
import type { ElementTarget, Rect, ReviewComment } from "./model";
import { CommentPins, type Located } from "./pins";
import { dragRect, useCommentPicker } from "./use-comment-picker";

type OverlayProps = {
  slug: string;
  doc: Document | null;
  canvas: Size;
  scale: number;
  picking: boolean;
  /** Every comment of the prototype (stable store array); pins show the open ones of `state`. */
  comments: ReviewComment[];
  state: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (target: ElementTarget, body: string, attachments: string[]) => Promise<void>;
  onExit: () => void;
};

/** Re-measures pins whenever the prototype scrolls, resizes or re-renders. */
function useLocated(
  doc: Document | null,
  comments: ReviewComment[],
  width: number,
  height: number
) {
  const [located, setLocated] = useState<Map<string, Located>>(new Map());
  useEffect(() => {
    if (!doc) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const canvas = { width, height };
        const next = new Map(
          comments.flatMap(c =>
            c.target.kind === "node" ? [] : [[c.id, locateTarget(doc, c.target, canvas)] as const]
          )
        );
        // Most mutations do not move anything: keep the same map and skip the render.
        setLocated(previous =>
          JSON.stringify([...previous]) === JSON.stringify([...next]) ? previous : next
        );
      });
    };
    measure();
    const view = doc.defaultView;
    const observer = new MutationObserver(measure);
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true });
    doc.addEventListener("scroll", measure, true);
    view?.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      doc.removeEventListener("scroll", measure, true);
      view?.removeEventListener("resize", measure);
    };
  }, [doc, comments, width, height]);
  return located;
}

function box(rect: Rect, scale: number) {
  return {
    left: rect.x * scale,
    top: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

export function CommentOverlay(props: OverlayProps) {
  const { doc, canvas, scale, picking, selectedId, onSelect } = props;
  const located = useLocated(doc, props.comments, canvas.width, canvas.height);
  const { hover, drag, draft, setDraft, onMove, onUp, onDown, onCancel, onLeave, onWheel } =
    useCommentPicker({ doc, canvas, scale, picking, onExit: props.onExit });

  const visible = props.comments.filter(comment => {
    if (comment.context.state !== props.state && comment.id !== selectedId) return false;
    if (comment.status === "resolved" && comment.id !== selectedId) return false;
    const rect = located.get(comment.id)?.rect;
    return rect && rect.y + rect.height >= 0 && rect.y <= canvas.height;
  });
  const selectedRect = selectedId ? located.get(selectedId)?.rect : undefined;
  const width = canvas.width * scale;
  const height = canvas.height * scale;

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden",
        picking ? "cursor-crosshair" : "pointer-events-none"
      )}
      style={{ width, height }}
      onPointerDown={onDown}
      onPointerMove={picking ? onMove : undefined}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onLostPointerCapture={onCancel}
      onPointerLeave={onLeave}
      onWheel={onWheel}
      data-testid="comment-overlay"
    >
      {picking && !draft ? (
        <p
          role="status"
          className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs whitespace-nowrap text-background"
        >
          Click an element or drag an area · Esc leaves
        </p>
      ) : null}
      {picking && hover && !drag && !draft ? (
        <div
          className="pointer-events-none absolute rounded-sm bg-primary/8 ring-2 ring-primary"
          style={box(hover, scale)}
        />
      ) : null}
      {drag ? (
        <div
          className="pointer-events-none absolute rounded-sm bg-primary/10 ring-2 ring-primary"
          style={box(dragRect(drag.start, drag.end), scale)}
        />
      ) : null}
      {selectedRect && !draft ? (
        <div
          className="pointer-events-none absolute rounded-sm ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          style={box(selectedRect, scale)}
        />
      ) : null}
      {draft ? (
        <div
          className="pointer-events-none absolute rounded-sm bg-primary/10 ring-2 ring-primary"
          style={box(draft.rect, scale)}
        />
      ) : null}
      <CommentPins
        comments={visible}
        located={located}
        scale={scale}
        width={width}
        height={height}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {draft ? (
        <CommentComposer
          slug={props.slug}
          target={draft}
          scale={scale}
          bounds={{ width, height }}
          onCancel={() => setDraft(null)}
          onSubmit={async (body, attachments) => {
            await props.onCreate(draft, body, attachments);
            setDraft(null);
          }}
        />
      ) : null}
    </div>
  );
}
