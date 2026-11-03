import { getEventListeners, once } from "node:events";
import { request, type IncomingMessage } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { serveHandler } from "../../../src/share/http.ts";

const options = {
  publicOrigin: "https://proto.example.com",
  renderOrigin: "https://proto-render.example.com",
  sessionId: "session-123",
};
let server: Awaited<ReturnType<typeof serveHandler>> | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});
function open(port: number, host: string, path = "/", body?: Buffer) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: body ? "POST" : "GET",
        headers: { Host: host },
        agent: false,
      },
      resolve
    );
    req.on("error", reject);
    req.end(body);
  });
}
async function text(response: IncomingMessage) {
  let body = "";
  for await (const chunk of response) body += String(chunk);
  return body;
}

// Invariant: the tunnel adapter preserves the public origin, streams and cancellation while
// bounding bodies and shutdown. Owner: share HTTP transport; canonical suite: node/share/http.test.ts.
describe("IT-027: loopback HTTP adapter", () => {
  it("only configured hosts reach the handler, with their HTTPS URL and body", async () => {
    const seen: string[] = [];
    server = await serveHandler(async req => {
      seen.push(req.url);
      return Response.json({ url: req.url, body: await req.text() });
    }, options);
    for (const host of ["evil.example.com", `127.0.0.1:${server.port}`, "proto.example.com:443"]) {
      const denied = await open(server.port, host);
      expect(denied.statusCode).toBe(403);
      expect(denied.headers["x-proto-session"]).toBe(options.sessionId);
      await text(denied);
    }
    expect(seen).toEqual([]);
    for (const host of ["proto.example.com", "proto-render.example.com"]) {
      const response = await open(server.port, host, "/path?q=one", Buffer.from("payload"));
      expect(JSON.parse(await text(response))).toEqual({
        url: `https://${host}/path?q=one`,
        body: "payload",
      });
      expect(response.headers["x-proto-session"]).toBe(options.sessionId);
    }
  });
  it("preserves separate Set-Cookie values and overrides the handler session header", async () => {
    const cookies = [
      "first=one; Path=/; HttpOnly; Secure",
      "second=two; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/; Secure",
    ];
    server = await serveHandler(async () => {
      const headers = new Headers({ "X-Proto-Session": "handler-value", "X-Custom": "kept" });
      for (const cookie of cookies) headers.append("Set-Cookie", cookie);
      return new Response("cookies", { headers });
    }, options);
    const response = await open(server.port, "proto.example.com");
    expect(response.headers["set-cookie"]).toEqual(cookies);
    expect(response.headers["x-proto-session"]).toBe(options.sessionId);
    expect(response.headers["x-custom"]).toBe("kept");
    expect(await text(response)).toBe("cookies");
  });
  it("absolute request targets cannot change the handler origin", async () => {
    server = await serveHandler(async () => {
      throw new Error("must not reach handler");
    }, options);
    const response = await open(server.port, "proto.example.com", "https://evil.example.com/path");
    expect(response.statusCode).toBe(400);
    expect(response.headers["x-proto-session"]).toBe(options.sessionId);
    await text(response);
  });
  it("body limit delivers the dev 413 envelope and accepts the exact boundary", async () => {
    let calls = 0;
    server = await serveHandler(async req => {
      calls++;
      return new Response(String((await req.arrayBuffer()).byteLength));
    }, options);
    const limit = 5 * 1024 * 1024 + 65536;
    const allowed = await open(server.port, "proto.example.com", "/upload", Buffer.alloc(limit));
    expect(allowed.statusCode).toBe(200);
    expect(await text(allowed)).toBe(String(limit));
    const denied = await open(server.port, "proto.example.com", "/upload", Buffer.alloc(limit + 1));
    expect(denied.statusCode).toBe(413);
    expect(denied.headers["x-proto-session"]).toBe(options.sessionId);
    expect(JSON.parse(await text(denied))).toEqual({
      error: { code: "attachment_too_large", message: "Images are limited to 5 MB." },
    });
    expect(calls).toBe(1);
  });
  it("SSE arrives before completion; disconnect aborts and releases the stream listener", async () => {
    let signal: AbortSignal | undefined;
    let cancelled = false;
    let reportAbort = () => {};
    const aborted = new Promise<void>(resolve => {
      reportAbort = resolve;
    });
    let reportCancel = () => {};
    const cancellation = new Promise<void>(resolve => {
      reportCancel = resolve;
    });
    server = await serveHandler(async req => {
      signal = req.signal;
      req.signal.addEventListener("abort", reportAbort, { once: true });
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(": connected\n\n"));
          },
          cancel() {
            cancelled = true;
            reportCancel();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } }
      );
    }, options);
    const response = await open(server.port, "proto.example.com", "/events");
    const [chunk] = await once(response, "data");
    expect(String(chunk)).toContain(": connected");
    expect(response.complete).toBe(false);
    response.destroy();
    await Promise.all([aborted, cancellation]);
    expect(signal?.aborted).toBe(true);
    expect(cancelled).toBe(true);
    expect(getEventListeners(signal!, "abort")).toHaveLength(0);
  });
  it("close ends open SSE, aborts its handler and is idempotent", async () => {
    let signal: AbortSignal | undefined;
    server = await serveHandler(async req => {
      signal = req.signal;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(": ready\n\n"));
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } }
      );
    }, options);
    const response = await open(server.port, "proto.example.com", "/events");
    await once(response, "data");
    const ended = once(response, "end");
    await Promise.all([server.close(), server.close(), ended]);
    expect(signal?.aborted).toBe(true);
  }, 12_000);
  it("handler errors retain the session readiness header without leaking details", async () => {
    server = await serveHandler(async () => {
      throw new Error("secret");
    }, options);
    const response = await open(server.port, "proto.example.com");
    expect(response.statusCode).toBe(500);
    expect(response.headers["x-proto-session"]).toBe(options.sessionId);
    expect(await text(response)).not.toContain("secret");
  });
});
