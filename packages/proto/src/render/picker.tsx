/**
 * The element picker the shell starts with `pick:start`, drawn inside the frame: a crosshair
 * layer over the prototype with the hover outline and element label. Pointer modes pick the
 * clicked element or, after a drag, the region; keyboard mode moves a crosshair with the arrows
 * (Shift for larger steps) and picks with Enter. Escape cancels. Inline styles only: the
 * consumer's CSS knows nothing about the host.
 */
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";

import type { ElementTarget, PickMode, Rect } from "../model/protocol.ts";
import type { SourceRoots } from "../model/source.ts";
import { containerOf, describeTarget, elementAt, pickerAttribute, scrollAt } from "./dom.ts";

type Point = { x: number; y: number };

const accent = "#ec4899";
const minRegion = 6;
const step = { small: 8, large: 40 };

const dragRect = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

function labelOf(element: Element) {
  const testId = element.getAttribute("data-testid");
  const source = element.closest("[data-proto-src]")?.getAttribute("data-proto-src");
  const file = source?.split("/").at(-1);
  return [element.localName, testId ? `[${testId}]` : null, file].filter(Boolean).join(" · ");
}

/** The outline and label of the element under a point, or null over nothing. */
function hoverOf(point: Point): { rect: Rect; label: string } | null {
  const element = elementAt(document, point.x, point.y);
  return element ? { rect: element.getBoundingClientRect(), label: labelOf(element) } : null;
}

const viewportOf = () => ({ width: window.innerWidth, height: window.innerHeight });

export function Picker({
  mode,
  roots,
  onResult,
  onCancel,
}: {
  mode: PickMode;
  roots: SourceRoots;
  onResult: (target: ElementTarget) => void;
  onCancel: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<Point>(() => ({
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2),
  }));
  const [hover, setHover] = useState(() => (mode === "keyboard" ? hoverOf(cursor) : null));
  const [drag, setDrag] = useState<{ start: Point; end: Point } | null>(null);

  const hoverAt = (point: Point) => setHover(hoverOf(point));

  const pickElement = (point: Point) => {
    const element = elementAt(document, point.x, point.y);
    if (element) onResult(describeTarget(element, null, viewportOf(), roots));
  };

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (drag) setDrag(null);
      else onCancel();
      return;
    }
    if (mode !== "keyboard") return;
    if (event.key === "Enter") {
      event.preventDefault();
      pickElement(cursor);
      return;
    }
    const distance = event.shiftKey ? step.large : step.small;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -distance, y: 0 },
      ArrowRight: { x: distance, y: 0 },
      ArrowUp: { x: 0, y: -distance },
      ArrowDown: { x: 0, y: distance },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = {
      x: Math.min(Math.max(cursor.x + move.x, 0), window.innerWidth - 1),
      y: Math.min(Math.max(cursor.y + move.y, 0), window.innerHeight - 1),
    };
    setCursor(next);
    hoverAt(next);
  });

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (mode === "keyboard") layer.current?.focus();
  }, [mode]);

  const pointOf = (event: { clientX: number; clientY: number }): Point => ({
    x: event.clientX,
    y: event.clientY,
  });

  const region = drag ? dragRect(drag.start, drag.end) : null;
  const layerStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 2147483647,
    cursor: "crosshair",
    outline: "none",
    touchAction: "none",
  };
  const box = (rect: Rect, extra: CSSProperties): CSSProperties => ({
    position: "fixed",
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    pointerEvents: "none",
    boxSizing: "border-box",
    ...extra,
  });

  return (
    <div
      ref={layer}
      {...{ [pickerAttribute]: "" }}
      data-testid="proto-picker"
      data-mode={mode}
      tabIndex={-1}
      aria-label={
        mode === "keyboard"
          ? "Move with the arrow keys, press Enter to pick"
          : "Click an element or drag a region"
      }
      style={layerStyle}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = pointOf(event);
        setDrag({ start: point, end: point });
      }}
      onPointerMove={event => {
        const point = pointOf(event);
        if (drag) setDrag({ ...drag, end: point });
        else hoverAt(point);
      }}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (!drag) return;
        const area = dragRect(drag.start, pointOf(event));
        setDrag(null);
        setHover(null);
        if (area.width < minRegion && area.height < minRegion) {
          pickElement(drag.start);
          return;
        }
        onResult(describeTarget(containerOf(document, area), area, viewportOf(), roots));
      }}
      onPointerCancel={() => {
        setDrag(null);
        setHover(null);
      }}
      onPointerLeave={() => {
        if (!drag) setHover(null);
      }}
      onWheel={event => {
        scrollAt(document, event.clientX, event.clientY, event.deltaX, event.deltaY);
        hoverAt(pointOf(event));
      }}
    >
      {hover && !region ? (
        <>
          <div style={box(hover.rect, { border: `2px solid ${accent}`, borderRadius: 2 })} />
          <div
            style={{
              position: "fixed",
              left: Math.max(hover.rect.x, 0),
              top: hover.rect.y >= 22 ? hover.rect.y - 22 : hover.rect.y + hover.rect.height + 2,
              pointerEvents: "none",
              padding: "2px 6px",
              borderRadius: 4,
              background: accent,
              color: "#fff",
              font: "500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace",
              whiteSpace: "nowrap",
            }}
          >
            {hover.label}
          </div>
        </>
      ) : null}
      {region ? (
        <div
          style={box(region, {
            border: `2px dashed ${accent}`,
            background: "rgb(236 72 153 / 0.12)",
          })}
        />
      ) : null}
      {mode === "keyboard" ? (
        <div
          data-testid="proto-picker-crosshair"
          style={box(
            { x: cursor.x - 8, y: cursor.y - 8, width: 16, height: 16 },
            {
              borderRadius: "50%",
              border: `2px solid ${accent}`,
              boxShadow: "0 0 0 2px #fff",
            }
          )}
        />
      ) : null}
    </div>
  );
}
