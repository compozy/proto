// Invariants: session lifetime, target isolation, snapshot certification and CLI control.
// Owner/canonical suite: node/share/session. Real builds, FileStore, HTTP and sentinel;
// only Cloudflare/Access network I/O and the connector executable are substituted.
import { execFileSync, spawn } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { createServer, Server, request as httpRequest } from "node:http";
import { chmod, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { runCli } from "../../../src/cli/main.ts";
import { loadProject } from "../../../src/node/project.ts";
import { CloudflareClient } from "../../../src/share/cloudflare.ts";
import { connect, disconnect } from "../../../src/share/connection.ts";
import { startShare, shareStatus, refreshShare, stopShare, runningShare, type ShareActivity, type ShareRuntime, type ShareSession } from "../../../src/share/session.ts";
import { shareDirectory, type ShareTarget } from "../../../src/share/snapshot.ts";
import { systemLockEnvironment } from "../../../src/store/lock.ts";
import { appFixture } from "../app-fixture.ts";
import { input } from "../store/contract.ts";
import { fakeCloudflare } from "./cloudflare-fixture.ts";
import { cloudflaredStub } from "./cloudflared-stub.ts";

const disposals: (() => Promise<unknown>)[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const dispose of disposals.splice(0).reverse()) await dispose(); });
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const shellHost = "team-review.example.com", renderHost = "team-review-render.example.com";
function jwt(email: string) {
  const data = [{ alg: "RS256", kid: "test" }, {
    iss: "https://acme.cloudflareaccess.com", aud: ["audience"], email,
    nbf: Date.now() / 1000 - 60, exp: Date.now() / 1000 + 3600,
  }].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".");
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), pair.privateKey).toString("base64url")}`;
}
async function origin(port: number, path: string, options: { host?: string; email?: string; method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new Promise<Response>((resolve, reject) => {
    const request = httpRequest({ host: "127.0.0.1", port, path, method: options.method ?? "GET", headers: {
      host: options.host ?? shellHost,
      ...(options.email ? { "Cf-Access-Jwt-Assertion": jwt(options.email) } : {}),
      ...(options.body ? { "Content-Type": "application/json", Origin: `https://${shellHost}`, "x-proto-request": "1" } : {}),
      ...options.headers,
    } }, response => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(response.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      resolve(new Response(new ReadableStream({
        start(controller) {
          response.on("data", chunk => controller.enqueue(new Uint8Array(chunk)));
          response.on("end", () => controller.close());
          response.on("error", error => controller.error(error));
        }, cancel() { response.destroy(); },
      }), { status: response.statusCode!, headers }));
    });
    request.on("error", reject);
    request.end(options.body ? JSON.stringify(options.body) : undefined);
  });
}
async function fixture() {
  const workspace = appFixture("share-session-");
  const root = join(workspace, "apps/app");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ private: true, type: "module" }));
  const directory = await mkdtemp(join(tmpdir(), "proto-session-"));
  disposals.push(() => rm(workspace, { recursive: true, force: true }), () => rm(directory, { recursive: true, force: true }));
  await mkdir(join(root, "src"));
  await mkdir(join(root, "flows"));
  await writeFile(join(root, "proto.config.ts"), "export default {title:'Share session'};");
  await writeFile(join(root, "vite.config.ts"), "import react from '@vitejs/plugin-react';export default {plugins:[react()]};");
  await writeFile(join(root, "proto.canvas.tsx"), "export function Canvas({children}) {return children;}");
  await writeFile(join(root, "src/view.tsx"), "export function View(){return <button>Review me</button>}");
  for (const slug of ["example", "private"])
    await writeFile(join(root, `src/${slug}.proto.tsx`), "import {definePrototype} from '@compozy/proto';import {View} from './view';export const meta=definePrototype({title:'Example',states:[{id:'default',label:'Default'}]});export default View;");
  await writeFile(join(root, "flows/journey.flow.ts"), "export const flow=defineFlow({title:'Journey',start:['screen'],nodes:{screen:{proto:'example',state:'default',end:true}},edges:[]});");
  const shellDir = join(directory, "shell");
  await mkdir(shellDir); await writeFile(join(shellDir, "index.html"), "<!doctype html><title>Session data fixture</title>");
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "--quiet", workspace); git("config", "user.name", "Session test"); git("config", "user.email", "test@example.com");
  git("config", "commit.gpgsign", "false"); git("config", "core.hooksPath", join(directory, "no-hooks"));
  await writeFile(join(workspace, ".gitignore"), "/node_modules\n");
  git("add", "--all"); git("commit", "--quiet", "-m", "fixture");
  const api = await fakeCloudflare(); disposals.push(() => api.close());
  const client = new CloudflareClient("api-secret", api.url);
  const connectionPath = join(directory, "config/cloudflare.json"), path = join(directory, "config/share-session.json");
  await connect({ apiToken: "api-secret", name: "team-review", path: connectionPath, client });
  const binary = await cloudflaredStub(join(directory, "cloudflared"));
  const activity: ShareActivity[] = [], logs: unknown[] = [], notices: string[] = [], probes: string[] = [];
  let badProbe = false, missingSession = false;
  const port = () => {
    const config = api.state.ingress as { config: { ingress: { service: string }[] } };
    return Number(new URL(config.config.ingress[0]!.service).port);
  };
  // Local HTTP edge is the fake provider boundary. Probe reaches the real origin adapter.
  const edge = createServer((request, response) => {
    if (request.url === "/cdn-cgi/access/certs") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ keys: [{ ...pair.publicKey.export({ format: "jwk" }), kid: "test", alg: "RS256" }] })); return;
    }
    if (request.headers.host === shellHost) { response.writeHead(302, { Location: "https://acme.cloudflareaccess.com/cdn-cgi/access/login" }); response.end(); return; }
    const upstream = httpRequest({ hostname: "127.0.0.1", port: port(), path: request.url, headers: { host: renderHost } }, result => {
      const headers = { ...result.headers };
      if (missingSession) delete headers["x-proto-session"];
      response.writeHead(badProbe ? 502 : result.statusCode!, badProbe ? {} : headers); result.pipe(response);
    });
    upstream.on("error", () => { response.writeHead(502); response.end(); }); upstream.end();
  });
  await new Promise<void>(resolve => edge.listen(0, "127.0.0.1", resolve));
  disposals.push(async () => { edge.closeAllConnections(); await new Promise<void>(resolve => edge.close(() => resolve())); });
  const edgePort = (edge.address() as { port: number }).port;
  const runtime: ShareRuntime = {
    path, connectionPath, client, binary, shellDir, readinessTimeout: 500,
    fetch: async (resource, init) => {
      const url = new URL(String(resource)); probes.push(url.host);
      return fetch(`http://127.0.0.1:${edgePort}${url.pathname}`, { ...init, headers: { host: url.host }, redirect: "manual" });
    }, activity: event => activity.push(event), notice: message => notices.push(message), log: entry => logs.push(entry),
  };
  const project = await loadProject(root);
  let session: ShareSession | undefined;
  disposals.push(async () => { await session?.stop(); });
  return { root, directory, project, git, api, runtime, edgePort, path, activity, logs, notices, probes, port,
    badProbe: () => { badProbe = true; },
    missingSession: () => { missingSession = true; },
    start: async (approvers = true, target: ShareTarget = { kind: "prototype", slug: "example" }) => {
      session = await startShare(project, { target, approvers: approvers ? ["ana@example.com"] : [], commenters: ["bob@example.com"] }, runtime);
      return session;
    },
    record: async () => JSON.parse(await readFile(path, "utf8")),
    request: (path: string, options: Parameters<typeof origin>[2] = {}) => origin(port(), path, { email: "ana@example.com", ...options }),
  };
}

async function snapshotEvent(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const part = await reader.read();
    if (part.done) throw new Error("Stream ended before the snapshot event");
    buffer += decoder.decode(part.value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (frame.split("\n").includes("event: snapshot"))
        return JSON.parse(frame.split("\n").find(line => line.startsWith("data: "))!.slice(6));
    }
  }
}

// Invariant: refresh certifies current configuration, and a committed swap stays successful
// even if private metadata cannot be persisted. Owner/canonical suite: node/share/session.
it("ASTRA-002/003: refresh reloads config and publishes even when the record write fails", async () => {
  const f = await fixture(); const session = await f.start();
  await writeFile(join(f.root, "proto.config.ts"), "export default {title:'Refreshed configuration'};");
  f.git("add", "proto.config.ts"); f.git("commit", "--quiet", "-m", "change config");
  const stream = await f.request("/api/events"); const reader = stream.body!.getReader();
  await reader.read();
  const old = session.summary.snapshot;
  await chmod(join(f.path, ".."), 0o500);
  try {
    const next = await refreshShare(f.runtime);
    expect(next.snapshot).not.toBe(old);
    expect(await snapshotEvent(reader)).toEqual({ id: next.snapshot });
    expect(await shareStatus(f.runtime)).toMatchObject({ snapshot: next.snapshot, commit: next.commit });
    const bootstrap = await (await f.request("/__proto/bootstrap.json")).json();
    expect(bootstrap).toMatchObject({ snapshot: next.snapshot });
    const registry = await (await f.request("/api/registry")).json();
    expect(registry.title).toBe("Refreshed configuration");
    expect((await f.record()).snapshot).toBe(old);
    expect(f.notices).toContain("The new snapshot is live, but the private session record could not be updated.");
  } finally {
    await chmod(join(f.path, ".."), 0o700);
    await reader.cancel();
  }
}, 120_000);

// Invariant: status describes a live owner during startup and survives provider outages.
// Owner/canonical suite: node/share/session.
it("OPUS-N05: status reports startup and an unhealthy tunnel when the API fails", async () => {
  const f = await fixture();
  let release!: () => void, reached!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { reached = resolve; });
  const fetchEdge = f.runtime.fetch!;
  f.runtime.fetch = async (resource, init) => {
    if (String(resource).includes("/cdn-cgi/access/certs")) { reached(); await blocked; }
    return fetchEdge(resource, init);
  };
  const starting = f.start();
  try {
    await entered;
    expect(await shareStatus(f.runtime)).toMatchObject({ running: true, tunnel: "starting" });
  } finally { release(); }
  await starting;
  f.api.state.failures.push({ path: "/cfd_tunnel/", status: 500 });
  expect(await shareStatus(f.runtime)).toMatchObject({ running: true, tunnel: "unhealthy" });
}, 120_000);

it("UT-011: missing, dead and reused session pids cannot be controlled", async () => {
  const directory = await mkdtemp(join(tmpdir(), "proto-status-")); disposals.push(() => rm(directory, { recursive: true, force: true }));
  const runtime = { path: join(directory, "share-session.json") };
  expect(await shareStatus(runtime)).toEqual({ running: false });
  await expect(refreshShare(runtime)).rejects.toMatchObject({ code: "share_not_running" });
  await expect(stopShare(runtime)).rejects.toMatchObject({ code: "share_not_running" });
  for (const pid of [2147483647, process.pid]) {
    await writeFile(runtime.path, JSON.stringify({ pid, pidStartedAt: "different identity" }));
    expect(await shareStatus(runtime)).toEqual({ running: false });
    await expect(refreshShare(runtime)).rejects.toMatchObject({ code: "share_not_running" });
    await expect(stopShare(runtime)).rejects.toMatchObject({ code: "share_not_running" });
  }
});

it("IT-007/015/017/018: private singleton, policy before ingress, origin readiness and authenticated loopback control", async () => {
  const listen = vi.spyOn(Server.prototype, "listen");
  const f = await fixture();
  f.api.state.policies.push({ id: "old", name: "proto-share invitees" });
  const session = await f.start(); const record = await f.record();
  expect(session.summary.link).toBe(`https://${shellHost}/?p=example`);
  expect((await stat(f.path)).mode & 0o777).toBe(0o600);
  const calls = f.api.state.calls;
  expect(calls.findIndex(call => call.method === "POST" && call.path.endsWith("/policies"))).toBeLessThan(calls.findIndex(call => call.path.endsWith("/configurations")));
  expect(f.api.state.policies.some(policy => policy.id === "old")).toBe(false);
  expect(f.probes).toContain(renderHost); expect(f.probes).toContain(shellHost);
  const config = f.api.state.ingress as { config: { ingress: { service: string }[] } };
  expect(config.config.ingress.slice(0, 2).map(item => item.service)).toEqual([`http://127.0.0.1:${f.port()}`, `http://127.0.0.1:${f.port()}`]);
  expect(record.controlPort).not.toBe(f.port());
  const addresses = listen.mock.contexts.map(server => (server as Server).address()).filter(address => address && typeof address !== "string");
  for (const port of [f.port(), record.controlPort])
    expect(addresses).toContainEqual(expect.objectContaining({ address: "127.0.0.1", port }));
  expect((await fetch(`http://127.0.0.1:${record.controlPort}/status`)).status).toBe(401);
  expect((await f.request("/", { host: "evil.example.com" })).status).toBe(403);
  await expect(f.start()).rejects.toMatchObject({ code: "share_session_running" });
  await expect(disconnect({ path: f.runtime.connectionPath, client: f.runtime.client, running: () => runningShare(f.runtime) })).rejects.toMatchObject({ code: "share_session_running" });
  for (const text of [await readFile(f.path, "utf8"), JSON.stringify(f.logs), await readFile(join(shareDirectory(f.root), "current/__proto/bootstrap.json"), "utf8")]) {
    expect(text).not.toContain("api-secret"); expect(text).not.toContain("connector-secret");
  }
  f.api.state.tunnels[0]!.connections = [{}];
  expect(await shareStatus(f.runtime)).toMatchObject({ running: true, tunnel: "healthy", snapshot: session.summary.snapshot });
}, 120_000);

it("IT-008/009/014/020/024/028: isolated live events, verified activity and stale approvals across refresh", async () => {
  const f = await fixture(); const session = await f.start();
  const registry = await (await f.request("/api/registry")).json();
  expect(registry.prototypes.map((item: { slug: string }) => item.slug)).toEqual(["example"]);
  const denied = await f.request("/", { email: "stranger@example.com" });
  expect(denied.status).toBe(302);
  const signIn = new URL(denied.headers.get("location")!, `https://${shellHost}`);
  const page = await f.request(signIn.pathname + signIn.search, { email: "stranger@example.com" });
  expect(page.status).toBe(403);
  expect(await page.text()).toContain("This email was not invited");
  await denied.body?.cancel();
  const author = { kind: "reviewer" as const, id: "ana@example.com", name: "ana@example.com" };
  const store = f.project.store();
  await store.add("private", input, author);
  expect(await (await f.request("/api/comments?key=private")).json()).toMatchObject({ error: { code: "comment_not_found" } });
  const stream = await f.request("/api/events"); const reader = stream.body!.getReader();
  await reader.read();
  await store.reply("private-1", { body: "Invisible update" }, author);
  const comment = await store.add("example", input, author);
  await expect.poll(() => f.activity.some(event => event.type === "commented" && event.commentId === comment.id)).toBe(true);
  const message = new TextDecoder().decode((await reader.read()).value);
  expect(message).toContain("example"); expect(message).not.toContain("private");
  const cli = resolve(import.meta.dirname, "../../../src/cli/main.ts");
  await new Promise<void>((resolve, reject) => {
    const child = spawn("bun", [cli, "comments", "reply", comment.id, "--note", "Fixed", "--json"], { cwd: f.root, stdio: "ignore" });
    child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(new Error(`reply exited ${code}`)));
  });
  await expect.poll(async () => (await store.get(comment.id)).thread.length).toBe(2);
  const old = session.summary.snapshot;
  await reader.cancel(); // Deliberately miss snapshot SSE; bootstrap must recover it.
  const updates = await f.request("/api/events"); const updateReader = updates.body!.getReader();
  await updateReader.read();
  const next = await session.refresh();
  expect(await snapshotEvent(updateReader)).toEqual({ id: next.snapshot });
  await updateReader.cancel();
  const bootstrap = await (await f.request("/__proto/bootstrap.json")).json();
  expect(bootstrap.snapshot).toBe(next.snapshot); expect(next.snapshot).not.toBe(old);
  expect((await f.request("/api/reviews/example/transitions", { method: "POST", body: { to: "approved", confirmOpen: true, snapshot: old } })).status).toBe(409);
  expect((await f.request("/api/reviews/example/transitions", { email: "bob@example.com", method: "POST", body: { to: "approved", confirmOpen: true, snapshot: next.snapshot } })).status).toBe(403);
  expect((await f.request("/api/reviews/example/transitions", { method: "POST", body: { to: "approved", confirmOpen: true, snapshot: next.snapshot } })).status).toBe(200);
  await expect.poll(() => f.activity.some(event => event.type === "approved" && event.commit === next.commit)).toBe(true);
  expect((await store.review("example")).events.at(-1)).toMatchObject({ authorId: "ana@example.com", commit: next.commit });
  expect(f.activity.filter(event => event.type === "joined" && event.email === "ana@example.com")).toHaveLength(1);
  expect(f.activity.some(event => "key" in event && event.key === "private")).toBe(false);
  expect(JSON.stringify(f.logs)).not.toContain("@example.com");
}, 120_000);

it("IT-010/011/012/022/023: serialized refresh, review edits allowed, failed builds and hidden untracked files preserve current", async () => {
  const f = await fixture();
  await mkdir(join(f.root, ".proto-build-crashed"));
  await writeFile(f.path, JSON.stringify({ pid: process.pid, pidStartedAt: "reused" }));
  const session = await f.start();
  expect(await readdir(f.root)).not.toContain(".proto-build-crashed");
  const before = await readlink(join(shareDirectory(f.root), "current"));
  await f.project.store().add("example", input, { kind: "reviewer", id: "ana@example.com", name: "ana@example.com" });
  f.git("commit", "--quiet", "--allow-empty", "-m", "fix");
  const [a, b] = await Promise.all([refreshShare(f.runtime), refreshShare(f.runtime)]);
  expect(a).toEqual(b);
  expect(await readlink(join(shareDirectory(f.root), "current"))).not.toBe(before);
  const current = await readlink(join(shareDirectory(f.root), "current"));
  f.git("config", "status.showUntrackedFiles", "no");
  await writeFile(join(f.root, "new.ts"), "new import");
  await expect(session.refresh()).rejects.toMatchObject({ code: "share_dirty_tree" });
  expect(await readlink(join(shareDirectory(f.root), "current"))).toBe(current);
  await rm(join(f.root, "new.ts"));
  await writeFile(join(f.root, "src/view.tsx"), "export function View( {");
  f.git("add", "src/view.tsx"); f.git("commit", "--quiet", "-m", "broken");
  await expect(session.refresh()).rejects.toThrow();
  expect(await readlink(join(shareDirectory(f.root), "current"))).toBe(current);
  await rm(join(f.root, "src/example.proto.tsx")); f.git("add", "src/example.proto.tsx"); f.git("commit", "--quiet", "-m", "delete target");
  await expect(session.refresh()).rejects.toMatchObject({ code: "share_target_not_found" });
  expect(await readlink(join(shareDirectory(f.root), "current"))).toBe(current);
}, 120_000);

it("IT-013/016: timeout prints no session, unexpected connector death closes policy and ports; API outage still stops", async () => {
  const f = await fixture(); f.badProbe();
  await expect(f.start()).rejects.toMatchObject({ code: "share_tunnel_timeout", exit: 4 });
  expect(await shareStatus(f.runtime)).toEqual({ running: false }); expect(f.api.state.policies).toEqual([]);
  const missing = await fixture(); missing.missingSession();
  missing.api.state.tunnels[0]!.connections = [{}];
  await expect(missing.start()).rejects.toMatchObject({ code: "share_tunnel_timeout", exit: 4 });
  expect(await shareStatus(missing.runtime)).toEqual({ running: false });
  expect(missing.api.state.policies).toEqual([]);
  const g = await fixture(); const session = await g.start(); const record = await g.record();
  process.kill(record.cloudflaredPid, "SIGTERM");
  expect(await session.closed).toMatchObject({ code: "share_tunnel_lost", exit: 4 });
  expect(g.api.state.policies).toEqual([]);
  await expect(fetch(`http://127.0.0.1:${record.controlPort}/status`)).rejects.toThrow();
  const h = await fixture(); const last = await h.start();
  h.api.state.failures.push({ path: "/policies", status: 500 });
  expect(await stopShare(h.runtime)).toEqual({ stopped: true }); await last.closed;
  expect(h.notices.length).toBeGreaterThan(0);
  expect(await shareStatus(h.runtime)).toEqual({ running: false });
}, 120_000);

it("IT-021: render grants cannot cross a session restart", async () => {
  const f = await fixture(); const first = await f.start();
  const ticket = await (await f.request("/api/render-ticket?slug=example")).json();
  const exchange = await f.request(new URL(ticket.url).pathname + new URL(ticket.url).search, { host: renderHost, email: undefined });
  const cookie = exchange.headers.get("set-cookie")!.split(";")[0]!;
  await first.stop(); await f.start();
  expect((await f.request("/__proto/render/example", { host: renderHost, email: undefined, headers: { cookie } })).status).toBe(401);
}, 120_000);

it("IT-026: a recorded orphan is terminated before replacing a dead or reused owner", async () => {
  const f = await fixture();
  const orphan = spawn(f.runtime.binary!, ["tunnel", "run"], { stdio: "ignore" });
  await new Promise<void>((resolve, reject) => { orphan.once("spawn", resolve); orphan.once("error", reject); });
  disposals.push(async () => { if (orphan.exitCode === null) orphan.kill("SIGKILL"); });
  const identity = await systemLockEnvironment.processStartedAt(orphan.pid!);
  await writeFile(f.path, JSON.stringify({ pid: process.pid, pidStartedAt: "reused", cloudflaredPid: orphan.pid, cloudflaredStartedAt: identity }));
  await f.start();
  expect(systemLockEnvironment.alive(orphan.pid!)).toBe(false);
  expect((await f.record()).cloudflaredPid).not.toBe(orphan.pid);
}, 120_000);

it("E2E-002: CLI connect/start/status/refresh/stop/disconnect returns contract fields and leaves only OTP", async () => {
  const f = await fixture();
  const options = { cwd: f.root, project: f.project, share: f.runtime };
  const connected = await runCli(["share", "connect", "--name", "team-review", "--json"], { ...options, readToken: async () => "api-secret" });
  expect(connected).toMatchObject({ exitCode: 0, data: { link: `https://${shellHost}`, domain: "example.com", created: false } });
  const start = await runCli(["share", "example", "--approver", "ana@example.com", "--json"], options);
  disposals.push(async () => { if (await runningShare(f.runtime)) await stopShare(f.runtime); await start.completion; });
  expect(start).toMatchObject({ exitCode: 0, data: { link: `https://${shellHost}/?p=example`, target: { kind: "prototype", slug: "example" }, invitees: [{ email: "ana@example.com", role: "approver" }], snapshot: expect.any(String), commit: expect.any(String) } });
  expect(await runCli(["share", "status", "--json"], options)).toMatchObject({ exitCode: 0, data: { running: true, startedAt: expect.any(String) } });
  expect(await runCli(["share", "refresh", "--json"], options)).toMatchObject({ exitCode: 0, data: { snapshot: expect.any(String), commit: expect.any(String) } });
  expect(await runCli(["share", "stop", "--json"], options)).toMatchObject({ exitCode: 0, data: { stopped: true } });
  await start.completion;
  expect(await runCli(["share", "refresh", "--json"], options)).toMatchObject({ exitCode: 1, data: { error: { code: "share_not_running" } } });
  expect(await runCli(["share", "disconnect", "--json"], options)).toMatchObject({ exitCode: 0, data: { kept: ["otp_provider"] } });
  expect(f.api.state.providers).toHaveLength(1); expect(f.api.state.tunnels).toEqual([]); expect(f.api.state.apps).toEqual([]); expect(f.api.state.records).toEqual([]); expect(f.api.state.policies).toEqual([]);
}, 120_000);

it("IT-026: SIGKILL closes the sentinel pipe and kills the connector without a session handler", async () => {
  const f = await fixture();
  const script = join(f.directory, "owner.ts");
  const source = resolve(import.meta.dirname, "../../../src");
  await writeFile(script, `
import { startShare } from ${JSON.stringify(join(source, "share/session.ts"))};
import { loadProject } from ${JSON.stringify(join(source, "node/project.ts"))};
import { CloudflareClient } from ${JSON.stringify(join(source, "share/cloudflare.ts"))};
const session = await startShare(await loadProject(${JSON.stringify(f.root)}), {
 target:{kind:'prototype',slug:'example'},approvers:[],commenters:['bob@example.com']
}, {
 path:${JSON.stringify(f.path)}, connectionPath:${JSON.stringify(f.runtime.connectionPath)},
 client:new CloudflareClient('api-secret',${JSON.stringify(f.api.url)}),
 binary:${JSON.stringify(f.runtime.binary)},shellDir:${JSON.stringify(f.runtime.shellDir)},
 fetch:(resource,init)=>{const url=new URL(String(resource));return fetch('http://127.0.0.1:${f.edgePort}'+url.pathname,{...init,headers:{host:url.host},redirect:'manual'})}
});
console.log(JSON.stringify(session.summary));
await session.closed;
`);
  const child = spawn("bun", [script], { stdio: ["ignore", "pipe", "pipe"] });
  disposals.push(async () => { if (child.exitCode === null) child.kill("SIGKILL"); });
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("Session did not become ready")), 90_000);
    child.once("error", error => { clearTimeout(deadline); reject(error); });
    child.once("exit", code => { clearTimeout(deadline); reject(new Error(`Session exited ${code}`)); });
    child.stdout.once("data", () => { clearTimeout(deadline); resolve(); });
  });
  const record = await f.record();
  child.kill("SIGKILL");
  await expect.poll(() => systemLockEnvironment.alive(record.cloudflaredPid), { timeout: 10_000 }).toBe(false);
  await f.start();
  expect((await f.record()).cloudflaredPid).not.toBe(record.cloudflaredPid);
}, 120_000);

it("IT-007: flow and all targets publish their direct links and scoped registries", async () => {
  const f = await fixture();
  for (const target of [{ kind: "flow", id: "journey" }, { kind: "all" }] as const) {
    const session = await f.start(false, target);
    expect(session.summary.link).toBe(`https://${shellHost}/${target.kind === "flow" ? "?flow=journey" : ""}`);
    const registry = await (await f.request("/api/registry", { email: "bob@example.com" })).json();
    expect(registry.prototypes.map((item: { slug: string }) => item.slug).sort()).toEqual(target.kind === "flow" ? ["example"] : ["example", "private"]);
    await session.stop();
  }
}, 120_000);
