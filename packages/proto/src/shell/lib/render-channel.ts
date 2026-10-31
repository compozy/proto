/**
 * Shell side of the shell ⇄ render protocol (`_spec.md` § Shell ⇄ render protocol, ADR-008,
 * Safety Invariant 7). Render messages are untrusted: a message counts only when it comes from
 * the iframe the shell created, from the render origin, with that frame's current nonce, and
 * parses with the `src/model/protocol.ts` schemas. The shell never touches the iframe's
 * document; it only posts to its window.
 */
import { renderMessageSchema, type RenderMessage } from "../../model/protocol";

/** Still loading after this long: the amber "still loading" state (S16). */
export const slowAfterMs = 10_000;

export type FrameExpectation = {
  /** The `contentWindow` of the iframe this shell created. */
  source: Window | null;
  /** Origin of the bootstrap `renderUrl`. */
  origin: string;
  /** The frame's current nonce; a reloaded frame gets a new one. */
  nonce: string;
};

/** The validated message, or null when it must be ignored. */
export function acceptRenderMessage(
  event: Pick<MessageEvent, "data" | "origin" | "source">,
  expected: FrameExpectation
): RenderMessage | null {
  if (!expected.source || event.source !== expected.source) return null;
  if (event.origin !== expected.origin) return null;
  const parsed = renderMessageSchema.safeParse(event.data);
  if (!parsed.success || parsed.data.frame !== expected.nonce) return null;
  return parsed.data;
}

export type FrameStatus =
  | { kind: "loading"; slow: boolean }
  | { kind: "ready" }
  | { kind: "error"; message: string; componentStack: string | null };

export const initialStatus: FrameStatus = { kind: "loading", slow: false };

/** An error is final until the frame reloads (a later `ready` never hides it). */
export function nextStatus(current: FrameStatus, message: RenderMessage | "slow"): FrameStatus {
  if (current.kind === "error") return current;
  if (message === "slow")
    return current.kind === "loading" ? { kind: "loading", slow: true } : current;
  if (message.type === "ready") return { kind: "ready" };
  if (message.type === "error") {
    return { kind: "error", message: message.message, componentStack: message.componentStack };
  }
  return current;
}

/** A fresh frame nonce (works outside secure contexts, unlike `crypto.randomUUID`). */
export function frameNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/** The first frames of a component stack, trimmed for the S16 card. */
export function topFrames(componentStack: string | null, count = 4) {
  return (componentStack ?? "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, count);
}
