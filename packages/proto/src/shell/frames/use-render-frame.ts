/**
 * One render iframe and its channel: the render URL with a fresh frame nonce, the frame status
 * (`loading` → `ready` | `error`, amber after 10 s), `context` changes from the prototype and a
 * `send` for shell → render messages. Picking, anchors and scrolling (review slice) build on
 * `send` and `onMessage`; this hook never reads the iframe's document. The frame model and the
 * message handling live in `frame-channel.ts`; render tickets apply to prototypes only.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

import type { RenderMessage } from "../../model/protocol";
import { nextStatus, slowAfterMs } from "../lib/render-channel";
import { useShellData } from "../lib/shell-data";
import { useRenderTickets } from "../review/data";
import {
  awaitsSlow,
  createEmitter,
  forNonce,
  forwardTo,
  frameFor,
  frameListener,
  isStoryTarget,
  keyOf,
  knownRoles,
  loadFrame,
  postToFrame,
  requestTicket,
  reticketHandler,
  storyOf,
  targetParts,
  ticketedSrc,
  type Frame,
  type FrameContext,
  type RenderTarget,
  type ShellOutgoing,
} from "./frame-channel";

export {
  frameHref,
  isStoryTarget,
  type FrameContext,
  type FrameTarget,
  type RenderTarget,
} from "./frame-channel";

type Options = {
  /** Known slugs: a `context.url` naming anything else is ignored. */
  slugs: ReadonlySet<string>;
  /** The prototype changed its own state, theme, role or width (`setParam(s)`, `protoHref`). */
  onContext?: (context: FrameContext) => void;
  /** Validated messages beyond the lifecycle: `pick:result`, `anchors`, `auth:expired`. */
  onMessage?: (message: RenderMessage) => void;
};

/** Own frame tickets, nonce-scoped messaging and navigation without reloading unchanged documents. */
export function useRenderFrame(
  iframe: RefObject<HTMLIFrameElement | null>,
  target: RenderTarget,
  options: Options
) {
  const env = useShellData();
  const { registry, session } = env;
  const { storySlug, storyId, ticketFor } = targetParts(target);
  // Remote galleries protect the render origin: each prototype load carries a short-lived
  // ticket. Stories exist only in dev and local static builds, so they never take one.
  const remoteTickets = useRenderTickets();
  const tickets = isStoryTarget(target) ? null : remoteTickets;
  const [ticket, setTicket] = useState<{ nonce: string; value: string } | null>(null);
  const [messages] = useState(createEmitter);
  const [frame, setFrame] = useState<Frame>(() => loadFrame(env, target));

  // A target the frame already shows (it reported it as `context`) keeps the frame; any other
  // target loads a new document with a new nonce, so late messages of the old one are stale.
  const shown = frameFor(frame, keyOf(target), () => loadFrame(env, target));
  if (shown !== frame) setFrame(shown);

  /** Replay: the same target in a fresh document with a new nonce (the old one turns stale). */
  const reload = () => setFrame(loadFrame(env, target));

  const reloadRef = useRef(reload);
  /** Times this frame re-ticketed after `auth:expired` (see `allowReticket`). */
  const retickets = useRef<number[]>([]);
  useEffect(() => {
    reloadRef.current = reload;
  });

  const { nonce, origin } = frame;
  const { slugs, onContext, onMessage } = options;
  useEffect(() => {
    const update = (change: (current: Frame) => Frame) => setFrame(forNonce(nonce, change));
    const listen = frameListener({
      source: () => iframe.current?.contentWindow ?? null,
      nonce,
      origin,
      story: storyOf(storySlug, storyId),
      slugs,
      roles: knownRoles(registry),
      update,
      onContext,
      forward: forwardTo(onMessage, messages.emit),
      onAuthExpired: reticketHandler(tickets, retickets, update, () => reloadRef.current()),
    });
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [
    iframe,
    nonce,
    origin,
    storySlug,
    storyId,
    slugs,
    registry,
    onContext,
    onMessage,
    tickets,
    messages,
  ]);

  // In a share, a frame that failed to load may be asking for a replaced version's chunk (S1).
  const failed = frame.status.kind === "error";
  useEffect(() => {
    if (failed) session.compare();
  }, [failed, nonce, session]);

  const loading = awaitsSlow(frame.status);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setFrame(
        forNonce(nonce, current => ({ ...current, status: nextStatus(current.status, "slow") }))
      );
    }, slowAfterMs);
    return () => clearTimeout(timer);
  }, [loading, nonce]);

  const send = (message: ShellOutgoing) =>
    postToFrame(iframe.current?.contentWindow ?? null, frame, message);

  /** Moves keyboard focus into the frame (keyboard picking starts from a focused frame). */
  const focus = () => iframe.current?.focus();

  useEffect(
    () =>
      requestTicket(tickets, ticketFor, {
        ticket: value => setTicket({ nonce, value }),
        update: change => setFrame(forNonce(nonce, change)),
      }),
    [tickets, nonce, ticketFor]
  );

  return {
    /** Null while a remote frame waits for its render ticket. */
    src: ticketedSrc(frame.src, tickets !== null, ticket, nonce),
    nonce,
    status: frame.status,
    /** The story's lifecycle result (`story:status`); null for prototypes and before a report. */
    result: frame.result,
    reload,
    send,
    focus,
    listen: messages.listen,
  };
}

export type RenderFrameHandle = ReturnType<typeof useRenderFrame>;
