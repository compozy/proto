/**
 * `anchors:watch` on the render side: reports the live rect of every watched anchor now and
 * again whenever the viewport resizes, anything scrolls, the DOM changes or an image loads.
 * Measures once per animation frame and posts only when a rect changed.
 */
import type { Anchor, Rect } from "../model/protocol.ts";
import { anchorRect } from "./dom.ts";

export type AnchorRects = { id: string; rect: Rect | null }[];

export function watchAnchors(
  view: Window,
  anchors: readonly Anchor[],
  onRects: (rects: AnchorRects) => void
) {
  const doc = view.document;
  let last = "";
  let frame = 0;
  const measure = () => {
    frame = 0;
    const rects = anchors.map(anchor => ({ id: anchor.id, rect: anchorRect(doc, anchor) }));
    const key = JSON.stringify(rects);
    if (key === last) return;
    last = key;
    onRects(rects);
  };
  const schedule = () => {
    if (!frame) frame = view.requestAnimationFrame(measure);
  };
  measure();
  const observer = new MutationObserver(schedule);
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  view.addEventListener("resize", schedule);
  view.addEventListener("scroll", schedule, { capture: true, passive: true });
  view.addEventListener("load", schedule, { capture: true });
  return () => {
    if (frame) view.cancelAnimationFrame(frame);
    observer.disconnect();
    view.removeEventListener("resize", schedule);
    view.removeEventListener("scroll", schedule, { capture: true });
    view.removeEventListener("load", schedule, { capture: true });
  };
}
