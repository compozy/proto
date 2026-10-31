/**
 * Live preview of a prototype state inside a flow node: the gallery `Frame`, made inert (pointer,
 * wheel and keyboard reach the node, never the prototype) and scaled from a 1440 × 900 page. It
 * trusts only same-origin status messages from its own iframe; no "ready" in 10 s is a failure.
 * `onSettle` reports the end of loading (ready or failed), so the canvas can start the next one.
 */
import { useEffect, useEffectEvent, useReducer, useRef } from "react";

import { Frame } from "../frame";
import { acceptFrameStatus, nextPreviewStatus, previewTimeoutMs } from "../frame-status";

const page = { width: 1440, height: 900 };

type PreviewFrameProps = {
  src: string;
  title: string;
  width: number;
  height: number;
  onSettle: () => void;
};

export function PreviewFrame({ src, title, width, height, onSettle }: PreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [status, dispatch] = useReducer(nextPreviewStatus, "loading");

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const next = acceptFrameStatus(
        event,
        frameRef.current?.contentWindow ?? null,
        window.location.origin
      );
      if (next) dispatch(next);
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => dispatch("timeout"), previewTimeoutMs);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, []);

  const settle = useEffectEvent(() => onSettle());
  const loading = status === "loading";
  useEffect(() => {
    if (!loading) settle();
  }, [loading]);

  if (status === "error") {
    return (
      <p
        className="flex h-full items-center justify-center px-3 text-center text-[12px] text-muted-foreground"
        data-testid="flow-preview-error"
      >
        Prototype did not load
      </p>
    );
  }

  const scale = width / page.width;
  return (
    <div
      inert
      className="pointer-events-none relative h-full w-full select-none"
      aria-hidden
      data-preview-status={status}
    >
      <Frame
        src={src}
        title={title}
        width={page.width}
        height={Math.ceil(height / scale)}
        scale={scale}
        onFrame={element => {
          frameRef.current = element;
        }}
        tabIndex={-1}
      />
      {status === "loading" ? (
        <span className="absolute inset-0 flex items-center justify-center bg-background text-[11px] text-muted-foreground">
          Loading…
        </span>
      ) : null}
    </div>
  );
}
