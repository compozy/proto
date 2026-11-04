export type ReviewNotification =
  | { type: "comments" | "review"; key: string }
  | { type: "registry"; key?: string }
  | { type: "snapshot"; id: string };
/** Runtime-agnostic event fanout. The host connects registry and filesystem watchers. */
export class ReviewEvents {
  private listeners = new Set<(event: ReviewNotification) => void>();
  publish(event: ReviewNotification) {
    for (const listener of this.listeners) listener(event);
  }
  subscribe(listener: (event: ReviewNotification) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  response(signal: AbortSignal) {
    let stop = () => {};
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start: controller => {
        let closed = false;
        const close = () => {
          if (closed) return;
          stop();
          controller.close();
        };
        const enqueue = (text: string) => {
          if (closed) return;
          if ((controller.desiredSize ?? 0) < -100) {
            close();
            return;
          }
          controller.enqueue(encoder.encode(text));
        };
        const unsubscribe = this.subscribe(event => {
          const data =
            event.type === "snapshot" ? { id: event.id } : event.key ? { key: event.key } : {};
          enqueue(`event: ${event.type}\ndata: ${JSON.stringify(data)}\n\n`);
        });
        const timer = setInterval(() => enqueue(": ping\n\n"), 25000);
        timer.unref?.();
        stop = () => {
          closed = true;
          clearInterval(timer);
          unsubscribe();
          signal.removeEventListener("abort", close);
        };
        if (signal.aborted) close();
        else {
          signal.addEventListener("abort", close, { once: true });
          enqueue(": connected\n\n");
        }
      },
      cancel: () => stop(),
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }
}
