/**
 * Render side of the shell ⇄ render protocol (ADR-008). The host trusts only `window.parent`
 * whose origin equals the shell origin of its own configuration (`virtual:proto/render-config`,
 * never the URL) and only messages carrying the frame nonce the shell put in `?frame=`; every
 * payload is parsed with the `src/model` schemas. Outgoing messages are posted to that origin
 * only, so a foreign page that frames the render origin never receives them (Safety Invariant 7).
 */
import {
  protocolVersion,
  shellMessageSchema,
  type RenderMessage,
  type ShellMessage,
} from "../model/protocol.ts";

/** A render → shell message without its envelope. */
export type RenderPayload = WithoutEnvelope<RenderMessage>;
type WithoutEnvelope<M> = M extends unknown ? Omit<M, "proto" | "frame"> : never;

export type Bridge = {
  /** Whether the host is embedded with a nonce, i.e. a shell may be listening. */
  readonly connected: boolean;
  post(message: RenderPayload): void;
  /** Calls `handler` for every trusted, valid shell message; returns the unsubscribe. */
  listen(handler: (message: ShellMessage) => void): () => void;
};

type Endpoint = {
  /** The render host's window; its `parent` is the only accepted sender. */
  self: Window;
  shellOrigin: string;
  /** Frame nonce from `?frame=`; null outside a shell iframe. */
  frame: string | null;
};

export function createBridge({ self, shellOrigin, frame }: Endpoint): Bridge {
  const parent = self.parent;
  const connected = frame !== null && parent !== self;
  return {
    connected,
    post(message) {
      if (!connected) return;
      parent.postMessage({ ...message, proto: protocolVersion, frame }, shellOrigin);
    },
    listen(handler) {
      if (!connected) return () => {};
      const onMessage = (event: MessageEvent) => {
        if (event.source !== parent || event.origin !== shellOrigin) return;
        const parsed = shellMessageSchema.safeParse(event.data);
        if (!parsed.success || parsed.data.frame !== frame) return;
        handler(parsed.data);
      };
      self.addEventListener("message", onMessage);
      return () => self.removeEventListener("message", onMessage);
    },
  };
}
