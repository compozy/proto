export type ReviewNotification =
  | { type: "comments" | "review"; key: string }
  | { type: "registry"; key?: string };
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
        const unsubscribe = this.subscribe(event => {
          if ((controller.desiredSize ?? 0) < -100) {
            stop();
            controller.close();
            return;
          }
          controller.enqueue(
            encoder.encode(
              `event: ${event.type}\ndata: ${JSON.stringify(event.key ? { key: event.key } : {})}\n\n`
            )
          );
        });
        const abort = () => {
          stop();
          controller.close();
        };
        stop = () => {
          unsubscribe();
          signal.removeEventListener("abort", abort);
        };
        if (signal.aborted) abort();
        else {
          signal.addEventListener("abort", abort, { once: true });
          controller.enqueue(encoder.encode(": connected\n\n"));
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
