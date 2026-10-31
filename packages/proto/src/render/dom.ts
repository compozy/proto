/**
 * Maps between the prototype DOM and comment targets, inside the render host: what was clicked
 * or dragged becomes an `ElementTarget` (selector, text, source locations, rects), and a watched
 * anchor becomes its live rect. Coordinates are render viewport pixels. Source locations come
 * from `data-proto-src` and are confined to the app's source roots before they leave the frame.
 */
import type { Anchor, ElementTarget, Rect } from "../model/protocol.ts";
import { normalizeSource, type SourceRoots } from "../model/source.ts";

const sourceAttribute = "data-proto-src";
/** Marks the host's own picker layer, which hit testing and anchors never see. */
export const pickerAttribute = "data-proto-picker";

const maxChain = 8;
const maxText = 120;

const toRect = (box: DOMRect | Rect): Rect => ({
  x: box.x,
  y: box.y,
  width: box.width,
  height: box.height,
});

function segment(element: Element) {
  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
  const tag = element.localName;
  const parent = element.parentElement;
  if (!parent) return tag;
  const siblings = [...parent.children].filter(child => child.localName === tag);
  return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})` : tag;
}

/** Shortest unique `a > b > c` path from the element up, anchored on `data-testid` when present. */
export function selectorFor(element: Element) {
  const doc = element.ownerDocument;
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== doc.documentElement) {
    parts.unshift(segment(node));
    const selector = parts.join(" > ");
    const matches = doc.querySelectorAll(selector);
    if (matches.length === 1 && matches[0] === element) return selector;
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function textOf(element: Element) {
  const label =
    element.getAttribute("aria-label") ??
    element.getAttribute("placeholder") ??
    ("innerText" in element ? (element as HTMLElement).innerText : element.textContent) ??
    "";
  const text = label.replace(/\s+/g, " ").trim();
  return text.length > maxText ? `${text.slice(0, maxText - 1)}…` : text;
}

type FiberLike = { return: FiberLike | null; memoizedProps?: Record<string, unknown> | null };

/**
 * Confined source locations of the JSX elements that produced a DOM node, nearest first. It walks
 * React's fiber tree (dev build), so it also sees components that do not forward `data-proto-src`
 * to the DOM; the DOM attributes are the fallback. Paths outside `roots` are dropped.
 */
function sourceChain(element: Element, roots: SourceRoots, limit = maxChain) {
  const chain: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    const normalized = normalizeSource(value, roots);
    if (normalized && !chain.includes(normalized)) chain.push(normalized);
  };
  const key = Object.keys(element).find(name => name.startsWith("__reactFiber$"));
  let fiber = key ? (element as unknown as Record<string, FiberLike | undefined>)[key] : undefined;
  while (fiber && chain.length < limit) {
    add(fiber.memoizedProps?.[sourceAttribute]);
    fiber = fiber.return ?? undefined;
  }
  let node: Element | null = element.closest(`[${sourceAttribute}]`);
  while (node && chain.length < limit) {
    add(node.getAttribute(sourceAttribute));
    node = node.parentElement?.closest(`[${sourceAttribute}]`) ?? null;
  }
  return chain;
}

/** Sources of what is drawn inside a region (a 3×3 grid of probes), most specific first. */
function regionSources(doc: Document, region: Rect, roots: SourceRoots) {
  const sources: string[] = [];
  for (const fy of [0.5, 0.2, 0.8]) {
    for (const fx of [0.5, 0.2, 0.8]) {
      const probe = elementAt(doc, region.x + region.width * fx, region.y + region.height * fy);
      const value = probe ? sourceChain(probe, roots, 1)[0] : undefined;
      if (value && !sources.includes(value)) sources.push(value);
    }
  }
  return sources;
}

/** Topmost prototype element at a viewport point: never the root `<html>` nor the picker. */
export function elementAt(doc: Document, x: number, y: number) {
  for (const element of doc.elementsFromPoint(x, y)) {
    if (element === doc.documentElement) return null;
    if (!element.closest(`[${pickerAttribute}]`)) return element;
  }
  return null;
}

const contains = (outer: DOMRect, inner: Rect) =>
  outer.left <= inner.x + 1 &&
  outer.top <= inner.y + 1 &&
  outer.right >= inner.x + inner.width - 1 &&
  outer.bottom >= inner.y + inner.height - 1;

/** Deepest element that contains a dragged region, starting under its center. */
export function containerOf(doc: Document, region: Rect) {
  let node = elementAt(doc, region.x + region.width / 2, region.y + region.height / 2);
  while (node && node.parentElement && !contains(node.getBoundingClientRect(), region)) {
    node = node.parentElement;
  }
  return node ?? doc.body;
}

export type Size = { width: number; height: number };

export function describeTarget(
  element: Element,
  region: Rect | null,
  viewport: Size,
  roots: SourceRoots
): ElementTarget {
  const box = element.getBoundingClientRect();
  const rect = region ?? toRect(box);
  const fraction = (value: number, total: number) => (total > 0 ? value / total : 0);
  const own = sourceChain(element, roots);
  const inside = region ? regionSources(element.ownerDocument, region, roots) : [];
  const chain = [...new Set([...inside, ...own])].slice(0, maxChain);
  return {
    kind: region ? "region" : "element",
    selector: selectorFor(element),
    testId: element.closest("[data-testid]")?.getAttribute("data-testid") ?? null,
    tag: element.localName,
    text: textOf(element),
    source: chain[0] ?? null,
    sourceChain: chain,
    rect,
    rectNormalized: {
      x: fraction(rect.x, viewport.width),
      y: fraction(rect.y, viewport.height),
      width: fraction(rect.width, viewport.width),
      height: fraction(rect.height, viewport.height),
    },
    offset: region
      ? {
          x: fraction(region.x - box.x, box.width),
          y: fraction(region.y - box.y, box.height),
          width: fraction(region.width, box.width),
          height: fraction(region.height, box.height),
        }
      : null,
  };
}

/** The element a selector names, or null when it is gone or the selector no longer parses. */
export function queryElement(doc: Document, selector: string) {
  try {
    return doc.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Where a watched anchor is now: its element's rect (or the region inside it, from `offset`),
 * or null when the element is gone or not laid out (the shell shows the "moved" marker).
 */
export function anchorRect(doc: Document, anchor: Anchor): Rect | null {
  const element =
    queryElement(doc, anchor.selector) ??
    (anchor.testId ? queryElement(doc, `[data-testid="${CSS.escape(anchor.testId)}"]`) : null);
  const box = element?.getBoundingClientRect();
  if (!box || (box.width === 0 && box.height === 0)) return null;
  const offset = anchor.offset;
  if (!offset) return toRect(box);
  return {
    x: box.x + offset.x * box.width,
    y: box.y + offset.y * box.height,
    width: offset.width * box.width,
    height: offset.height * box.height,
  };
}

/** Scrolls the nearest scrollable ancestor under the pointer (the picker swallows wheel events). */
export function scrollAt(doc: Document, x: number, y: number, deltaX: number, deltaY: number) {
  let node: Element | null = elementAt(doc, x, y);
  const view = doc.defaultView;
  while (node && view) {
    const style = view.getComputedStyle(node);
    const scrollable =
      (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) ||
      (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth);
    if (scrollable) {
      node.scrollBy(deltaX, deltaY);
      return;
    }
    node = node.parentElement;
  }
  view?.scrollBy(deltaX, deltaY);
}
