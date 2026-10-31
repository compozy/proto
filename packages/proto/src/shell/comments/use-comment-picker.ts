import { useEffect, useEffectEvent, useState, type PointerEvent, type WheelEvent } from "react";
import { containerOf, describeTarget, elementAt, scrollAt, type Size } from "./dom";
import type { ElementTarget, Rect } from "./model";
type Point = { x: number; y: number };
export const dragRect = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

export function useCommentPicker({
  doc,
  canvas,
  scale,
  picking,
  onExit,
}: {
  doc: Document | null;
  canvas: Size;
  scale: number;
  picking: boolean;
  onExit: () => void;
}) {
  const [hover, setHover] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<{ start: Point; end: Point } | null>(null);
  const [draft, setDraft] = useState<ElementTarget | null>(null);

  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    setDrag(null);
    setHover(null);
    if (draft) setDraft(null);
    else onExit();
  });

  useEffect(() => {
    if (!picking) return;
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [picking]);

  const pointOf = (event: {
    clientX: number;
    clientY: number;
    currentTarget: HTMLDivElement;
  }): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / scale, y: (event.clientY - bounds.top) / scale };
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!doc || draft) return;
    const point = pointOf(event);
    if (drag) {
      setDrag({ ...drag, end: point });
      return;
    }
    const element = elementAt(doc, point.x, point.y);
    setHover(element ? element.getBoundingClientRect() : null);
  };

  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!doc || !drag) return;
    const region = dragRect(drag.start, pointOf(event));
    setDrag(null);
    setHover(null);
    if (region.width < 6 && region.height < 6) {
      const element = elementAt(doc, drag.start.x, drag.start.y);
      if (element) setDraft(describeTarget(element, null, canvas));
      return;
    }
    setDraft(describeTarget(containerOf(doc, region), region, canvas));
  };

  function onCancel(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
    setHover(null);
  }
  function onDown(event: PointerEvent<HTMLDivElement>) {
    if (!doc || !picking || draft || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOf(event);
    setDrag({ start: point, end: point });
  }
  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!doc || !picking) return;
    const point = pointOf(event);
    scrollAt(doc, point.x, point.y, event.deltaX, event.deltaY);
  }
  return {
    hover,
    drag,
    draft,
    setDraft,
    onMove,
    onUp,
    onDown,
    onCancel,
    onLeave: () => setHover(null),
    onWheel,
  };
}
