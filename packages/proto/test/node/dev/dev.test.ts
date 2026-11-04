import type { HmrContext } from "vite";
import { storyPlugins } from "../../../src/vite/stories.ts";
import { join } from "node:path";
import { checkStorybookPeers, storyViteConfig } from "../../../src/node/story-server.ts";
import { storyHref, storyResultSchema, type StoryResult } from "../../../src/model/protocol.ts";
import { onFreePorts } from "../ports.ts";
import { appFixture, appFiles, storiesFixture } from "../app-fixture.ts";
async function readEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expected: string,
  accept: (text: string) => boolean = () => true
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const collected = (async () => {
    let text = "";
    const decoder = new TextDecoder();
    while (!text.includes(expected) || !accept(text)) {
      const part = await reader.read();
      if (part.done) throw new Error("SSE closed before " + expected);
      text += decoder.decode(part.value, { stream: true });
    }
    return text;
  })();
  try {
    return await Promise.race([
      collected,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("SSE deadline: " + expected)), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
import { createConnection, createServer } from "node:net";
import { once } from "node:events";
import { request } from "node:http";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { loadProject } from "../../../src/node/project.ts";
import { startDev, hostAllowed } from "../../../src/node/dev.ts";
import { bootstrapSchema } from "../../../src/model/bootstrap.ts";
let app: string;
import { freePortPair as port } from "../ports.ts";
import { chromium, type Browser } from "playwright";
import { existsSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
let sharedBrowser: Browser | undefined;
beforeAll(async () => {
  app = appFixture("proto-dev-app-", appFiles);
  if (existsSync(chromium.executablePath()))
    sharedBrowser = await chromium.launch({ handleSIGINT: false });
}, 60000);
afterAll(async () => {
  await sharedBrowser?.close();
  rmSync(app, { recursive: true, force: true });
}, 30000);
function hostRequest(port: number, host: string) {
  return new Promise<{ status: number; location?: string; body: string }>((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path: "/", headers: { host } }, res => {
      let body = "";
      res.on("data", chunk => {
        body += String(chunk);
      });
      res.on("end", () =>
        resolve({ status: res.statusCode!, location: res.headers.location, body })
      );
    });
    req.on("error", reject);
    req.end();
  });
}
it("UT-094: configured host:port entries fail clearly instead of silently missing", async () => {
  const { resolveProtoConfig } = await import("../../../src/config.ts");
  expect(() =>
    resolveProtoConfig({ title: "Hosts", dev: { allowedHosts: ["preview.test:4400"] } }, app)
  ).toThrowError(
    expect.objectContaining({
      code: "invalid_config",
      message: expect.stringContaining("dev.allowedHosts entries must be hostnames without ports"),
    })
  );
});
it("UT-094: allowlisted hostnames are bound to each server's own port", () => {
  expect(hostAllowed("preview.test:4400", 4400, ["preview.test"])).toBe(true);
  expect(hostAllowed("preview.test:4401", 4401, ["preview.test"])).toBe(true);
  expect(hostAllowed("preview.test:4400", 4401, ["preview.test"])).toBe(false);
  expect(hostAllowed("preview.test", 4400, ["preview.test"])).toBe(false);
});
it("UT-094 and IT-013 serve bootstrap, registry and render HTML with host confinement", async () => {
  const selected = await port();
  const server = await startDev(await loadProject(app), { port: selected });
  try {
    const bootstrap = bootstrapSchema.parse(
      await (await fetch(`${server.origin}/__proto/bootstrap.json`)).json()
    );
    const shell = await fetch(server.origin);
    // The local bridge accepts only a parsed, exact origin; CLI requests may omit it.
    for (const origin of ["http://foreign.test", `${server.origin}.evil.test`, "null"]) {
      const denied = await fetch(server.origin, { headers: { Origin: origin } });
      expect(denied.status).toBe(403);
      expect(await denied.json()).toMatchObject({ error: { code: "origin_not_allowed" } });
    }
    expect((await fetch(server.origin, { headers: { Origin: server.origin } })).status).toBe(200);
    expect(shell.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    const rendered = await fetch(`${server.renderOrigin}/__proto/render/login-form`);
    expect(rendered.headers.get("content-security-policy")).toBe(
      `frame-ancestors ${server.origin}`
    );
    expect(bootstrap.renderUrl).toBe(`${server.renderOrigin}/__proto/render/`);
    const virtual = await (
      await fetch(`${server.renderOrigin}/@id/__x00__virtual:proto/prototypes`)
    ).text();
    expect(virtual).toContain("login-form");
    const registry = await (await fetch(`${server.origin}/__proto/api/registry`)).json();
    expect(registry.prototypes.map((p: { slug: string }) => p.slug)).toEqual(
      expect.arrayContaining(["login-form", "welcome"])
    );
    expect(registry.flows.length).toBeGreaterThan(0);
    expect(
      await (await fetch(`${server.renderOrigin}/__proto/render/login-form`)).text()
    ).toContain('<div id="root"></div>');
    for (const p of [selected, selected + 1]) {
      const denied = await hostRequest(p, "evil.example");
      expect(denied.status).toBe(403);
      expect(JSON.parse(denied.body).error.code).toBe("host_not_allowed");
      expect(await hostRequest(p, `localhost:${p}`)).toMatchObject({
        status: 302,
        location: `http://127.0.0.1:${p}/`,
      });
    }
  } finally {
    await server.close();
  }
}, 120000);
it("UT-069 busy ports name the pair", async () => {
  const occupied = createServer();
  await new Promise<void>(r => occupied.listen(0, "127.0.0.1", r));
  const p = (occupied.address() as { port: number }).port;
  try {
    await expect(startDev(await loadProject(app), { port: p })).rejects.toMatchObject({
      code: "port_in_use",
      message: expect.stringContaining(`Ports ${p} and ${p + 1}`),
    });
  } finally {
    await new Promise<void>(r => occupied.close(() => r()));
  }
}, 120000);
it("shutdown drains accepted writes and refuses SSE reconnects while the render server closes", async () => {
  // Invariant: shutdown drains accepted writes, refuses reconnects and releases idle preconnects.
  // Owner: dev server lifecycle; real HTTP/SSE and a consumer Vite plugin with a filesystem barrier.
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = appFixture("proto-dev-shutdown-");
  const entered = join(root, "closing");
  const release = join(root, "release");
  writeFileSync(join(root, "proto.config.ts"), 'export default {title:"Shutdown"};');
  mkdirSync(join(root, "src"));
  writeFileSync(
    join(root, "src/login-form.proto.tsx"),
    'export const meta=definePrototype({title:"Login",states:[{id:"default",label:"Default"}]}); export default function Prototype(){return null;}'
  );
  writeFileSync(
    join(root, "vite.config.ts"),
    `
    import {existsSync, writeFileSync} from "node:fs";
    export default {plugins: [{name: "consumer-cleanup", async closeBundle() {
      writeFileSync(${JSON.stringify(entered)}, "ready");
      while (!existsSync(${JSON.stringify(release)})) await new Promise(done => setTimeout(done, 10));
    }}]};
  `
  );
  const abort = new AbortController();
  let server: Awaited<ReturnType<typeof startDev>> | undefined;
  let closing: Promise<void> | undefined;
  let preconnect: ReturnType<typeof createConnection> | undefined;
  let pendingRequest: ReturnType<typeof request> | undefined;
  try {
    const project = await loadProject(root);
    server = await startDev(project, { port: await port(), quiet: true });
    preconnect = createConnection(Number(new URL(server.origin).port), "127.0.0.1");
    await once(preconnect, "connect");
    const events = `${server.origin}/__proto/api/events`;
    const reader = (await fetch(events, { signal: abort.signal })).body!.getReader();
    await readEvent(reader, ": registry-watcher-ready");
    const body = JSON.stringify({
      key: "login-form",
      body: "Accepted before shutdown",
      context: {
        state: "default",
        theme: "light",
        role: null,
        viewport: { width: 1440, height: 900 },
      },
      target: { kind: "node", node: null, label: "Whole view" },
    });
    const response = new Promise<{ status?: number; body?: string; error?: Error }>(resolve => {
      pendingRequest = request(
        `${server!.origin}/__proto/api/comments`,
        {
          method: "POST",
          headers: {
            Origin: server!.origin,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            Expect: "100-continue",
          },
        },
        result => {
          let body = "";
          result.setEncoding("utf8");
          result.on("data", chunk => {
            body += chunk;
          });
          result.once("end", () => resolve({ status: result.statusCode, body }));
        }
      );
      pendingRequest.once("error", error => resolve({ error }));
    });
    const accepted = once(pendingRequest!, "continue");
    pendingRequest!.flushHeaders();
    await accepted;
    closing = server.close();
    await expect.poll(() => existsSync(entered)).toBe(true);
    expect((await reader.read()).done).toBe(true);
    await expect.poll(() => preconnect!.destroyed).toBe(true);
    await expect(fetch(events, { signal: abort.signal })).rejects.toThrow();
    pendingRequest!.end(body);
    const outcome = await response;
    expect(outcome, JSON.stringify(outcome)).toMatchObject({ status: 201 });
    expect(await project.store().list()).toHaveLength(1);
  } finally {
    abort.abort();
    preconnect?.destroy();
    pendingRequest?.destroy();
    writeFileSync(release, "continue");
    await (closing ?? server?.close());
    rmSync(root, { recursive: true, force: true });
  }
}, 120000);
it.each([false, true])(
  "shutdown finishes when a stalled SSE client disconnects=%s",
  async disconnect => {
    // Invariant: an unread SSE backlog or disconnect cannot hold shutdown indefinitely.
    // Owner: dev lifecycle; a real HTTP socket stops reading while the host publishes a large event.
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = appFixture("proto-dev-sse-shutdown-");
    writeFileSync(join(root, "proto.config.ts"), 'export default {title:"SSE shutdown"};');
    writeFileSync(join(root, "vite.config.ts"), "export default {};");
    const server = await startDev(await loadProject(root), { port: await port(), quiet: true });
    const client = request(`${server.origin}/__proto/api/events`);
    const received = once(client, "response");
    client.end();
    const [stream] = (await received) as [import("node:http").IncomingMessage];
    let closing: Promise<void> | undefined;
    try {
      stream.pause();
      stream.socket.pause();
      server.publish("registry", { backlog: "x".repeat(16 * 1024 * 1024) });
      let closed = false;
      closing = server.close().then(() => {
        closed = true;
      });
      if (disconnect) stream.destroy();
      await expect.poll(() => closed, { timeout: 5000 }).toBe(true);
      await closing;
    } finally {
      stream.destroy();
      client.destroy();
      if (!closing) await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
  120000
);
it("shutdown rejects an SSE request pipelined on an accepted HTTP connection", async () => {
  // Invariant: no event stream can join shutdown after its initial SSE drain, even on a reused socket.
  // Owner: dev lifecycle; real HTTP pipelining behind an accepted, unfinished upload.
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = appFixture("proto-dev-pipelined-sse-");
  writeFileSync(join(root, "proto.config.ts"), 'export default {title:"Pipelined SSE"};');
  writeFileSync(join(root, "vite.config.ts"), "export default {};");
  const server = await startDev(await loadProject(root), { port: await port(), quiet: true });
  const host = new URL(server.origin).host;
  const client = createConnection(Number(new URL(server.origin).port), "127.0.0.1");
  let response = "";
  client.setEncoding("utf8");
  client.on("data", chunk => {
    response += chunk;
  });
  let closing: Promise<void> | undefined;
  try {
    await once(client, "connect");
    client.write(
      `POST /__proto/api/unknown HTTP/1.1\r\nHost: ${host}\r\nContent-Length: 1\r\nExpect: 100-continue\r\n\r\n`
    );
    await expect.poll(() => response.includes("HTTP/1.1 100 Continue")).toBe(true);
    closing = server.close();
    client.write(`xGET /__proto/api/events HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
    await expect.poll(() => response).toContain("HTTP/1.1 503");
    expect(response).not.toContain("text/event-stream");
    await closing;
  } finally {
    client.destroy();
    await (closing ?? server.close());
    rmSync(root, { recursive: true, force: true });
  }
}, 120000);
it("shutdown bounds an accepted HTTP request that never completes", async () => {
  // Invariant: an accepted but stalled upload cannot keep the dev host open indefinitely.
  // Owner: dev lifecycle; real HTTP 100 Continue confirms acceptance before shutdown starts.
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = appFixture("proto-dev-stalled-upload-");
  writeFileSync(join(root, "proto.config.ts"), 'export default {title:"Stalled upload"};');
  writeFileSync(join(root, "vite.config.ts"), "export default {};");
  const server = await startDev(await loadProject(root), { port: await port(), quiet: true });
  const client = request(`${server.origin}/__proto/api/comments`, {
    method: "POST",
    headers: { Expect: "100-continue", "Content-Length": 1024, Origin: server.origin },
  });
  const errors: Error[] = [];
  client.on("error", error => errors.push(error));
  let closing: Promise<void> | undefined;
  try {
    const accepted = once(client, "continue");
    client.flushHeaders();
    await accepted;
    let closed = false;
    closing = server.close().then(() => {
      closed = true;
    });
    await expect.poll(() => closed && client.destroyed, { timeout: 15000 }).toBe(true);
    expect(errors).toContainEqual(expect.objectContaining({ code: "ECONNRESET" }));
  } finally {
    client.destroy();
    await (closing ?? server.close());
    rmSync(root, { recursive: true, force: true });
  }
}, 120000);
it("IT-011 registry SSE follows prototype changes within two seconds", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = mkdtempSync(join(tmpdir(), "proto-sse-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "proto.config.ts"), 'export default { title:"SSE" };');
  writeFileSync(join(root, "vite.config.ts"), "export default {};");
  let server: Awaited<ReturnType<typeof startDev>> | undefined;
  const abort = new AbortController();
  try {
    server = await startDev(await loadProject(root), { port: await port() });
    const response = await fetch(`${server.origin}/__proto/api/events`, { signal: abort.signal });
    const reader = response.body!.getReader();
    await readEvent(reader, ": registry-watcher-ready");
    const changedAt = performance.now();
    writeFileSync(
      join(root, "src/new.proto.tsx"),
      'export const meta=definePrototype({title:"New",states:[{id:"idle",label:"Idle"}]});'
    );
    expect(await readEvent(reader, "event: registry")).toContain("event: registry");
    expect(performance.now() - changedAt).toBeLessThanOrEqual(2000);
    abort.abort();
  } finally {
    abort.abort();
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 120000);

// Owner: real dev host; invariant: review writes reach the app store and the shared SSE stream.
it("IT-001 / IT-003: real startDev persists shell comments, emits SSE and rejects foreign writes", async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = await mkdtemp(join(tmpdir(), "proto-review-dev-"));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "proto.config.ts"),
    'export default { title: "Review", dev: { poll: true } };'
  );
  await writeFile(join(root, "vite.config.ts"), "export default {};");
  await writeFile(
    join(root, "src/login-form.proto.tsx"),
    'export const meta=definePrototype({title:"Login",states:[{id:"default",label:"Default"}]}); export default function Prototype(){return null;}'
  );
  const abort = new AbortController();
  let server: Awaited<ReturnType<typeof startDev>> | undefined;
  try {
    const project = await loadProject(root);
    expect(() => project.store({ remote: true })).toThrowError(
      expect.objectContaining({ code: "auth_required" })
    );
    server = await startDev(project, { port: await port() });
    const response = await fetch(`${server.origin}/__proto/api/events`, { signal: abort.signal });
    const reader = response.body!.getReader();
    await reader.read();
    const input = {
      key: "login-form",
      body: "Actual HTTP review",
      context: {
        state: "default",
        theme: "light",
        role: null,
        viewport: { width: 1440, height: 900 },
      },
      target: { kind: "node", node: null, label: "Whole view" },
    };
    const added = await fetch(`${server.origin}/__proto/api/comments`, {
      method: "POST",
      headers: { Origin: server.origin, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(added.status).toBe(201);
    const comment = (await added.json()).comment;
    const published = JSON.parse(
      await readFile(join(root, "proto/review/login-form.json"), "utf8")
    );
    expect(published).toMatchObject({ version: 3, sequence: 1, comments: [{ id: comment.id }] });
    expect((await project.store().get(comment.id)).thread[0]?.body).toBe(input.body);
    expect(await readEvent(reader, 'event: comments\ndata: {"key":"login-form"}')).toContain(
      'event: comments\ndata: {"key":"login-form"}'
    );
    const rejected = await fetch(`${server.origin}/__proto/api/comments`, {
      method: "POST",
      headers: { Origin: server.renderOrigin, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(rejected.status).toBe(403);
    expect((await rejected.json()).error.code).toBe("cross_origin_write");
    expect((await project.store().list()).length).toBe(1);
    abort.abort();
  } finally {
    abort.abort();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

it("Render integration: DOM carries app-relative source tags and configured source roots", async context => {
  const { chromium } = await import("playwright");
  const { existsSync } = await import("node:fs");
  if (!existsSync(chromium.executablePath())) {
    context.skip();
    return;
  }
  const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = appFixture("proto-render-tags-");
  mkdirSync(join(root, "src/drafts/tagged"), { recursive: true });
  writeFileSync(join(root, "proto.config.ts"), 'export default {title:"Tags"};');
  writeFileSync(
    join(root, "vite.config.ts"),
    'import react from "@vitejs/plugin-react"; import {proto} from "@compozy/proto/vite"; export default {cacheDir:".vite",plugins:[react({compiler:true}),proto()]};'
  );
  writeFileSync(
    join(root, "src/drafts/tagged/index.proto.tsx"),
    'import {definePrototype} from "@compozy/proto"; export const meta=definePrototype({title:"Tagged",states:[{id:"default",label:"Default"}]});export default function Tagged(){return <button>Tagged</button>;}'
  );
  const project = await loadProject(root);
  project.config.flows = "journeys";
  project.config.canvas = "proto.canvas.tsx";
  const server = await startDev(project, { port: await port(), quiet: true });
  const browser = await sharedBrowser!.newContext();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${server.renderOrigin}/__proto/render/tagged`);
    await page
      .locator("[data-proto-src]")
      .first()
      .waitFor({ timeout: 60000 })
      .catch(async error => {
        throw new Error(
          `${error.message}\nBrowser errors: ${errors.join("; ")}\nRendered document: ${await page.locator("body").innerText()}`
        );
      });
    const sources = await page
      .locator("[data-proto-src]")
      .evaluateAll(elements => elements.map(element => element.getAttribute("data-proto-src")));
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every(source => /^src\/.*:\d+:\d+$/.test(source!))).toBe(true);
    const config = await (
      await fetch(`${server.renderOrigin}/@id/__x00__virtual:proto/render-config`)
    ).text();
    expect(config).toContain('"dirs":["src","journeys"]');
  } finally {
    await browser.close();
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 120000);
it("Presentation integration: protoPresentation source tags survive the consumer React Compiler", async context => {
  const { chromium } = await import("playwright");
  const { existsSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  if (!existsSync(chromium.executablePath())) {
    context.skip();
    return;
  }
  const { join } = await import("node:path");
  const { createServer } = await import("vite");
  const root = appFixture("proto-tags-test-");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let browser: Awaited<ReturnType<Browser["newContext"]>> | undefined;
  try {
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "proto.config.ts"), 'export default {title:"Tags"};');
    writeFileSync(
      join(root, "vite.config.ts"),
      'import react from "@vitejs/plugin-react"; import {protoPresentation} from "@compozy/proto/vite"; export default {cacheDir:".vite",plugins:[react({compiler:true}),protoPresentation({sourceTags:true})]};'
    );
    writeFileSync(
      join(root, "index.html"),
      '<div id="root"></div><script type="module" src="/src/main.tsx"></script>'
    );
    writeFileSync(
      join(root, "src/main.tsx"),
      'import {createRoot} from "react-dom/client"; function View(){return <button>Tagged view</button>;} createRoot(document.getElementById("root")!).render(<View/>);'
    );
    server = await createServer({
      root,
      logLevel: "silent",
      server: { host: "127.0.0.1", port: await port(), strictPort: true },
    });
    await server.listen();
    browser = await sharedBrowser!.newContext();
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.getByRole("button").waitFor();
    expect(await page.getByRole("button").getAttribute("data-proto-src")).toMatch(
      /^src\/main.tsx:1:\d+$/
    );
  } finally {
    await browser?.close();
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 120000);

// Invariant: root-local peers are checked without importing Storybook in Node. Owner: server startup.
it("checks each root's installed peers and the supported 10.6 line", () => {
  const fixture = appFixture("proto-story-peers-");
  try {
    // An isolated subpackage prevents accidentally finding the fixture app's linked peers.
    const isolated = join(fixture, "peer-root");
    mkdirSync(isolated);
    writeFileSync(join(isolated, "package.json"), "{}");
    for (const name of ["storybook", "@storybook/react-vite"]) {
      const dir = join(isolated, "node_modules", name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "10.6.3" }));
    }
    expect(() => checkStorybookPeers(isolated, "ui")).not.toThrow();
    for (const version of ["10.7.0", "11.0.0"]) {
      writeFileSync(
        join(isolated, "node_modules/storybook/package.json"),
        JSON.stringify({ version })
      );
      expect(() => checkStorybookPeers(isolated, "ui")).toThrowError(
        expect.objectContaining({
          code: "storybook_unsupported",
          message: `Storybook ${version} is not supported; proto needs ~10.6.0.`,
        })
      );
    }
    rmSync(join(isolated, "node_modules/storybook/package.json"));
    expect(() => checkStorybookPeers(isolated, "ui")).toThrowError(
      expect.objectContaining({
        code: "storybook_missing",
        message: "storybook is not installed in ui; install storybook and @storybook/react-vite.",
      })
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

// Invariant: human startup lists shell/render before story roots; quiet and story-free
// startup retain their existing output. Owner: real dev startup, canonical dev suite.
it.each([
  { stories: true, quiet: false },
  { stories: true, quiet: true },
  { stories: false, quiet: false },
])(
  "prints startup URLs for stories=$stories quiet=$quiet",
  async ({ stories, quiet }) => {
    const fixture = storiesFixture();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    let dev: Awaited<ReturnType<typeof startDev>> | undefined;
    try {
      const project = await loadProject(fixture.app);
      if (!stories) delete project.config.stories;
      dev = await onFreePorts(port => {
        log.mockClear();
        return startDev(project, { port, quiet });
      });
      const startup = log.mock.calls
        .map(args => args.join(" "))
        .filter(line => /^(?:proto  |render |stories )/.test(line));
      expect(startup).toEqual(
        stories && !quiet
          ? [
              `proto  ${dev.origin}`,
              `render ${dev.renderOrigin}`,
              `stories app ${new URL(dev.storyRoots[0]!.renderUrl).origin}  1 files, 9 stories`,
              `stories ui ${new URL(dev.storyRoots[1]!.renderUrl).origin}  1 files, 1 stories`,
            ]
          : []
      );
    } finally {
      await dev?.close();
      log.mockRestore();
      rmSync(fixture.root, { recursive: true, force: true });
    }
  },
  120000
);

// Invariants: real portable lifecycle, one terminal result, root isolation, shutdown and host policy.
// Owner: existing real dev-server integration suite (Chromium, no runtime mocks).
it("hosts real Storybook roots, lifecycle stages and bounded terminal results", async () => {
  const fixture = storiesFixture();
  let dev: Awaited<ReturnType<typeof startDev>> | undefined;
  const browser = sharedBrowser;
  if (!browser) throw new Error("Chromium is required for story host integration");
  try {
    const project = await loadProject(fixture.app);
    const registry = await project.registry();
    expect(registry.storyRoots?.map(root => root.id)).toEqual(["app", "ui"]);
    expect(registry.stories?.map(file => file.stories.length)).toEqual([9, 1]);
    expect(registry.prototypes).toEqual([]);
    writeFileSync(
      join(fixture.app, "index.html"),
      '<div id="app-index"></div><script type="module" src="/src/main.tsx"></script>'
    );
    dev = await onFreePorts(port => startDev(project, { port, quiet: true }));
    const bootstrap = bootstrapSchema.parse(
      await fetch(`${dev.origin}/__proto/bootstrap.json`).then(response => response.json())
    );
    expect(bootstrap.projectId).toMatch(/^[a-f0-9]{16}$/);
    // The story origin never serves the app document (no index or SPA fallback); public files stay.
    for (const path of ["/", "/settings/plan"]) {
      const page = await fetch(new URL(path, bootstrap.storyRoots![0]!.renderUrl), {
        headers: { accept: "text/html" },
      });
      expect(page.status).toBe(404);
      expect(await page.text()).not.toContain("app-index");
    }
    expect(
      (await fetch(new URL("/mockServiceWorker.js", bootstrap.storyRoots![0]!.renderUrl))).status
    ).toBe(200);
    expect(bootstrap.storyRoots).toHaveLength(2);
    for (const [index, root] of bootstrap.storyRoots!.entries()) {
      expect(Number(new URL(root.renderUrl).port)).toBe(
        Number(new URL(dev.origin).port) + 2 + index
      );
      const asset = await fetch(new URL("/vendor/root.txt", root.renderUrl));
      expect(await asset.text()).toBe(index === 0 ? "app\n" : "packages/ui\n");
    }
    const storyBase = bootstrap.storyRoots![0]!.renderUrl;
    const actualPort = Number(new URL(storyBase).port);
    const blocked = await hostRequest(actualPort, "foreign.test:" + actualPort);
    expect(blocked.status).toBe(403);
    expect((await hostRequest(actualPort, "localhost:" + actualPort)).location).toBe(
      `http://127.0.0.1:${actualPort}/`
    );
    const html = await fetch(storyBase + "ui-button--primary");
    expect(html.headers.get("content-security-policy")).toBe(`frame-ancestors ${dev.origin}`);
    const config = storyViteConfig(project, project.config.stories!.roots[0]!, {
      shell: Number(new URL(dev.origin).port),
      story: actualPort,
    });
    const secondPage = await browser.newPage();
    await secondPage.goto(
      bootstrap.storyRoots![1]!.renderUrl + "ui-badge--default?play=0&instrument=false"
    );
    await secondPage.waitForSelector('[data-root="ui"]');
    await secondPage.waitForFunction(() => document.documentElement.dataset.uiReact === "ready");
    await secondPage.close();
    expect(config.cacheDir).not.toBe(join(fixture.app, "node_modules/.vite"));
    const open = async (id: string, play = true, timeout = 30000) => {
      const page = await browser.newPage();
      const statuses: StoryResult[] = [];
      await page.addInitScript(() => {
        const history: unknown[] = [];
        Object.defineProperty(window, "storyHistory", { value: history });
        new MutationObserver(() => {
          const value = document.documentElement.dataset.protoStory;
          if (value) history.push(JSON.parse(value));
        }).observe(document, {
          subtree: true,
          attributes: true,
          attributeFilter: ["data-proto-story"],
        });
      });
      await page.goto(
        storyHref(storyBase, {
          kind: "story",
          root: "app",
          slug: "ui-button",
          story: id,
          theme: "dark",
          play,
          timeout,
        }),
        { waitUntil: "commit" }
      );
      await page.waitForFunction(
        () => {
          const value = document.documentElement.dataset.protoStory;
          return value && JSON.parse(value).status !== "running";
        },
        undefined,
        { timeout: 60000 }
      );
      const result = storyResultSchema.parse(
        await page.evaluate(() => JSON.parse(document.documentElement.dataset.protoStory!))
      );
      statuses.push(
        ...(await page.evaluate(
          () => (window as unknown as { storyHistory: StoryResult[] }).storyHistory
        ))
      );
      return { page, result, statuses };
    };
    // Cold prototype and story loads share a directory but must never share optimizer state.
    const contract = join(import.meta.dirname, "../../../src/contract.ts");
    writeFileSync(
      join(fixture.app, "src/cold.proto.tsx"),
      `import { definePrototype } from ${JSON.stringify(contract)}; export const meta = definePrototype({ title: "Cold", states: [{ id: "default", label: "Default" }] }); export default function Cold() { return null; }`
    );
    project.invalidateStories("app", []);
    const prototypePage = await browser.newPage();
    const failedRequests: string[] = [];
    prototypePage.on("response", response => {
      if (response.status() === 504) failedRequests.push(response.url());
    });
    const [primary] = await Promise.all([
      open("ui-button--primary"),
      prototypePage.goto(`${dev.renderOrigin}/__proto/render/cold?chrome=0`),
    ]);
    await prototypePage.waitForFunction(
      () => document.documentElement.dataset.protoReady === "cold:default"
    );
    expect(failedRequests).toEqual([]);
    await prototypePage.close();
    expect(primary.statuses.filter(result => result.status !== "running")).toHaveLength(1);
    expect(primary.result).toMatchObject({ status: "passed", stage: "play", hasPlay: true });
    expect(Number.isInteger(primary.result.durationMs)).toBe(true);
    expect(await primary.page.locator("html").getAttribute("data-before-all")).toBe("1");
    expect(await primary.page.locator("html").getAttribute("data-project-loader")).toBe("1");
    expect(await primary.page.locator("html").getAttribute("data-preview-decorator")).toBe("1");
    expect(
      await primary.page.locator('[data-preview="outer"] [data-preview="inner"]').count()
    ).toBe(1);
    expect(await primary.page.locator("#proto-story-canvas button").textContent()).toBe("Clicked");
    await primary.page.close();
    const plain = await open("ui-button--plain");
    expect(plain.result).toMatchObject({ status: "passed", stage: "render", hasPlay: false });
    await plain.page.close();
    const thumbnail = await open("ui-button--primary", false);
    expect(await thumbnail.page.locator("button").textContent()).toBe("Button");
    await thumbnail.page.close();
    const shellPage = await browser.newPage();
    await shellPage.goto(dev.origin);
    const sandbox =
      "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads";
    await shellPage.setContent(
      Array.from(
        { length: 3 },
        (_, index) =>
          `<iframe sandbox="${sandbox}" src="${storyBase}ui-button--network?play=0&instrument=false&frame=network-${index}"></iframe>`
      ).join("")
    );
    await shellPage.waitForFunction(() => document.querySelectorAll("iframe").length === 3);
    for (const frame of shellPage.frames().filter(frame => frame !== shellPage.mainFrame())) {
      // A failed lifecycle is terminal too: show its stage/error instead of hiding it
      // behind the browser wait's timeout. IT-009 still requires every frame to pass.
      await frame.waitForFunction(() => {
        const value = document.documentElement.dataset.protoStory;
        return value && JSON.parse(value).status !== "running";
      });
      const result = storyResultSchema.parse(
        await frame.evaluate(() => JSON.parse(document.documentElement.dataset.protoStory!))
      );
      expect(result.status, JSON.stringify({ url: frame.url(), ...result })).toBe("passed");
      expect(await frame.locator("button").textContent()).toBe("Mock response");
      expect(await frame.locator("html").getAttribute("data-project-loader")).toBe("1");
    }
    // IT-014: picker controls are visible to the document but outside within(canvasElement).
    // Owner: real story-host integration; the parent uses the actual trusted bridge.
    await shellPage.evaluate(origin => {
      document
        .querySelector("iframe")!
        .contentWindow!.postMessage(
          { proto: 1, frame: "network-0", type: "pick:start", mode: "element" },
          origin
        );
    }, new URL(storyBase).origin);
    const picking = shellPage.frames().find(frame => frame.url().includes("frame=network-0"))!;
    await picking.getByTestId("proto-picker").waitFor();
    expect(
      // A browser source string keeps Vitest's SSR dynamic-import transform out of this realm.
      await picking.evaluate(`(async () => {
        const runtime = "/@id/__x00__virtual:proto/story-runtime";
        const { within } = await import(runtime);
        return {
          document: within(document.body).getAllByTestId("proto-picker").length,
          canvas: within(document.getElementById("proto-story-canvas")).queryAllByTestId(
            "proto-picker"
          ).length,
        };
      })()`)
    ).toEqual({ document: 1, canvas: 0 });
    await shellPage.close();
    const network = await open("ui-button--network");
    expect(network.result.status).toBe("passed");
    expect(await network.page.locator("button").textContent()).toBe("Mock response");
    await network.page.close();
    // Each document owns its lifecycle and worker. Run independent failure cases
    // together so the three 10 s deadlines overlap without shortening their budgets.
    await Promise.all(
      [
        ["fail", "play"],
        ["load-fail", "load"],
        ["render-fail", "render"],
        ["hang", "play"],
        ["load-hang", "load"],
        ["late", "play"],
      ].map(async ([name, stage]) => {
        const { page, result } = await open(`ui-button--${name}`, true, 10000);
        expect(result).toMatchObject({ stage, status: "failed" });
        if (name === "late") {
          await page.evaluate(() =>
            (window as unknown as { finishLateStory(): void }).finishLateStory()
          );
          await page.waitForTimeout(100);
          expect(
            await page.evaluate(
              () => JSON.parse(document.documentElement.dataset.protoStory!).status
            )
          ).toBe("failed");
        }
        await page.close();
      })
    );
    const revision = project.revision;
    const changed = new Promise<void>(resolve => {
      const stop = project.watch(() => {
        stop();
        resolve();
      });
    });
    project.invalidateStories("app", ["src/button.stories.tsx"]);
    await changed;
    expect(project.revision).toBeGreaterThan(revision);
    const origins = bootstrap.storyRoots!.map(root => new URL(root.renderUrl).origin);
    await dev.close();
    dev = undefined;
    for (const origin of origins) await expect(fetch(origin)).rejects.toThrow();
  } finally {
    await dev?.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 240000);

it("does not start broken story roots for prototype capture mode and cleans up failed starts", async () => {
  const fixture = storiesFixture();
  try {
    writeFileSync(join(fixture.app, "vite.config.ts"), "export default {};");
    writeFileSync(
      join(fixture.root, "packages/ui/vite.config.ts"),
      'throw new Error("broken story config");'
    );
    const project = await loadProject(fixture.app);
    const dev = await onFreePorts(port =>
      startDev(project, { quiet: true, port, storyRoots: "none" })
    );
    expect(dev.storyRoots).toEqual([]);
    await dev.close();
    const chosen = await port();
    await expect(startDev(project, { quiet: true, port: chosen })).rejects.toThrow(
      /broken story config/
    );
    for (const candidate of [chosen, chosen + 1, chosen + 2, chosen + 3])
      await expect(fetch(`http://127.0.0.1:${candidate}`)).rejects.toThrow();
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 120000);

it("reports preview and story import failures and hanging project setup at import stage", async () => {
  const fixture = storiesFixture();
  let dev: Awaited<ReturnType<typeof startDev>> | undefined;
  if (!sharedBrowser) throw new Error("Chromium is required for story host integration");
  try {
    const project = await loadProject(fixture.app);
    dev = await onFreePorts(port => startDev(project, { quiet: true, port, storyRoots: ["app"] }));
    const base = dev.storyRoots[0]!.renderUrl;
    for (const preview of [
      'throw new Error("preview failure");',
      "export const beforeAll = async () => { await new Promise(() => {}); };",
    ]) {
      writeFileSync(join(fixture.app, "preview.tsx"), preview);
      const page = await sharedBrowser.newPage();
      try {
        await page.goto(base + "ui-button--plain?timeout=1000&play=0&instrument=false", {
          waitUntil: "commit",
        });
        await page.waitForFunction(() => {
          const value = document.documentElement.dataset.protoStory;
          return value && JSON.parse(value).status === "failed";
        });
        expect(
          await page.evaluate(() => JSON.parse(document.documentElement.dataset.protoStory!))
        ).toMatchObject({ stage: "import", status: "failed", hasPlay: null });
      } finally {
        await page.close();
      }
    }
    writeFileSync(join(fixture.app, "preview.tsx"), "export {};");
    writeFileSync(
      join(fixture.app, "src/button.stories.tsx"),
      'import "./missing-story-module"; export default { title: "UI/Button" }; export const Plain = {};'
    );
    const page = await sharedBrowser.newPage();
    try {
      await page.goto(base + "ui-button--plain?timeout=30000&play=0&instrument=false", {
        waitUntil: "commit",
      });
      await page.waitForFunction(() => {
        const value = document.documentElement.dataset.protoStory;
        return value && JSON.parse(value).status === "failed";
      });
      const result = await page.evaluate(() =>
        JSON.parse(document.documentElement.dataset.protoStory!)
      );
      expect(result).toMatchObject({ stage: "import", status: "failed" });
      expect(result.error).toContain("missing-story-module");
    } finally {
      await page.close();
    }
  } finally {
    await dev?.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 120000);

// Invariant: document reloads follow this root's authored files or its active module graph.
// Owner: story Vite plugin; only the server graph and websocket I/O are stubbed.
it("reloads affected stories while deferring unrelated changes to Vite", async () => {
  const project = await loadProject(app);
  const root = {
    id: "ui",
    dir: "../ui",
    stories: "src/**/*.stories.tsx",
    preview: ".storybook/preview.ts",
    vite: "vite.config.ts",
  };
  const plugin = storyPlugins(project, root, "http://127.0.0.1:4400")[0]!;
  const update = plugin.handleHotUpdate;
  if (typeof update !== "function") throw new Error("Missing story update hook");
  const sent: unknown[] = [];
  const server = {
    moduleGraph: { getModuleById: () => undefined },
    ws: {
      send: (message: unknown) => {
        sent.push(message);
      },
    },
  };
  const change = (file: string, modules: { id: string }[] = []) =>
    Reflect.apply(update, {}, [{ file, modules, server } as unknown as HmrContext]);
  expect(await change(join(app, "src/unrelated.ts"))).toBeUndefined();
  expect(await change(join(app, "src/other.stories.tsx"))).toBeUndefined();
  expect(sent).toEqual([]);
  for (const file of [
    join(app, "../ui/src/button.stories.tsx"),
    join(app, "../ui/.storybook/preview.ts"),
  ]) {
    expect(await change(file)).toEqual([]);
  }
  expect(await change(join(app, "../ui/src/button.tsx"), [{ id: "button" }])).toEqual([]);
  expect(sent).toEqual(Array.from({ length: 3 }, () => ({ type: "full-reload" })));
});

// Invariants: native add/delete events refresh registry SSE; body edits restart the document lifecycle.
// Owner: real dev server and root Vite watcher, observed over HTTP/SSE and Chromium.
it("refreshes story discovery and reruns edited frames, including syntax recovery", async () => {
  const fixture = storiesFixture();
  if (!sharedBrowser) throw new Error("Chromium is required for story watcher integration");
  let dev: Awaited<ReturnType<typeof startDev>> | undefined;
  const abort = new AbortController();
  const page = await sharedBrowser.newPage();
  try {
    const project = await loadProject(fixture.app);
    dev = await onFreePorts(port => startDev(project, { port, quiet: true }));
    const stream = await fetch(`${dev.origin}/__proto/api/events`, { signal: abort.signal });
    const reader = stream.body!.getReader();
    await readEvent(reader, ": registry-watcher-ready");
    const file = join(fixture.app, "src/live.stories.tsx");
    const source = (label: string) => `export default { title: "Live" }; export const Default = {
      render: () => <button>${label}</button>,
      play: () => { document.documentElement.dataset.livePlay = "${label}"; }
    };`;
    const added = readEvent(reader, "event: registry");
    writeFileSync(file, source("Before"));
    await added;
    const hasLiveStory = async () => {
      const registry = await fetch(`${dev!.origin}/__proto/api/registry`).then(response =>
        response.json()
      );
      return registry.stories.some((entry: { slug: string }) => entry.slug === "live");
    };
    await expect.poll(hasLiveStory).toBe(true);
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.dataset.documentId = crypto.randomUUID();
      });
    });
    await page.goto(dev.storyRoots[0]!.renderUrl + "live--default?instrument=false");
    await page.waitForFunction(() => document.documentElement.dataset.livePlay === "Before");
    const original = await page.locator("html").getAttribute("data-document-id");
    writeFileSync(file, source("After"));
    await page.waitForFunction(
      id =>
        document.documentElement.dataset.documentId !== id &&
        document.documentElement.dataset.livePlay === "After",
      original
    );
    expect(await page.getByRole("button").textContent()).toBe("After");
    writeFileSync(
      file,
      'export default { title: "Live" }; export const Default = { render: () => <button>'
    );
    await page.waitForFunction(() => {
      const value = document.documentElement.dataset.protoStory;
      return value && JSON.parse(value).status === "failed";
    });
    writeFileSync(file, source("Recovered"));
    await page.waitForFunction(() => document.documentElement.dataset.livePlay === "Recovered");
    const preview = join(fixture.app, "preview.tsx");
    for (const source of ['sb.mock("fixture-module");', null, "export {};"]) {
      const previousRevision = project.revision;
      // Earlier story edits can leave registry events buffered on this same stream.
      // Require a complete event for a revision newer than the preview edit's starting point.
      const updated = readEvent(reader, "event: registry", text =>
        text
          .split("\n\n")
          .slice(0, -1)
          .some(event => {
            if (!event.includes("event: registry")) return false;
            const data = event.split("\n").find(line => line.startsWith("data: "));
            return !!data && JSON.parse(data.slice(6)).revision > previousRevision;
          })
      );
      if (source === null) rmSync(preview);
      else writeFileSync(preview, source);
      await updated;
      expect(project.revision).toBeGreaterThan(previousRevision);
      const registry = await project.registry();
      expect(registry.problems.some(problem => problem.code === "story_preview_missing")).toBe(
        source === null
      );
      expect(registry.warnings.some(warning => warning.code === "story_mock_unsupported")).toBe(
        source?.includes("sb.mock") ?? false
      );
    }
    const removed = readEvent(reader, "event: registry");
    rmSync(file);
    await removed;
    await expect.poll(hasLiveStory).toBe(false);
  } finally {
    abort.abort();
    await page.close();
    await dev?.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 180000);

// Invariant: gallery initial globals merge with preview defaults and yield to a story's pinned global.
// Owner: real Storybook composition in the story host (including a preview without a theme decorator).
it("composes both themes, custom theme globals and pinned stories", async () => {
  const fixture = storiesFixture();
  if (!sharedBrowser) throw new Error("Chromium is required for story theme integration");
  let dev: Awaited<ReturnType<typeof startDev>> | undefined;
  const pages: import("playwright").Page[] = [];
  try {
    const project = await loadProject(fixture.app);
    project.config.stories!.roots[1]!.themeGlobal = "mode";
    writeFileSync(
      join(fixture.root, "packages/ui/preview.tsx"),
      `
      export const initialGlobals = { retained: "preview" };
      export const decorators = [(Story, context) => <section data-global={context.globals.mode} data-retained={context.globals.retained}><Story /></section>];
    `
    );
    writeFileSync(
      join(fixture.root, "packages/ui/src/badge.stories.tsx"),
      `
      export default { title: "UI/Badge" };
      export const Default = { render: () => <span>Badge</span> };
      export const Pinned = { globals: { mode: "light" }, render: () => <span>Pinned</span> };
    `
    );
    dev = await onFreePorts(port => startDev(project, { port, quiet: true }));
    for (const theme of ["light", "dark"]) {
      for (const [index, id, expected] of [
        [0, "ui-button--plain", theme],
        [1, "ui-badge--default", theme],
        [1, "ui-badge--pinned", "light"],
      ] as const) {
        const page = await sharedBrowser.newPage();
        pages.push(page);
        await page.goto(
          dev.storyRoots[index]!.renderUrl + `${id}?theme=${theme}&play=0&instrument=false`
        );
        await page.waitForFunction(() => {
          const value = document.documentElement.dataset.protoStory;
          return value && JSON.parse(value).status === "passed";
        });
        expect(await page.locator("html").getAttribute("data-theme")).toBe(expected);
        expect(await page.locator("html").evaluate(html => html.classList.contains("dark"))).toBe(
          expected === "dark"
        );
        const attribute = index === 0 ? "data-theme-global" : "data-global";
        expect(await page.locator(`[${attribute}]`).getAttribute(attribute)).toBe(expected);
        if (index === 1)
          expect(await page.locator("[data-retained]").getAttribute("data-retained")).toBe(
            "preview"
          );
      }
    }
  } finally {
    await Promise.all(pages.map(page => page.close()));
    await dev?.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 180000);

// Invariant: a busy story port names the root and rolls back all earlier listeners.
// Owner: dev startup lifecycle with a real occupied TCP port.
it("rolls back startup when a story port is occupied", async () => {
  const fixture = storiesFixture();
  const occupied = createServer();
  const chosen = await port();
  await new Promise<void>((resolve, reject) => {
    occupied.once("error", reject);
    occupied.listen(chosen + 3, "127.0.0.1", resolve);
  });
  try {
    await expect(
      startDev(await loadProject(fixture.app), { port: chosen, quiet: true })
    ).rejects.toMatchObject({
      code: "port_in_use",
      message: expect.stringContaining(`ui port ${chosen + 3}`),
    });
    for (const candidate of [chosen, chosen + 1, chosen + 2])
      await expect(fetch(`http://127.0.0.1:${candidate}`)).rejects.toThrow();
  } finally {
    await new Promise<void>(resolve => occupied.close(() => resolve()));
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 120000);

// Invariant: CLI/MCP run real stories, keep failures bounded and report unrelated index problems.
// Owner: story runner integration in the canonical dev suite (real Chromium and root servers).
it("stories IT-015 / E2E-003: runs selected roots and reports lifecycle stages", async () => {
  const fixture = storiesFixture();
  const { runCli } = await import("../../../src/cli/main.ts");
  const { executeTool } = await import("../../../src/mcp.ts");
  const { formatHuman } = await import("../../../src/cli/human.ts");
  try {
    const project = await loadProject(fixture.app);
    writeFileSync(
      join(fixture.root, "packages/ui/vite.config.ts"),
      'throw new Error("unselected root started");'
    );
    await onFreePorts(async port => {
      const argv = [
        "stories",
        "run",
        "--root",
        "app",
        "--filter",
        "ui-button--{plain,fail,load-hang}",
        "--timeout",
        "10000",
        "--port",
        String(port),
        "--json",
      ];
      const result = await runCli(argv, { project });
      expect(result).toMatchObject({
        exitCode: 1,
        data: {
          summary: { total: 3, passed: 1, failed: 2 },
          stories: expect.arrayContaining([
            expect.objectContaining({
              id: "ui-button--plain",
              stage: "render",
              status: "passed",
              hasPlay: false,
              error: null,
              durationMs: expect.any(Number),
            }),
            expect.objectContaining({ id: "ui-button--fail", stage: "play", status: "failed" }),
            expect.objectContaining({
              id: "ui-button--load-hang",
              stage: "load",
              status: "failed",
              error: "Story timed out at load after 10000 ms",
            }),
          ]),
        },
      });
      expect(formatHuman(argv, result).stdout).toContain("3 stories: 1 passed, 2 failed");
      for (const candidate of [port, port + 1, port + 2, port + 3])
        await expect(fetch(`http://127.0.0.1:${candidate}`)).rejects.toThrow();
      writeFileSync(join(fixture.app, "src/broken.stories.tsx"), "export default {");
      expect(
        await runCli(["stories", "run", "--filter", "ui-button--plain", "--port", String(port)], {
          project,
        })
      ).toMatchObject({
        exitCode: 1,
        data: {
          summary: { total: 1, passed: 1, failed: 0 },
          problems: expect.arrayContaining([expect.objectContaining({ code: "story_parse" })]),
        },
      });
      rmSync(join(fixture.app, "src/broken.stories.tsx"));
      expect(
        await executeTool("proto_stories_run", { filter: "ui-button--plain", port }, project)
      ).toMatchObject({ summary: { total: 1, passed: 1, failed: 0 } });
      expect(await runCli(["stories", "run", "--filter", "absent"], { project })).toMatchObject({
        exitCode: 1,
        data: { error: { code: "story_not_found" } },
      });
      // Import failures stay per-story failures even when the preparation page fails.
      writeFileSync(
        join(fixture.app, "preview.tsx"),
        'throw new Error("fixture preview failure");'
      );
      expect(
        await runCli(["stories", "run", "--filter", "ui-button--plain", "--port", String(port)], {
          project,
        })
      ).toMatchObject({
        exitCode: 1,
        data: {
          summary: { total: 1, passed: 0, failed: 1 },
          stories: [
            expect.objectContaining({
              stage: "import",
              status: "failed",
              error: expect.stringContaining("fixture preview failure"),
            }),
          ],
        },
      });
    });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 180000);

// Invariant: a lost browser or failed page creation yields one row per selection;
// later stories recover, and a failed relaunch is attempted only once per loss.
// Owner: IT-015 runner integration, using real Chromium at the Playwright I/O boundary.
it.each(["document", "creation", "relaunch", "pool"] as const)(
  "stories IT-015: continues after browser loss at %s",
  async mode => {
    const fixture = storiesFixture();
    const { runStories } = await import("../../../src/node/story-runner.ts");
    const originalLaunch = chromium.launch.bind(chromium);
    let launches = 0;
    const launch = vi.spyOn(chromium, "launch").mockImplementation(async options => {
      launches++;
      if (mode === "relaunch" && launches > 1) throw new Error("relaunch unavailable");
      const browser = await originalLaunch(options);
      if (launches === 1) {
        if (mode === "creation") {
          const newPage = browser.newPage.bind(browser);
          vi.spyOn(browser, "newPage").mockImplementationOnce(async options => {
            await browser.close();
            return newPage(options);
          });
        } else {
          let selectedPages = 0;
          browser.on("context", context => {
            context.once("page", page => {
              page.once("domcontentloaded", () => {
                if (!new URL(page.url()).pathname.startsWith("/__proto/story/")) return;
                selectedPages++;
                if (selectedPages === (mode === "pool" ? 2 : 1)) void browser.close();
              });
            });
          });
        }
      }
      return browser;
    });
    try {
      await onFreePorts(async port => {
        const report = await runStories(await loadProject(fixture.app), {
          root: "app",
          filter: "ui-button--{primary,plain,network}",
          concurrency: mode === "pool" ? 1 : 3,
          port,
        });
        expect(report.results.map(row => row.id)).toEqual([
          "ui-button--primary",
          "ui-button--plain",
          "ui-button--network",
        ]);
        expect(report.results[mode === "pool" ? 1 : 0]).toMatchObject({
          status: "failed",
          stage: "import",
          error: expect.stringContaining("closed"),
        });
        expect(report.results.map(row => row.status)).toEqual(
          mode === "relaunch"
            ? ["failed", "failed", "failed"]
            : mode === "pool"
              ? ["passed", "failed", "passed"]
              : ["failed", "passed", "passed"]
        );
        if (mode === "relaunch") {
          for (const row of report.results.slice(1))
            expect(row).toMatchObject({
              stage: "import",
              error: expect.stringContaining("relaunch unavailable"),
            });
        }
        expect(launches).toBe(2);
        for (const candidate of [port, port + 1, port + 2])
          await expect(fetch(`http://127.0.0.1:${candidate}`)).rejects.toThrow();
      });
    } finally {
      launch.mockRestore();
      rmSync(fixture.root, { recursive: true, force: true });
    }
  },
  120000
);

// Invariant: a cold file finishes its first lifecycle before its siblings fan out.
// Owner: IT-008/IT-015 runner integration; observe real browser reports, with no timing threshold.
it("stories IT-008: warms a cold file before its siblings", async () => {
  const fixture = storiesFixture();
  const { runStories } = await import("../../../src/node/story-runner.ts");
  const originalLaunch = chromium.launch.bind(chromium);
  const terminal: string[] = [];
  const openedAfter: string[][] = [];
  const launch = vi.spyOn(chromium, "launch").mockImplementation(async options => {
    const browser = await originalLaunch(options);
    const newPage = browser.newPage.bind(browser);
    vi.spyOn(browser, "newPage").mockImplementation(async options => {
      openedAfter.push([...terminal]);
      const page = await newPage(options);
      const expose = page.exposeFunction.bind(page);
      vi.spyOn(page, "exposeFunction").mockImplementation(async (name, callback) => {
        return expose(name, (value: string) => {
          const result = JSON.parse(value) as StoryResult;
          if (result.status !== "running") terminal.push(result.story);
          return callback(value);
        });
      });
      return page;
    });
    return browser;
  });
  try {
    await onFreePorts(async port => {
      const report = await runStories(await loadProject(fixture.app), {
        root: "app",
        filter: "ui-button--{primary,plain,network}",
        concurrency: 3,
        port,
      });
      expect(report.results.map(row => row.status)).toEqual(["passed", "passed", "passed"]);
      expect(openedAfter).toHaveLength(3);
      expect(openedAfter[0]).toEqual([]);
      for (const reports of openedAfter.slice(1)) expect(reports).toContain("ui-button--primary");
    });
  } finally {
    launch.mockRestore();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 120000);

// Invariant: each cold file warms once before its siblings, without blocking other files.
// Owner: IT-008/IT-015 runner integration; real Vite transforms, HTTP and Chromium.
it.each(["first", "later"] as const)(
  "stories IT-008: warms cold files independently inside the default pool (%s)",
  async position => {
    const fixture = storiesFixture();
    const { runStories } = await import("../../../src/node/story-runner.ts");
    const { createServer } = await import("node:http");
    let releaseHeavy = () => {};
    let enteredHeavy!: () => void;
    const heavyEntered = new Promise<void>(resolve => {
      enteredHeavy = resolve;
    });
    let unrelatedPassed!: () => void;
    const unrelatedDone = new Promise<void>(resolve => {
      unrelatedPassed = resolve;
    });
    let transforms = 0;
    let sharedPreparations = 0;
    let heavyAfterShared: number | undefined;
    const siblingResponses: import("node:http").ServerResponse[] = [];
    const gate = createServer((request, response) => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      if (request.url === "/siblings") {
        siblingResponses.push(response);
        if (siblingResponses.length === 2)
          for (const peer of siblingResponses) peer.end("siblings admitted together");
        return;
      }
      transforms++;
      heavyAfterShared = sharedPreparations;
      releaseHeavy = () => response.end("ready");
      enteredHeavy();
    });
    await new Promise<void>(resolve => gate.listen(0, "127.0.0.1", resolve));
    const gatePort = (gate.address() as import("node:net").AddressInfo).port;
    writeFileSync(
      join(fixture.app, "vite.config.ts"),
      `
    import react from "@vitejs/plugin-react";
    export default { plugins: [react(), {
      name: "heavy-fixture-transform",
      async transform(_code, id) {
        if (id.split("?")[0].endsWith("/heavy.ts"))
          await fetch("http://127.0.0.1:${gatePort}/");
      },
    }] };
  `
    );
    writeFileSync(join(fixture.app, "src/heavy.ts"), 'export const label = "Heavy";');
    writeFileSync(
      join(
        fixture.app,
        position === "first" ? "src/a-heavy.stories.tsx" : "src/z-heavy.stories.tsx"
      ),
      `
    import { label } from "./heavy";
    import { http, passthrough } from "msw";
    export default {
      title: "A/Heavy", render: () => <button>{label}</button>,
      parameters: { msw: { handlers: [
        http.get("http://127.0.0.1:${gatePort}/siblings", () => passthrough()),
      ] } },
    };
    const awaitSibling = async () => { await fetch("http://127.0.0.1:${gatePort}/siblings").then(response => response.text()); };
    export const First = {};
    export const Second = { loaders: [awaitSibling] };
    export const Third = { loaders: [awaitSibling] };
  `
    );
    writeFileSync(
      join(
        fixture.app,
        position === "first" ? "src/z-unrelated.stories.tsx" : "src/a-unrelated.stories.tsx"
      ),
      `
    export default { title: "Z/Unrelated", render: () => <button>Independent</button> };
    export const Default = {};
  `
    );
    const terminal: StoryResult[] = [];
    const starts: { id: string; terminal: string[]; sharedPreparations: number }[] = [];
    const originalLaunch = chromium.launch.bind(chromium);
    const launch = vi.spyOn(chromium, "launch").mockImplementation(async options => {
      const browser = await originalLaunch(options);
      browser.on("context", context =>
        context.on("page", page => {
          page.on("close", () => {
            if (new URL(page.url()).pathname === "/__proto/story-warmup") sharedPreparations++;
          });
        })
      );
      const newPage = browser.newPage.bind(browser);
      vi.spyOn(browser, "newPage").mockImplementation(async options => {
        const page = await newPage(options);
        page.on("request", request => {
          if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
            starts.push({
              id: new URL(request.url()).pathname.split("/").at(-1)!,
              terminal: terminal.map(result => result.story),
              sharedPreparations,
            });
          }
        });
        const expose = page.exposeFunction.bind(page);
        vi.spyOn(page, "exposeFunction").mockImplementation((name, callback) =>
          expose(name, (value: string) => {
            const result = storyResultSchema.parse(JSON.parse(value));
            if (result.status !== "running") {
              terminal.push(result);
              if (result.story === "z-unrelated--default" && result.status === "passed")
                unrelatedPassed();
            }
            return callback(value);
          })
        );
        return page;
      });
      return browser;
    });
    let running: ReturnType<typeof runStories> | undefined;
    try {
      await onFreePorts(async port => {
        running = runStories(await loadProject(fixture.app), {
          root: "app",
          filter: "{a-heavy--*,z-unrelated--*}",
          port,
        });
        await Promise.race([Promise.all([heavyEntered, unrelatedDone]), running]);
        expect(terminal.map(result => result.story)).toEqual(["z-unrelated--default"]);
        expect(starts.map(start => start.id).sort()).toEqual([
          "a-heavy--first",
          "z-unrelated--default",
        ]);
        releaseHeavy();
        const report = await running;
        const heavyIds = ["a-heavy--first", "a-heavy--second", "a-heavy--third"];
        expect(report.results.map(row => row.id)).toEqual(
          position === "first"
            ? [...heavyIds, "z-unrelated--default"]
            : ["z-unrelated--default", ...heavyIds]
        );
        expect(report.results.map(row => row.status)).toEqual([
          "passed",
          "passed",
          "passed",
          "passed",
        ]);
        for (const sibling of starts.filter(start => /a-heavy--(second|third)/.test(start.id)))
          expect(sibling.terminal).toContain("a-heavy--first");
        expect(transforms).toBe(1);
        expect(sharedPreparations).toBe(1);
        expect(heavyAfterShared).toBe(1);
        expect(starts.every(start => start.sharedPreparations === 1)).toBe(true);
        expect(siblingResponses).toHaveLength(2);
      });
    } finally {
      releaseHeavy();
      for (const peer of siblingResponses) peer.end();
      await running?.catch(() => {});
      launch.mockRestore();
      await new Promise<void>(resolve => gate.close(() => resolve()));
      rmSync(fixture.root, { recursive: true, force: true });
    }
  },
  120000
);

// Invariant: story-server compile time does not spend `--timeout`, while a silent hang still fails
// at its stage after exactly that budget. Owner: IT-015 runner integration; a real slow Vite
// transform behind a loader's dynamic import (as a page story's route tree), real Chromium.
it("stories IT-015: compiling a cold module graph does not spend the story timeout", async () => {
  const fixture = storiesFixture();
  const { runStories } = await import("../../../src/node/story-runner.ts");
  try {
    // Longer than the runner's silence margin too: only compile heartbeats keep the page alive.
    writeFileSync(
      join(fixture.app, "vite.config.ts"),
      `
    import react from "@vitejs/plugin-react";
    export default { plugins: [react(), {
      name: "slow-fixture-transform",
      async transform(_code, id) {
        if (id.split("?")[0].endsWith("/route-tree.ts"))
          await new Promise(resolve => setTimeout(resolve, 7000));
      },
    }] };
  `
    );
    writeFileSync(join(fixture.app, "src/route-tree.ts"), 'export const label = "Routes";');
    writeFileSync(
      join(fixture.app, "src/page.stories.tsx"),
      `
    export default { title: "Pages/Home", render: (_args, { loaded }) => <button>{loaded.label}</button> };
    export const Home = {
      loaders: [async () => ({ label: (await import("./route-tree")).label })],
      play: async ({ canvas }) => { await canvas.findByRole("button", { name: "Routes" }); },
    };
  `
    );
    await onFreePorts(async port => {
      const report = await runStories(await loadProject(fixture.app), {
        root: "app",
        filter: "{pages-home--home,ui-button--load-hang}",
        timeout: 1000,
        port,
      });
      expect(report.results).toHaveLength(2);
      expect(report.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "pages-home--home",
            stage: "play",
            status: "passed",
            error: null,
          }),
          expect.objectContaining({
            id: "ui-button--load-hang",
            stage: "load",
            status: "failed",
            error: "Story timed out at load after 1000 ms",
          }),
        ])
      );
      const page = report.results.find(row => row.id === "pages-home--home")!;
      expect(page.durationMs).toBeGreaterThanOrEqual(7000);
    });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 120000);

// Invariant: reuse requires project identity; interrupt closes only resources owned by this run.
// Owner: runner/dev lifecycle integration, including real TCP listeners and process signals.
it("stories IT-016: refuses another project, reuses its own server and cleans up on SIGINT", async () => {
  const fixture = storiesFixture();
  const other = storiesFixture();
  const { runStories } = await import("../../../src/node/story-runner.ts");
  const { runCli } = await import("../../../src/cli/main.ts");
  try {
    const project = await loadProject(fixture.app);
    await onFreePorts(async port => {
      const dev = await startDev(project, { port, quiet: true, storyRoots: ["app"] });
      try {
        await expect(
          runStories(await loadProject(other.app), { port, filter: "ui-button--plain" })
        ).rejects.toMatchObject({ code: "project_mismatch" });
        expect(
          (await runStories(project, { port, filter: "ui-button--plain" })).results[0]?.status
        ).toBe("passed");
        const running = runCli(
          ["stories", "run", "--filter", "ui-button--load-hang", "--port", String(port)],
          { project }
        );
        // A real host request proves the shared server is ready before delivering the interrupt.
        await expect
          .poll(async () => (await fetch(`${dev.origin}/__proto/bootstrap.json`)).ok)
          .toBe(true);
        process.emit("SIGINT");
        expect((await running).exitCode).toBe(1);
        expect((await fetch(`${dev.origin}/__proto/bootstrap.json`)).ok).toBe(true);
      } finally {
        await dev.close();
      }
      const running = runCli(
        ["stories", "run", "--filter", "ui-button--load-hang", "--port", String(port)],
        { project }
      );
      await expect
        .poll(async () => {
          try {
            return (await fetch(`http://127.0.0.1:${port}/__proto/bootstrap.json`)).ok;
          } catch {
            return false;
          }
        })
        .toBe(true);
      process.emit("SIGINT");
      expect((await running).exitCode).toBe(1);
      for (const candidate of [port, port + 1, port + 2])
        await expect(fetch(`http://127.0.0.1:${candidate}`)).rejects.toThrow();
    });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
    rmSync(other.root, { recursive: true, force: true });
  }
}, 180000);

// Invariant: failed startup releases watchers so port_in_use exits naturally.
// Owner: IT-016 CLI process lifecycle; real occupied TCP port and Bun child process.
it.each([0, 2])(
  "stories IT-016: exits after an occupied port at offset %s",
  async offset => {
    const fixture = storiesFixture();
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const sockets = new Set<import("node:net").Socket>();
    const occupied = createServer(socket => {
      sockets.add(socket);
      // The timed-out client may reset this intentionally nonresponsive connection.
      socket.on("error", error => expect(error).toMatchObject({ code: "ECONNRESET" }));
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>(resolve => occupied.listen(0, "127.0.0.1", resolve));
    const port = (occupied.address() as import("node:net").AddressInfo).port - offset;
    try {
      const outcome = await promisify(execFile)(
        "bun",
        [
          join(import.meta.dirname, "../../../src/cli/main.ts"),
          "stories",
          "run",
          "--root",
          "app",
          "--filter",
          "ui-button--plain",
          "--port",
          String(port),
          "--json",
        ],
        { cwd: fixture.app, timeout: 15000 }
      ).catch(error => error);
      expect(outcome).toMatchObject({ code: 1, killed: false });
      expect(JSON.parse(outcome.stdout)).toMatchObject({ error: { code: "port_in_use" } });
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>(resolve => occupied.close(() => resolve()));
      rmSync(fixture.root, { recursive: true, force: true });
    }
  },
  30000
);

// Invariant: unavailable Chromium maps to the registered dependency exit and closes owned servers.
// Owner: runner's browser-launch I/O boundary; dev listeners remain real.
it("stories IT-015: missing Playwright returns exit 3 and releases ports", async () => {
  const fixture = storiesFixture();
  const { runCli } = await import("../../../src/cli/main.ts");
  const launch = vi.spyOn(chromium, "launch").mockRejectedValue(new Error("Chromium missing"));
  try {
    const project = await loadProject(fixture.app);
    await onFreePorts(async port => {
      expect(
        await runCli(["stories", "run", "--filter", "ui-button--plain", "--port", String(port)], {
          project,
        })
      ).toMatchObject({ exitCode: 3, data: { error: { code: "playwright_missing" } } });
      for (const candidate of [port, port + 1, port + 2])
        await expect(fetch(`http://127.0.0.1:${candidate}`)).rejects.toThrow();
    });
  } finally {
    launch.mockRestore();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 120000);

// Invariant: a shared HMR compiler error can enrich only this document's rejected import.
// Owner: real story-host/dev integration, including CSF reuse and a clean document in beforeAll.
it("isolates concurrent import failures on the same root", async () => {
  const fixture = storiesFixture();
  if (!sharedBrowser) throw new Error("Chromium is required for story host integration");
  const clean = await sharedBrowser.newPage();
  const broken = await sharedBrowser.newPage();
  const sibling = await sharedBrowser.newPage();
  let dev: Awaited<ReturnType<typeof startDev>> | undefined;
  try {
    writeFileSync(
      join(fixture.app, "preview.tsx"),
      `export const beforeAll = async () => {
      if (location.search.includes("pause=1")) await new Promise(resolve => { window.resumeStory = resolve; });
    };`
    );
    writeFileSync(
      join(fixture.app, "src/clean.stories.tsx"),
      'export default { title: "Clean" }; export const Default = { render: () => <button>Clean</button> };'
    );
    writeFileSync(
      join(fixture.app, "src/broken.stories.tsx"),
      'import "./broken-dependency"; export default { title: "Broken" }; export const Default = {};'
    );
    writeFileSync(join(fixture.app, "src/broken-dependency.ts"), "export const value = ;");
    writeFileSync(
      join(fixture.app, "src/sibling.stories.tsx"),
      'import "./broken.stories"; export default { title: "Sibling" }; export const Default = {};'
    );
    const project = await loadProject(fixture.app);
    dev = await onFreePorts(port => startDev(project, { port, quiet: true, storyRoots: ["app"] }));
    const base = dev.storyRoots[0]!.renderUrl;
    await clean.goto(base + "clean--default?pause=1&timeout=30000");
    await clean.waitForFunction(
      () => typeof (window as unknown as { resumeStory: unknown }).resumeStory === "function"
    );
    await Promise.all([
      broken.goto(base + "broken--default?timeout=30000"),
      sibling.goto(base + "sibling--default?timeout=30000"),
    ]);
    await broken.waitForFunction(
      () => JSON.parse(document.documentElement.dataset.protoStory ?? "null")?.status === "failed"
    );
    const failure = await broken.evaluate(() =>
      JSON.parse(document.documentElement.dataset.protoStory!)
    );
    expect(failure).toMatchObject({ stage: "import", status: "failed" });
    expect(failure.error).toMatch(/Unexpected|Expression expected|Expected|Parse failure/i);
    await sibling.waitForFunction(
      () => JSON.parse(document.documentElement.dataset.protoStory ?? "null")?.status === "failed"
    );
    const sharedFailure = await sibling.evaluate(() =>
      JSON.parse(document.documentElement.dataset.protoStory!)
    );
    expect(sharedFailure).toMatchObject({ stage: "import", status: "failed" });
    expect(sharedFailure.error).toMatch(/Unexpected|Expression expected|Expected|Parse failure/i);
    expect(
      await clean.evaluate(() => JSON.parse(document.documentElement.dataset.protoStory!))
    ).toMatchObject({ stage: "import", status: "running" });
    await clean.evaluate(() => (window as unknown as { resumeStory(): void }).resumeStory());
    await clean.waitForFunction(
      () => JSON.parse(document.documentElement.dataset.protoStory ?? "null")?.status === "passed"
    );
  } finally {
    await clean.close();
    await broken.close();
    await sibling.close();
    await dev?.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 120000);
