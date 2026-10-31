import { createServer } from "node:net";
import { request } from "node:http";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { loadProject } from "../../../src/node/project.ts";
import { startDev } from "../../../src/node/dev.ts";
import { bootstrapSchema } from "../../../src/model/bootstrap.ts";
const app = resolve(import.meta.dirname, "../../../../../apps/app");
async function port() {
  const server = createServer();
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const value = (server.address() as { port: number }).port;
  await new Promise<void>(r => server.close(() => r()));
  return value;
}
function hostRequest(port: number, host: string) {
  return new Promise<{ status: number; location?: string }>((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path: "/", headers: { host } }, res => {
      res.resume();
      resolve({ status: res.statusCode!, location: res.headers.location });
    });
    req.on("error", reject);
    req.end();
  });
}
it("UT-094 and IT-013 serve bootstrap, registry and render HTML with host confinement", async () => {
  const selected = await port();
  const server = await startDev(await loadProject(app), { port: selected });
  try {
    const bootstrap = bootstrapSchema.parse(
      await (await fetch(`${server.origin}/__proto/bootstrap.json`)).json()
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
      expect((await hostRequest(p, "evil.example")).status).toBe(403);
      expect(await hostRequest(p, `localhost:${p}`)).toMatchObject({
        status: 302,
        location: `http://127.0.0.1:${p}/`,
      });
    }
  } finally {
    await server.close();
  }
}, 30000);
it("UT-069 busy ports name the pair", async () => {
  const occupied = createServer();
  await new Promise<void>(r => occupied.listen(0, "127.0.0.1", r));
  const p = (occupied.address() as { port: number }).port;
  try {
    await expect(startDev(await loadProject(app), { port: p })).rejects.toThrow(
      `Ports ${p} and ${p + 1}`
    );
  } finally {
    await new Promise<void>(r => occupied.close(() => r()));
  }
}, 30000);
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
    await reader.read();
    writeFileSync(
      join(root, "src/new.proto.tsx"),
      'export const meta=definePrototype({title:"New",states:[{id:"idle",label:"Idle"}]});'
    );
    const next = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(Error("SSE deadline")), 2000)),
    ]);
    expect(new TextDecoder().decode(next.value)).toContain("event: registry");
    abort.abort();
  } finally {
    abort.abort();
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);

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
    expect(() => project.store({ remote: true })).toThrow("slice 8");
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
    const notification = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(Error("Review SSE deadline")), 2000)
      ),
    ]);
    expect(new TextDecoder().decode(notification.value)).toContain(
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
}, 30000);

it("Render integration: DOM carries app-relative source tags and configured source roots", async context => {
  const { chromium } = await import("playwright");
  const { existsSync } = await import("node:fs");
  if (!existsSync(chromium.executablePath())) {
    context.skip();
    return;
  }
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = mkdtempSync(join(app, ".proto-render-tags-"));
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
  const browser = await chromium.launch();
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
      .waitFor({ timeout: 10000 })
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
}, 30000);
it("Presentation integration: protoPresentation source tags survive the consumer React Compiler", async context => {
  const { chromium } = await import("playwright");
  const { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  if (!existsSync(chromium.executablePath())) {
    context.skip();
    return;
  }
  const { join } = await import("node:path");
  const { createServer } = await import("vite");
  const root = mkdtempSync(join(app, ".proto-tags-test-"));
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
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
    browser = await chromium.launch();
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
}, 30000);
