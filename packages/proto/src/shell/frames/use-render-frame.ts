/**
 * One render iframe and its channel: the render URL with a fresh frame nonce, the frame status
 * (`loading` → `ready` | `error`, amber after 10 s), `context` changes from the prototype and a
 * `send` for shell → render messages. Picking, anchors and scrolling (review slice) build on
 * `send` and `onMessage`; this hook never reads the iframe's document.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

import {
  readContextUrl,
  renderHref,
  type RenderMessage,
  type ShellMessage,
} from "../../model/protocol";
import {
  acceptRenderMessage,
  frameNonce,
  initialStatus,
  nextStatus,
  slowAfterMs,
  type FrameStatus,
} from "../lib/render-channel";
import { useShellData } from "../lib/shell-data";
import { useRenderTickets } from "../review/data";

export type FrameTarget = {
  slug: string;
  state: string;
  theme: "light" | "dark";
  role: string | null;
  /** Viewport width hint for the render host (`w`); resizing never reloads the frame. */
  width?: number;
};

/** A validated `context.url`: only these parameters are ever applied. */
export type FrameContext = {
  slug: string;
  state: string | null;
  theme: "light" | "dark" | null;
  role: string | null;
  w: number | null;
};

function readContext(url: string, slugs: ReadonlySet<string>): FrameContext | null {
  const context = readContextUrl(url, slugs);
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

const keyOf = (target: Pick<FrameTarget, "slug" | "state" | "theme" | "role">) =>
  [target.slug, target.state, target.theme, target.role ?? ""].join("\u0000");

type Frame = {
  key: string;
  adopted: string | null;
  nonce: string;
  src: string;
  status: FrameStatus;
};

export function useRenderFrame(
  iframe: RefObject<HTMLIFrameElement | null>,
  target: FrameTarget,
  options: Options
) {
  const { renderUrl, renderOrigin } = useShellData();
  // Remote galleries protect the render origin: each load carries a short-lived ticket.
  const tickets = useRenderTickets();
  const [ticket, setTicket] = useState<{ nonce: string; value: string } | null>(null);
  const key = keyOf(target);
  const load = (nonce: string) =>
    renderHref(renderUrl, {
      slug: target.slug,
      state: target.state,
      theme: target.theme,
      role: target.role,
      w: target.width,
      frame: nonce,
      chrome: 0,
    });
  const [frame, setFrame] = useState<Frame>(() => {
    const nonce = frameNonce();
    return { key, adopted: null, nonce, src: load(nonce), status: initialStatus };
  });

  // A target the frame already shows (it reported it as `context`) keeps the frame; any other
  // target loads a new document with a new nonce, so late messages of the old one are stale.
  if (frame.key !== key) {
    if (key === frame.adopted) setFrame({ ...frame, key });
    else {
      const nonce = frameNonce();
      setFrame({ key, adopted: null, nonce, src: load(nonce), status: initialStatus });
    }
  }

  const reload = () => {
    const nonce = frameNonce();
    setFrame({ key, adopted: null, nonce, src: load(nonce), status: initialStatus });
  };

  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });

  const { nonce } = frame;
  const { slugs, onContext, onMessage } = options;
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      const message = acceptRenderMessage(event, {
        source: windowOf(iframe),
        origin: renderOrigin,
        nonce,
      });
      if (!message) return;
      if (message.type === "ready" || message.type === "error") {
        setFrame(current =>
          current.nonce === nonce
            ? { ...current, status: nextStatus(current.status, message) }
            : current
        );
        return;
      }
      if (message.type === "context") {
        const context = readContext(message.url, slugs);
        if (!context) return;
        const adopted = keyOf({
          slug: context.slug,
          state: context.state ?? message.state,
          theme: context.theme ?? message.theme,
          role: context.role ?? message.role,
        });
        setFrame(current => (current.nonce === nonce ? { ...current, adopted } : current));
        onContext?.(context);
        return;
      }
      if (message.type === "auth:expired" && tickets) {
        // The render grant expired: a fresh ticket and a fresh load.
        tickets.invalidate();
        reloadRef.current();
        return;
      }
      onMessage?.(message);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [iframe, nonce, renderOrigin, slugs, onContext, onMessage, tickets]);

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
    windowOf(iframe)?.postMessage({ proto: 1, frame: nonce, ...message }, renderOrigin);
  };

  /** Moves keyboard focus into the frame (keyboard picking starts from a focused frame). */
  const focus = () => iframe.current?.focus();

  useEffect(() => {
    if (!tickets) return;
    let current = true;
    tickets.next(target.slug, target.state).then(
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
  }, [tickets, nonce, target.slug, target.state]);

  /** Null while a remote frame waits for its render ticket. */
  const src = !tickets
    ? frame.src
    : ticket?.nonce === nonce
      ? `${frame.src}${frame.src.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(ticket.value)}`
      : null;

  return { src, nonce, status: frame.status, reload, send, focus };
}

export type RenderFrameHandle = ReturnType<typeof useRenderFrame>;
