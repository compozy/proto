import { createServer, type OutgoingHttpHeaders, type ServerResponse } from "node:http";
import type { Socket } from "node:net";

const bodyLimit = 5 * 1024 * 1024 + 65536;

/** Loopback adapter for the two public tunnel hosts, including long-lived SSE responses. */
export async function serveHandler(
  handler: (request: Request) => Promise<Response>,
  options: { publicOrigin: string; renderOrigin: string; sessionId: string }
): Promise<{ port: number; close(): Promise<void> }> {
  const hosts = new Set([new URL(options.publicOrigin).host, new URL(options.renderOrigin).host]);
  const sockets = new Set<Socket>();
  const preconnects = new Set<Socket>();
  const streams = new Map<ServerResponse, AbortController>();
  let closing = false;
  let closed: Promise<void> | undefined;
  const server = createServer(async (req, res) => {
    preconnects.delete(req.socket);
    res.setHeader("X-Proto-Session", options.sessionId);
    const jsonError = (status: number, code: string, message: string) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code, message } }));
    };
    if (closing) {
      res.writeHead(503, { Connection: "close" });
      res.end();
      return;
    }
    if (!req.headers.host || !hosts.has(req.headers.host)) {
      jsonError(403, "host_not_allowed", "Host not allowed");
      return;
    }
    // Only origin-form paths are accepted: an absolute request target must not replace Host.
    if (!req.url?.startsWith("/") || req.url.startsWith("//")) {
      res.writeHead(400);
      res.end();
      return;
    }
    const abort = new AbortController();
    const disconnect = () => abort.abort();
    res.once("close", disconnect);
    req.once("aborted", disconnect);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const cancel = () => {
      void reader?.cancel().catch(() => {});
    };
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      // Do not destroy the socket on an over-limit early return: it must deliver the 413.
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        bytes += (chunk as Buffer).length;
        if (bytes > bodyLimit) {
          jsonError(413, "attachment_too_large", "Images are limited to 5 MB.");
          req.resume();
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      const response = await handler(
        new Request(`https://${req.headers.host}${req.url}`, {
          method: req.method,
          headers,
          signal: abort.signal,
          ...(!["GET", "HEAD"].includes(req.method ?? "GET")
            ? { body: Buffer.concat(chunks) }
            : {}),
        })
      );
      if (abort.signal.aborted) {
        await response.body?.cancel();
        return;
      }
      const responseHeaders: OutgoingHttpHeaders = Object.fromEntries(response.headers);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) responseHeaders["set-cookie"] = cookies;
      responseHeaders["x-proto-session"] = options.sessionId;
      res.writeHead(response.status, responseHeaders);
      const sse = response.headers.get("Content-Type")?.includes("text/event-stream");
      if (sse) {
        if (closing) {
          abort.abort();
          await response.body?.cancel();
          res.end();
          return;
        }
        streams.set(res, abort);
      }
      res.flushHeaders();
      if (response.body && req.method !== "HEAD") {
        reader = response.body.getReader();
        abort.signal.addEventListener("abort", cancel, { once: true });
        while (!abort.signal.aborted) {
          const part = await reader.read();
          if (part.done || abort.signal.aborted) break;
          if (!res.write(part.value)) {
            await new Promise<void>((resolve, reject) => {
              const cleanup = () => {
                res.off("drain", drain);
                res.off("close", drain);
                res.off("error", error);
              };
              const drain = () => {
                cleanup();
                resolve();
              };
              const error = (cause: Error) => {
                cleanup();
                reject(cause);
              };
              res.once("drain", drain);
              res.once("close", drain);
              res.once("error", error);
            });
          }
        }
      } else await response.body?.cancel();
      res.end();
    } catch {
      if (!res.headersSent && !res.destroyed)
        jsonError(500, "internal_error", "The review operation failed.");
      else if (!res.destroyed) res.destroy();
    } finally {
      abort.signal.removeEventListener("abort", cancel);
      if (reader) {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      streams.delete(res);
      res.off("close", disconnect);
      req.off("aborted", disconnect);
    }
  });
  server.on("connection", socket => {
    if (closing) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    preconnects.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
      preconnects.delete(socket);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing loopback server address");
  return {
    port: address.port,
    close() {
      closed ??= (async () => {
        closing = true;
        const stopped = new Promise<void>(resolve => server.close(() => resolve()));
        for (const socket of preconnects) socket.destroy();
        for (const [response, abort] of streams) {
          abort.abort();
          response.end();
        }
        server.closeIdleConnections();
        const deadline = setTimeout(() => {
          server.closeAllConnections();
          for (const socket of sockets) socket.destroy();
        }, 10_000);
        try {
          await stopped;
        } finally {
          clearTimeout(deadline);
        }
      })();
      return closed;
    },
  };
}
