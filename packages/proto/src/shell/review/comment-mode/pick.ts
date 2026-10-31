/**
 * Comment-mode logic without React or DOM: the pick session (the shell side of Safety
 * Invariant 7 — a `pick:result` counts only during a pick this shell started on this frame),
 * source confinement of picked targets, and the geometry of pins and the composer in the
 * shell's (scaled) frame coordinates.
 */
import type { ElementTarget, PickMode, Rect } from "../../../model/protocol";
import type { ReviewComment } from "../../../model/review";
import { normalizeSource, sourceRoots, type SourceRoots } from "../../../model/source";

export type ActivePick = { id: number; nonce: string; mode: PickMode };
export type PickSession = ActivePick | null;

let sequence = 0;

export function startPick(nonce: string, mode: PickMode): ActivePick {
  sequence += 1;
  return { id: sequence, nonce, mode };
}

/** Whether a validated `pick:result` from frame `nonce` belongs to the active pick. */
export function acceptsPick(session: PickSession, nonce: string) {
  return session !== null && session.nonce === nonce;
}

export type ConfinedPick =
  | { ok: true; target: ElementTarget }
  | { ok: false; code: "invalid_source" };

/**
 * Picked targets come from the render origin, where the prototype can forge them: every source
 * must be an app-relative path inside the source roots, or the pick is refused (`invalid_source`)
 * and nothing is sent. The review router applies the same rule to every write.
 */
export function confinePick(
  target: ElementTarget,
  roots: SourceRoots = sourceRoots()
): ConfinedPick {
  const sources =
    target.source === null ? target.sourceChain : [target.source, ...target.sourceChain];
  for (const source of sources) {
    if (normalizeSource(source, roots) === null) return { ok: false, code: "invalid_source" };
  }
  return { ok: true, target };
}

/** `login-form-7` → 7. */
export function commentNumber(comment: Pick<ReviewComment, "id">) {
  const match = /-(\d+)$/.exec(comment.id);
  return match ? Number(match[1]) : 0;
}

/** The number the next comment of a key most likely gets (shown on the composer pin). */
export function nextNumber(comments: readonly Pick<ReviewComment, "id">[]) {
  return comments.reduce((max, comment) => Math.max(max, commentNumber(comment)), 0) + 1;
}

export type Box = { width: number; height: number; scale: number };

const pinSize = 24;

/** Pin corner at the anchor's top-right corner, clamped inside the frame (scaled pixels). */
export function pinPosition(rect: Rect, box: Box) {
  const x = (rect.x + rect.width) * box.scale;
  const y = rect.y * box.scale;
  return {
    left: Math.min(Math.max(x, 4), box.width * box.scale - pinSize - 4),
    top: Math.min(Math.max(y, pinSize + 4), box.height * box.scale - 4),
  };
}

const composerWidth = 300;
const composerHeight = 280;

/** Composer beside the picked rect: right of it when it fits, else left, clamped vertically. */
export function composerPosition(rect: Rect, box: Box) {
  const frameWidth = box.width * box.scale;
  const frameHeight = box.height * box.scale;
  const right = (rect.x + rect.width) * box.scale + 12;
  const left =
    right + composerWidth <= frameWidth - 8
      ? right
      : Math.max(
          8,
          Math.min(rect.x * box.scale - composerWidth - 12, frameWidth - composerWidth - 8)
        );
  const top = Math.min(Math.max(8, rect.y * box.scale), Math.max(8, frameHeight - composerHeight));
  return { left, top, width: composerWidth };
}

/** The anchor a stored element target is watched with (`anchors:watch`). */
export function anchorOf(comment: ReviewComment) {
  const target = comment.target;
  if (target.kind === "node") return null;
  return {
    id: comment.id,
    selector: target.selector,
    testId: target.testId,
    offset: target.offset,
  };
}
