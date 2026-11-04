/**
 * The pure model behind `useRenderFrame`: render targets and their URLs, the frame state of one
 * document, and the shell's handling of each validated render message. No React here, so the
 * hook only wires state, effects and tickets to these functions.
 *
 * A target is a prototype state (`FrameTarget`, on the render host) or a story
 * (`StoryFrameTarget`, on its root's story server). Each frame takes its origin from its own
 * target, so a story frame accepts messages only from its root's origin (Safety Invariant 2).
 */
import {
  readContextUrl,
  parsePreviewRole,
  renderHref,
  storyHref,
  type RenderMessage,
  type ShellMessage,
  type StoryFrameTarget,
  type StoryResult,
} from "../../model/protocol";
import type { useShellData } from "../lib/shell-data";
import {
  acceptRenderMessage,
  allowReticket,
  frameNonce,
  initialStatus,
  nextStatus,
  type FrameStatus,
} from "../lib/render-channel";
import { frameEndpoint, type ShellEnv } from "../lib/shell-env";

export type FrameTarget = {
  slug: string;
  state: string;
  theme: "light" | "dark";
  role: string | null;
  /** Viewport width hint for the render host (`w`); resizing never reloads the frame. */
  width?: number;
};

export type RenderTarget = FrameTarget | StoryFrameTarget;

/** Whether a frame target is a story (prototype targets carry no `kind`). */
export function isStoryTarget<T extends object>(
  target: T
): target is Extract<T, { kind: "story" }> {
  return "kind" in target && target.kind === "story";
}

/**
 * The URL a target loads, or null when its story root has no server. Thumbnails pass no nonce
 * and use it as their scheduling key.
 */
export function frameHref(env: ShellEnv, target: RenderTarget, nonce?: string) {
  if (isStoryTarget(target)) {
    const endpoint = frameEndpoint(env, target.root);
    return endpoint ? storyHref(endpoint.renderUrl, { ...target, frame: nonce }) : null;
  }
  return renderHref(env.renderUrl, {
    slug: target.slug,
    state: target.state,
    theme: target.theme,
    role: target.role,
    w: target.width,
    frame: nonce,
    chrome: 0,
  });
}

/** A validated `context.url`: only these parameters are ever applied. */
export type FrameContext = {
  slug: string;
  state: string | null;
  theme: "light" | "dark" | null;
  role: string | null;
  w: number | null;
};

/** Accept catalog-confined frame context and normalize unsupported themes to no selection. */
function readContext(
  url: string,
  slugs: ReadonlySet<string>,
  roles: ReadonlySet<string>
): FrameContext | null {
  const context = readContextUrl(url, slugs, roles);
  if (!context) return null;
  const theme = context.theme === "light" || context.theme === "dark" ? context.theme : null;
  return { ...context, theme };
}

/** What identifies a document: a change loads a new one. Widths never reload a frame. */
export const keyOf = (target: RenderTarget) =>
  isStoryTarget(target)
    ? ["story", target.root, target.story, target.theme, target.play, target.timeout].join("\u0000")
    : [target.slug, target.state, target.theme, target.role ?? ""].join("\u0000");

export type Frame = {
  key: string;
  adopted: string | null;
  nonce: string;
  /** Null when the target's story root has no server; the frame then shows `story_root`. */
  src: string | null;
  /** The only origin this document's messages are accepted from, and the one it is posted to. */
  origin: string | null;
  status: FrameStatus;
  /**
   * The last `story:status` of a story document; a terminal result is never replaced by a later
   * report of the same document, only by a new document's first report.
   */
  result: StoryResult | null;
};

/** A fresh document for a target: new nonce, its root's origin, no result yet. */
export function loadFrame(env: ShellEnv, target: RenderTarget): Frame {
  const nonce = frameNonce();
  const root = isStoryTarget(target) ? target.root : null;
  const endpoint = frameEndpoint(env, root);
  const src = endpoint ? frameHref(env, target, nonce) : null;
  const status: FrameStatus =
    endpoint || root === null
      ? initialStatus
      : { kind: "error", message: root, componentStack: null, reason: "story_root" };
  const origin = endpoint?.origin ?? null;
  return { key: keyOf(target), adopted: null, nonce, src, origin, status, result: null };
}

/** An updater that changes only the frame still showing document `nonce`. */
export const forNonce =
  (nonce: string, change: (frame: Frame) => Frame) =>
  (current: Frame): Frame =>
    current.nonce === nonce ? change(current) : current;

type StoryStatus = Extract<RenderMessage, { type: "story:status" }>;

const resultOf = (message: StoryStatus): StoryResult => ({
  story: message.story,
  stage: message.stage,
  status: message.status,
  hasPlay: message.hasPlay,
  error: message.error,
  durationMs: message.durationMs,
});

/**
 * Apply a story document's lifecycle report. A story edit reloads the iframe in place (Vite
 * `full-reload`): the new document keeps the URL and nonce and opens with `import`/`running`,
 * which a document never sends twice. That report starts a new run, so the previous verdict and
 * failure card go (BR 7); within one document the first terminal result stays (Invariant 11).
 */
export function applyStoryStatus(current: Frame, message: StoryStatus): Frame {
  if (message.stage === "import" && message.status === "running")
    return { ...current, status: initialStatus, result: resultOf(message) };
  const settled = current.result !== null && current.result.status !== "running";
  return {
    ...current,
    status: nextStatus(current.status, message),
    result: settled ? current.result : resultOf(message),
  };
}

const authLoop: FrameStatus = {
  kind: "error",
  message: "auth_loop",
  componentStack: null,
  reason: "auth_loop",
};

/** The frame after the render grant kept expiring past the re-ticket budget. */
export const withAuthLoop = (current: Frame): Frame => ({ ...current, status: authLoop });

/** Record one `auth:expired`: whether a re-ticket fits the budget, and the attempts to keep. */
export function nextReticket(attempts: readonly number[], now: number) {
  const budget = allowReticket(attempts, now);
  return budget.allowed
    ? { allowed: true, attempts: [...budget.recent, now] }
    : { allowed: false, attempts: budget.recent };
}

/** Roles a `context` message may name: the registry's roles and every prototype's own. */
export function knownRoles(state: ReturnType<typeof useShellData>["registry"]) {
  if (state.status !== "ready") return new Set<string>();
  return new Set([
    ...Object.keys(state.registry.roles),
    ...state.registry.prototypes.flatMap(prototype => prototype.roles),
  ]);
}

/** Shell → render messages without the envelope the frame adds (`proto`, `frame`). */
export type ShellOutgoing = ShellMessage extends infer Message
  ? Message extends { proto: number; frame: string }
    ? Omit<Message, "proto" | "frame">
    : never
  : never;

/** Post to the frame's window at its root origin, under its nonce; nothing without a server. */
export function postToFrame(
  target: Window | null,
  frame: { origin: string | null; nonce: string },
  message: ShellOutgoing
) {
  if (frame.origin === null) return;
  target?.postMessage({ proto: 1, frame: frame.nonce, ...message }, frame.origin);
}

/** The frame state to show for target `key`: kept, adopted from `context`, or a new document. */
export function frameFor(frame: Frame, key: string, load: () => Frame) {
  if (frame.key === key) return frame;
  return key === frame.adopted ? { ...frame, key } : load();
}

/** The story a frame hosts, from its target's component slug and story id. */
export const storyOf = (slug: string | null, id: string | null) =>
  slug !== null && id !== null ? { slug, id } : null;

/**
 * The primitive parts of a target the hook's effects depend on: the hosted story (a story
 * document reports the component `slug` and story id `state` it was asked for) or the
 * prototype state a render ticket is requested for.
 */
export function targetParts(target: RenderTarget) {
  if (isStoryTarget(target))
    return { storySlug: target.slug, storyId: target.story, ticketFor: null };
  return { storySlug: null, storyId: null, ticketFor: `${target.slug}\u0000${target.state}` };
}

/** Still loading and not yet slow: the amber notice is still ahead. */
export const awaitsSlow = (status: FrameStatus) => status.kind === "loading" && !status.slow;

/** Forward a message to the frame's `onMessage` and its subscribers. */
export const forwardTo =
  (onMessage: ((message: RenderMessage) => void) | undefined, emit: (m: RenderMessage) => void) =>
  (message: RenderMessage) => {
    onMessage?.(message);
    emit(message);
  };

type Tickets = { next: (slug: string, state: string) => Promise<string>; invalidate: () => void };

/**
 * Request the render ticket of a prototype document; returns the cancel. A failure ends the
 * frame with the error, as a load failure would.
 */
export function requestTicket(
  tickets: Tickets | null,
  ticketFor: string | null,
  done: { ticket: (value: string) => void; update: (change: (frame: Frame) => Frame) => void }
) {
  if (!tickets || ticketFor === null) return undefined;
  const [slug = "", state = ""] = ticketFor.split("\u0000");
  let current = true;
  tickets.next(slug, state).then(
    value => {
      if (current) done.ticket(value);
    },
    (error: unknown) => {
      if (current)
        done.update(frame => ({
          ...frame,
          status: { kind: "error", message: String(error), componentStack: null },
        }));
    }
  );
  return () => {
    current = false;
  };
}

/**
 * The `auth:expired` handler of a ticketed frame: the render grant expired, so a fresh ticket
 * and a fresh load, within a budget (the prototype shares the render host's realm and can forge
 * the message on every load). Null for frames without tickets, which forward the message.
 */
export function reticketHandler(
  tickets: Tickets | null,
  attempts: { current: number[] },
  update: (change: (frame: Frame) => Frame) => void,
  reload: () => void
) {
  if (!tickets) return null;
  return () => {
    const next = nextReticket(attempts.current, Date.now());
    attempts.current = next.attempts;
    if (!next.allowed) {
      update(withAuthLoop);
      return;
    }
    tickets.invalidate();
    reload();
  };
}

/** A subscriber list for the frame's forwarded messages. */
export function createEmitter() {
  const listeners = new Set<(message: RenderMessage) => void>();
  return {
    emit: (message: RenderMessage) => {
      for (const listener of listeners) listener(message);
    },
    listen: (listener: (message: RenderMessage) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The document `src` with its render ticket; null while a remote frame waits for one. */
export function ticketedSrc(
  src: string | null,
  ticketed: boolean,
  ticket: { nonce: string; value: string } | null,
  nonce: string
) {
  if (!ticketed || src === null) return src;
  if (ticket?.nonce !== nonce) return null;
  return `${src}${src.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(ticket.value)}`;
}

/** Everything the message listener of one document needs. */
export type ListenerContext = {
  /** The window of the iframe this shell created, read when a message arrives. */
  source: () => Window | null;
  nonce: string;
  origin: string | null;
  /** The story the document hosts (component slug and story id); null for prototypes. */
  story: { slug: string; id: string } | null;
  slugs: ReadonlySet<string>;
  roles: ReadonlySet<string>;
  /** Change the frame of this document (already scoped to its nonce). */
  update: (change: (frame: Frame) => Frame) => void;
  onContext?: (context: FrameContext) => void;
  /** Messages beyond the frame lifecycle, for the frame's subscribers. */
  forward: (message: RenderMessage) => void;
  /** `auth:expired` handling of a ticketed frame; null when the frame takes no tickets. */
  onAuthExpired: (() => void) | null;
};

/** A `ready` counts only for the component and story a story frame asked for. */
function readyIsOwn(message: Extract<RenderMessage, { type: "ready" }>, context: ListenerContext) {
  const { story } = context;
  return story === null || (message.slug === story.slug && message.state === story.id);
}

function onContextMessage(
  message: Extract<RenderMessage, { type: "context" }>,
  context: ListenerContext
) {
  const frameContext = readContext(message.url, context.slugs, context.roles);
  if (!frameContext) return;
  const adopted = keyOf({
    slug: frameContext.slug,
    state: frameContext.state ?? message.state,
    theme: frameContext.theme ?? message.theme,
    role: frameContext.role ?? parsePreviewRole(message.role, context.roles),
  });
  context.update(current => ({ ...current, adopted }));
  context.onContext?.(frameContext);
}

/** Route one validated message of the current document. */
function handleMessage(message: RenderMessage, context: ListenerContext) {
  switch (message.type) {
    case "ready":
      if (readyIsOwn(message, context))
        context.update(current => ({ ...current, status: nextStatus(current.status, message) }));
      return;
    case "error":
      context.update(current => ({ ...current, status: nextStatus(current.status, message) }));
      return;
    case "story:status":
      // Only story documents report a lifecycle, and only for the story they host.
      if (context.story?.id !== message.story) return;
      context.update(current => applyStoryStatus(current, message));
      context.forward(message);
      return;
    case "context":
      onContextMessage(message, context);
      return;
    case "auth:expired":
      if (context.onAuthExpired) {
        context.onAuthExpired();
        return;
      }
      context.forward(message);
      return;
    default:
      context.forward(message);
  }
}

/**
 * The window `message` listener of one document: messages count only from the frame's own
 * window, its root origin and its current nonce (Safety Invariants 2 and 7).
 */
export function frameListener(context: ListenerContext) {
  return (event: MessageEvent) => {
    if (context.origin === null) return;
    const message = acceptRenderMessage(event, {
      source: context.source(),
      origin: context.origin,
      nonce: context.nonce,
    });
    if (message) handleMessage(message, context);
  };
}
