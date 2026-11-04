/**
 * One render iframe and its channel: the render URL with a fresh frame nonce, the frame status
 * (`loading` → `ready` | `error`, amber after 10 s), `context` changes from the prototype and a
 * `send` for shell → render messages. Picking, anchors and scrolling (review slice) build on
 * `send` and `onMessage`; this hook never reads the iframe's document.
 *
 * A target is a prototype state (`FrameTarget`, on the render host) or a story
 * (`StoryFrameTarget`, on its root's story server). Each frame takes its origin from its own
 * target, so a story frame accepts messages only from its root's origin (Safety Invariant 2).
 * Render tickets apply to prototypes only.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

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
import {
  acceptRenderMessage,
  allowReticket,
  frameNonce,
  initialStatus,
  nextStatus,
  slowAfterMs,
  type FrameStatus,
} from "../lib/render-channel";
import { frameEndpoint, useShellData, type ShellEnv } from "../lib/shell-data";
import { useRenderTickets } from "../review/data";

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

type ShellOutgoing = ShellMessage extends infer Message
  ? Message extends { proto: number; frame: string }
    ? Omit<Message, "proto" | "frame">
    : never
  : never;

type Options = {
  /** Known slugs: a `context.url` naming anything else is ignored. */
  slugs: ReadonlySet<string>;
  /** The prototype changed its own state, theme, role or width (`setParam(s)`, `protoHref`). */
  onContext?: (context: FrameContext) => void;
  /** Validated messages beyond the lifecycle: `pick:result`, `anchors`, `auth:expired`. */
  onMessage?: (message: RenderMessage) => void;
};

const windowOf = (iframe: RefObject<HTMLIFrameElement | null>) =>
  iframe.current?.contentWindow ?? null;

/** What identifies a document: a change loads a new one. Widths never reload a frame. */
const keyOf = (target: RenderTarget) =>
  isStoryTarget(target)
    ? ["story", target.root, target.story, target.theme, target.play, target.timeout].join("\u0000")
    : [target.slug, target.state, target.theme, target.role ?? ""].join("\u0000");

type Frame = {
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

const resultOf = (message: Extract<RenderMessage, { type: "story:status" }>): StoryResult => ({
  story: message.story,
  stage: message.stage,
  status: message.status,
  hasPlay: message.hasPlay,
  error: message.error,
  durationMs: message.durationMs,
});

/**
 * The first report of every story document. A document never sends it again, so receiving it
 * after a result means the iframe now holds a new document under the same nonce.
 */
const isNewDocument = (message: Extract<RenderMessage, { type: "story:status" }>) =>
  message.stage === "import" && message.status === "running";

/** Own frame tickets, nonce-scoped messaging and navigation without reloading unchanged documents. */
export function useRenderFrame(
  iframe: RefObject<HTMLIFrameElement | null>,
  target: RenderTarget,
  options: Options
) {
  const env = useShellData();
  const { registry, session } = env;
  const story = isStoryTarget(target) ? target : null;
  // Remote galleries protect the render origin: each prototype load carries a short-lived
  // ticket. Stories exist only in dev and local static builds, so they never take one.
  const remoteTickets = useRenderTickets();
  const tickets = story ? null : remoteTickets;
  const [ticket, setTicket] = useState<{ nonce: string; value: string } | null>(null);
  const [messages] = useState(() => {
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
  });
  const key = keyOf(target);
  /** A fresh document for the current target: new nonce, its root's origin, no result yet. */
  const load = (): Frame => {
    const nonce = frameNonce();
    const endpoint = frameEndpoint(env, story?.root ?? null);
    const src = endpoint ? frameHref(env, target, nonce) : null;
    const status: FrameStatus =
      endpoint || !story
        ? initialStatus
        : { kind: "error", message: story.root, componentStack: null, reason: "story_root" };
    const origin = endpoint?.origin ?? null;
    return { key, adopted: null, nonce, src, origin, status, result: null };
  };
  const [frame, setFrame] = useState<Frame>(load);

  // A target the frame already shows (it reported it as `context`) keeps the frame; any other
  // target loads a new document with a new nonce, so late messages of the old one are stale.
  if (frame.key !== key) {
    if (key === frame.adopted) setFrame({ ...frame, key });
    else setFrame(load());
  }

  /** Replay: the same target in a fresh document with a new nonce (the old one turns stale). */
  const reload = () => setFrame(load());

  const reloadRef = useRef(reload);
  /** Times this frame re-ticketed after `auth:expired` (see `allowReticket`). */
  const retickets = useRef<number[]>([]);
  useEffect(() => {
    reloadRef.current = reload;
  });

  const { nonce, origin } = frame;
  const { slugs, onContext, onMessage } = options;
  /** A story document reports the component (`slug`) and story id (`state`) it was asked for. */
  const storySlug = story?.slug ?? null;
  const storyId = story?.story ?? null;
  useEffect(() => {
    const knownRoles = new Set(
      registry.status === "ready"
        ? [
            ...Object.keys(registry.registry.roles),
            ...registry.registry.prototypes.flatMap(prototype => prototype.roles),
          ]
        : []
    );
    /** Accept messages only from the current frame window, its root origin and nonce before updating frame state. */
    const listen = (event: MessageEvent) => {
      if (origin === null) return;
      const message = acceptRenderMessage(event, { source: windowOf(iframe), origin, nonce });
      if (!message) return;
      if (message.type === "ready" || message.type === "error") {
        if (
          message.type === "ready" &&
          storyId !== null &&
          (message.slug !== storySlug || message.state !== storyId)
        )
          return;
        setFrame(current =>
          current.nonce === nonce
            ? { ...current, status: nextStatus(current.status, message) }
            : current
        );
        return;
      }
      if (message.type === "story:status") {
        // Only story documents report a lifecycle, and only for the story they host.
        if (storyId === null || message.story !== storyId) return;
        setFrame(current => {
          if (current.nonce !== nonce) return current;
          // A story edit reloads the iframe in place (Vite `full-reload`): the new document keeps
          // the URL and nonce and opens with `import`/`running`. That report starts a new run, so
          // the previous document's verdict and failure card go (BR 7). Within one document the
          // first terminal result stays (Invariant 11).
          if (isNewDocument(message))
            return { ...current, status: initialStatus, result: resultOf(message) };
          return {
            ...current,
            status: nextStatus(current.status, message),
            result:
              current.result && current.result.status !== "running"
                ? current.result
                : resultOf(message),
          };
        });
        onMessage?.(message);
        messages.emit(message);
        return;
      }
      if (message.type === "context") {
        const context = readContext(message.url, slugs, knownRoles);
        if (!context) return;
        const adopted = keyOf({
          slug: context.slug,
          state: context.state ?? message.state,
          theme: context.theme ?? message.theme,
          role: context.role ?? parsePreviewRole(message.role, knownRoles),
        });
        setFrame(current => (current.nonce === nonce ? { ...current, adopted } : current));
        onContext?.(context);
        return;
      }
      if (message.type === "auth:expired" && tickets) {
        // The render grant expired: a fresh ticket and a fresh load, within a budget.
        const budget = allowReticket(retickets.current, Date.now());
        if (!budget.allowed) {
          retickets.current = budget.recent;
          setFrame(current =>
            current.nonce === nonce
              ? {
                  ...current,
                  status: {
                    kind: "error",
                    message: "auth_loop",
                    componentStack: null,
                    reason: "auth_loop",
                  },
                }
              : current
          );
          return;
        }
        retickets.current = [...budget.recent, Date.now()];
        tickets.invalidate();
        reloadRef.current();
        return;
      }
      onMessage?.(message);
      messages.emit(message);
    };
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

  const loading = frame.status.kind === "loading" && !frame.status.slow;
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setFrame(current =>
        current.nonce === nonce
          ? { ...current, status: nextStatus(current.status, "slow") }
          : current
      );
    }, slowAfterMs);
    return () => clearTimeout(timer);
  }, [loading, nonce]);

  const send = (message: ShellOutgoing) => {
    if (origin === null) return;
    windowOf(iframe)?.postMessage({ proto: 1, frame: nonce, ...message }, origin);
  };

  /** Moves keyboard focus into the frame (keyboard picking starts from a focused frame). */
  const focus = () => iframe.current?.focus();

  const ticketState = isStoryTarget(target) ? null : target.state;
  useEffect(() => {
    if (!tickets || ticketState === null) return;
    let current = true;
    tickets.next(target.slug, ticketState).then(
      value => {
        if (current) setTicket({ nonce, value });
      },
      (error: unknown) => {
        if (current)
          setFrame(state =>
            state.nonce === nonce
              ? {
                  ...state,
                  status: { kind: "error", message: String(error), componentStack: null },
                }
              : state
          );
      }
    );
    return () => {
      current = false;
    };
  }, [tickets, nonce, target.slug, ticketState]);

  /** Null while a remote frame waits for its render ticket. */
  const src =
    !tickets || frame.src === null
      ? frame.src
      : ticket?.nonce === nonce
        ? `${frame.src}${frame.src.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(ticket.value)}`
        : null;

  return {
    src,
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
