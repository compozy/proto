/**
 * Review journeys of the shell (`_tests.md` E2E-008, E2E-009, the shell half of IT-029 and
 * IT-002): the shell built from source, `apps/app` on the real `proto dev` with its review store
 * in a temporary directory, agents writing through the real CLI in a separate process, and the
 * real remote review server for the expired-session round trip, and a real `proto share`
 * session behind the local TLS harness for the share journeys (proto-share E2E-001, E2E-004).
 * Playwright Chromium drives the browser; assertions own the journeys, not serialization (the
 * CLI and store suites own that).
 */
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page, type Route } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { NewComment } from "../../../src/model/review.ts";
import { loadProject } from "../../../src/node/project.ts";
import { createReviewServer, fileStorage } from "../../../src/server/index.ts";
import { CloudflareClient } from "../../../src/share/cloudflare.ts";
import { connect } from "../../../src/share/connection.ts";
import { startShare, type ShareSession } from "../../../src/share/session.ts";
import { appFixture } from "../app-fixture.ts";
import { browserServer } from "../server/harness.ts";
import { fakeCloudflare } from "../share/cloudflare-fixture.ts";
import { cloudflaredStub } from "../share/cloudflared-stub.ts";
import {
  buildShell,
  onFreePorts,
  renderFrame,
  reviewFixture,
  runCli,
  startProtoDev,
  workDir,
  writeApp,
} from "./shell.ts";

const work = workDir("shell-review");
const app = join(work.dir, "app");
let shellDir: string;
let dev: Awaited<ReturnType<typeof startProtoDev>>;
let browser: Browser;

beforeAll(async () => {
  writeApp(app, reviewFixture);
  shellDir = await buildShell(join(work.dir, "shell"));
  dev = await startProtoDev(app, shellDir);
  browser = await chromium.launch();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await dev?.close();
  work.remove();
});

function comment(state: string, body: string): NewComment {
  return {
    body,
    context: { state, theme: "light", role: null, viewport: { width: 1440, height: 900 } },
    target: {
      kind: "element",
      selector: "main",
      testId: null,
      tag: "main",
      text: "",
      source: "src/components/login-form.tsx:12:5",
      sourceChain: ["src/components/login-form.tsx:12:5"],
      rect: { x: 100, y: 100, width: 200, height: 40 },
      rectNormalized: { x: 0.1, y: 0.2, width: 0.2, height: 0.05 },
      offset: null,
    },
  };
}

const reviewer = { kind: "reviewer" } as const;

async function open(path: string, origin = dev.origin) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  return page;
}

describe("review journeys against proto dev", () => {
  it("the URL owns thread and pin focus across links, navigation and browser history", async () => {
    // Invariant: focus survives a deep link/back navigation and never leaks to another review.
    // Owner: the shell review journey, with the real FileStore and render frame.
    const focusApp = join(work.dir, "focus-app");
    writeApp(focusApp, reviewFixture);
    const focusDev = await startProtoDev(focusApp, shellDir);
    const thread = await focusDev.store.add(
      "login-form",
      comment("sign-in", "Focus stays with this review"),
      reviewer
    );
    const page = await open(`/?p=login-form&state=sign-in&comment=${thread.id}`, focusDev.origin);
    try {
      const pin = page.locator(`[data-testid="comment-pin"][data-comment="${thread.id}"]`);
      await expect.poll(() => pin.getAttribute("aria-pressed"), { timeout: 15_000 }).toBe("true");
      await pin.click();
      await expect.poll(() => new URL(page.url()).searchParams.get("comment")).toBeNull();
      await pin.click();
      await expect.poll(() => new URL(page.url()).searchParams.get("comment")).toBe(thread.id);
      await page.getByRole("link", { name: "Screens", exact: true }).click();
      await page
        .getByRole("link", { name: /Welcome home/ })
        .first()
        .click();
      await page.getByRole("tab", { name: /Comments/ }).click();
      expect(await page.getByText(/was deleted elsewhere/).count()).toBe(0);
      expect(new URL(page.url()).searchParams.get("comment")).toBeNull();
      await page.goBack();
      await page.goBack();
      await expect.poll(() => pin.getAttribute("aria-pressed"), { timeout: 15_000 }).toBe("true");
    } finally {
      await page.close();
      await focusDev.close();
    }
  });

  it("E2E-008 / US-020: approve with an open comment confirms; a new comment reopens with its event", async () => {
    await dev.store.add("login-form", comment("error", "Spacing too tight"), reviewer);
    const page = await open("/?p=login-form&state=error");
    const banner = page.getByRole("banner");
    await banner.getByText("1 open").waitFor({ timeout: 20_000 });

    await banner.getByRole("button", { name: "Approve" }).click();
    const dialog = page.getByRole("dialog", { name: "Approve Sign in?" });
    await dialog.getByText("1 comment is still open.").waitFor();
    await dialog.getByRole("button", { name: "Approve anyway" }).click();
    await banner.getByText("Approved", { exact: true }).waitFor();
    expect((await dev.store.review("login-form")).events.at(-1)).toMatchObject({
      type: "approved",
      openCount: 1,
    });

    // An agent comments from its own process (the CLI): the key goes back to review (IT-002).
    const added = await runCli([
      "comments",
      "add",
      "login-form",
      "--state",
      "error",
      "--note",
      "Still too tight",
      "--selector",
      "main",
      "--app",
      app,
      "--json",
    ]);
    expect(added.code, added.stderr).toBe(0);
    await banner.getByRole("button", { name: "Approve" }).waitFor({ timeout: 15_000 });
    await banner.getByText("2 open").waitFor();
    const history = (await dev.store.review("login-form")).events;
    expect(history.at(-1)).toMatchObject({ type: "auto_reopened" });

    // F1: the review history shows the approval and the automatic reopening, linked to its thread.
    await page.getByRole("tab", { name: /Comments/ }).click();
    const events = page.getByRole("region", { name: "Review history" });
    await events.getByText(/^Approved by Reviewer/).waitFor();
    const link = events.getByRole("button", { name: /Back in review: new comment #2/ });
    await link.click();
    await page
      .getByRole("article", { name: "Comment #2" })
      .and(page.locator('[aria-current="true"]'))
      .waitFor();
    await page.close();
  }, 90_000);

  it("E2E-009 / US-021: Waiting lists the agent-replied thread; selecting opens it in context, also for flows", async () => {
    const added = await dev.store.add("welcome", comment("default", "Steps need icons"), reviewer);
    // The dev store is shared by the suite: earlier journeys may leave agent-answered threads.
    const waiting = (await dev.store.list({ status: "open" })).filter(
      item => item.thread.at(-1)?.author === "agent"
    ).length;
    const page = await open("/?comments=waiting");
    await page.getByRole("tab", { name: `Waiting · ${waiting}` }).waitFor({ timeout: 20_000 });
    expect(await page.getByRole("button", { name: /Steps need icons/ }).count()).toBe(0);

    const replied = await runCli([
      "comments",
      "reply",
      added.id,
      "--note",
      "Added an icon per step.",
      "--app",
      app,
      "--json",
    ]);
    expect(replied.code, replied.stderr).toBe(0);
    await page.getByRole("tab", { name: `Waiting · ${waiting + 1}` }).waitFor({ timeout: 15_000 });
    const item = page.getByRole("button", { name: /Steps need icons/ });
    await item.getByText("Agent replied · waiting for you").waitFor({ timeout: 15_000 });
    await item.click();
    await page.getByRole("link", { name: "Open in context" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("comment")).toBe(added.id);
    expect(new URL(page.url()).searchParams.get("p")).toBe("welcome");
    await page
      .getByRole("article", { name: "Comment #1" })
      .and(page.locator('[aria-current="true"]'))
      .waitFor();
    expect(await page.getByRole("tab", { name: /Comments/ }).getAttribute("aria-selected")).toBe(
      "true"
    );

    // F3: a resolved flow-step comment opens on the flow, its step, the Comments tab and thread.
    const step = await dev.store.add(
      "flow-sign-in",
      {
        ...comment("error", "Retry link missing"),
        target: { kind: "node", node: "error", label: "Wrong password" },
      },
      reviewer
    );
    await dev.store.setStatus(step.id, "resolved", reviewer);
    await page.goto(`${dev.origin}/?comments=resolved`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.getByRole("button", { name: /Retry link missing/ }).click();
    await page.getByRole("link", { name: "Open in context" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("comment")).toBe(step.id);
    expect(new URL(page.url()).searchParams.get("flow")).toBe("sign-in");
    expect(new URL(page.url()).searchParams.get("node")).toBe("error");
    await page
      .getByRole("tab", { name: /Resolved · 1/ })
      .and(page.locator('[aria-selected="true"]'))
      .waitFor();
    await page
      .getByRole("article", { name: "Comment #1" })
      .and(page.locator('[aria-current="true"]'))
      .waitFor();
    await page.close();
  }, 90_000);
});

describe("remote review server", () => {
  it("IT-029 (shell half): an expired session keeps the reply draft; sign-in returns to the same screen", async () => {
    const gallery = join(work.dir, "remote-gallery");
    cpSync(shellDir, gallery, { recursive: true });
    mkdirSync(join(gallery, "__proto/render"), { recursive: true });
    const registry = await (await loadProject(app)).registry();
    writeFileSync(join(gallery, "__proto/registry.json"), JSON.stringify(registry));
    writeFileSync(
      join(gallery, "__proto/render/index.html"),
      "<!doctype html><title>render</title>"
    );
    writeFileSync(
      join(gallery, "__proto/bootstrap.json"),
      JSON.stringify({
        mode: "read-only",
        title: "Remote",
        locale: "en",
        commit: null,
        apiBase: null,
        eventsUrl: null,
        renderUrl: "__proto/render/index.html",
        registryUrl: "__proto/registry.json",
        reviewSnapshotBase: null,
        principal: null,
        signInUrl: null,
      })
    );
    let signedIn = true;
    const identity = { id: "usr_1", name: "Pedro Nauck", scopes: ["review", "comment"] as const };
    const { server, origin } = await onFreePorts(
      port =>
        new Promise<{ server: Server; origin: string }>((done, fail) => {
          const origin = `http://127.0.0.1:${port}`;
          const handler = createReviewServer({
            storage: fileStorage(join(work.dir, "remote-reviews")),
            gallery: { dir: gallery },
            publicOrigin: origin,
            renderOrigin: `http://localhost:${port}`,
            basePath: "/proto/",
            ticketSecret: "t".repeat(32),
            authorize: async request =>
              signedIn && request.headers.get("cookie")?.includes("session=ok")
                ? { ...identity, scopes: [...identity.scopes] }
                : null,
            credentialOwner: async () => ({ ...identity, scopes: [...identity.scopes] }),
            // The project's sign-in: signs in and forwards `returnTo` unchanged.
            signIn: (_request, returnTo) => {
              signedIn = true;
              return new Response(null, {
                status: 302,
                headers: { Location: returnTo, "Set-Cookie": "session=ok; Path=/; HttpOnly" },
              });
            },
            log: () => {},
          });
          const http = createServer(async (req, res) => {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks);
            const response = await handler(
              new Request(`http://${req.headers.host}${req.url}`, {
                method: req.method,
                headers: req.headers as Record<string, string>,
                ...(body.length ? { body } : {}),
              })
            );
            res.writeHead(response.status, Object.fromEntries(response.headers));
            res.end(Buffer.from(await response.arrayBuffer()));
          });
          http.once("error", fail);
          http.listen(port, "127.0.0.1", () => done({ server: http, origin }));
        })
    );
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      await context.addCookies([{ name: "session", value: "ok", url: origin }]);
      const page = await context.newPage();
      const created = await page.request.post(`${origin}/proto/api/comments`, {
        headers: { origin, "x-proto-request": "1" },
        data: { key: "login-form", ...comment("sign-in", "Button too wide") },
      });
      expect(created.status()).toBe(201);
      const { comment: thread } = (await created.json()) as { comment: { id: string } };
      const screen = `/proto/?p=login-form&state=sign-in&comment=${thread.id}`;
      await page.goto(`${origin}${screen}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const reply = page.getByRole("textbox", { name: "Reply…" });
      await reply.fill("Narrowed it to the form width.");

      // The session ends server-side; the next write answers 401 auth_required.
      signedIn = false;
      await page.getByRole("button", { name: "Reply", exact: true }).click();
      const expired = page.getByRole("alert").filter({ hasText: "Your session expired." });
      await expired.waitFor();
      const href = await expired.getByRole("link", { name: "Sign in again" }).getAttribute("href");
      expect(new URL(href!, origin).pathname).toBe("/proto/sign-in");
      expect(new URL(href!, origin).searchParams.get("returnTo")).toBe(screen);
      expect(await reply.inputValue()).toBe("Narrowed it to the form width.");

      // Round trip through the project's sign-in: back on the same screen with the draft.
      await expired.getByRole("link", { name: "Sign in again" }).click();
      await page.waitForURL(`${origin}${screen}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await expect
        .poll(() => page.getByRole("textbox", { name: "Reply…" }).inputValue())
        .toBe("Narrowed it to the form width.");
      await page.getByRole("button", { name: "Reply", exact: true }).click();
      await page.getByText("Narrowed it to the form width.", { exact: true }).waitFor();
      await expect.poll(() => page.getByRole("textbox", { name: "Reply…" }).inputValue()).toBe("");
    } finally {
      await context.close();
      await new Promise<void>(done => server.close(() => done()));
    }
  }, 90_000);
});

/**
 * A real `proto share` session (`startShare`: scoped snapshot build, review server, Access
 * authorizer, origin adapter, control) for one approver. Substituted only at the network and
 * process boundaries, as in `test/node/share/session.test.ts`: the fake Cloudflare API, the stub
 * `cloudflared`, Access signing keys from a test RSA key, and the tunnel itself, which is the
 * TLS harness of `browserServer` forwarding `proto-test.example.com` and
 * `proto-test-render.example.com` to the session's origin port. Like Access, it adds a signed
 * `Cf-Access-Jwt-Assertion` to requests for the shell host only.
 */
describe("proto share journeys", () => {
  const shellHost = "proto-test.example.com";
  const renderHost = "proto-test-render.example.com";
  const approver = "ana@example.com";
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let workspace: string;
  let root: string;
  let scratch: string;
  let session: ShareSession;
  let transport: Awaited<ReturnType<typeof browserServer>>;
  let shareBrowser: Browser;
  let closeApi: () => Promise<void>;
  let originPort: () => number;
  /** While set, new event streams wait for it, so a dropped stream stays down. */
  let streamsHeld: Promise<void> | null = null;
  let releaseStreams = () => {};

  function jwt(email: string) {
    const now = Date.now() / 1000;
    const data = [
      { alg: "RS256", kid: "test" },
      {
        iss: "https://acme.cloudflareaccess.com",
        aud: ["audience"],
        email,
        nbf: now - 60,
        exp: now + 3600,
      },
    ]
      .map(value => Buffer.from(JSON.stringify(value)).toString("base64url"))
      .join(".");
    return `${data}.${sign("RSA-SHA256", Buffer.from(data), keys.privateKey).toString("base64url")}`;
  }

  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

  /** Commit a new version of the shared screen; approvers need a committed tree. */
  function commitVersion(label: string) {
    writeFileSync(
      join(root, "src/view.tsx"),
      `export function View() { return <main data-testid="shared-view"><h1>${label}</h1></main>; }\n`
    );
    git("add", "--all");
    git("commit", "--quiet", "-m", label);
  }

  /** Hop-by-hop headers stay on their own connection. */
  const hop = new Set([
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "content-length",
    // `fetch` decodes bodies; the browser must receive them as they are relayed.
    "accept-encoding",
  ]);
  async function tunnel(request: Request) {
    const url = new URL(request.url);
    if (streamsHeld && url.pathname.endsWith("/api/events")) await streamsHeld;
    const headers = new Headers();
    for (const [name, value] of request.headers) if (!hop.has(name)) headers.set(name, value);
    headers.set("host", url.host);
    if (url.host === shellHost) headers.set("Cf-Access-Jwt-Assertion", jwt(approver));
    return fetch(`http://127.0.0.1:${originPort()}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      redirect: "manual",
      ...(["GET", "HEAD"].includes(request.method) ? {} : { body: await request.arrayBuffer() }),
    });
  }

  beforeAll(async () => {
    workspace = appFixture("share-e2e-");
    root = join(workspace, "apps/app");
    scratch = mkdtempSync(join(tmpdir(), "proto-share-e2e-"));
    writeApp(root, {
      "package.json": JSON.stringify({ private: true, type: "module" }),
      "proto.config.ts": "export default { title: 'Share journey' };\n",
      "vite.config.ts":
        "import react from '@vitejs/plugin-react';\nexport default { plugins: [react()] };\n",
      "proto.canvas.tsx": "export function Canvas({ children }) { return children; }\n",
      "src/example.proto.tsx": `import { definePrototype } from "@compozy/proto";
import { View } from "./view";
export const meta = definePrototype({ title: "Example", states: [{ id: "default", label: "Default" }] });
export default View;
`,
      "src/private.proto.tsx": `import { definePrototype } from "@compozy/proto";
export const meta = definePrototype({ title: "Private", states: [{ id: "default", label: "Default" }] });
export default function Private() { return <main>Not shared</main>; }
`,
    });
    writeFileSync(join(workspace, ".gitignore"), "/node_modules\n");
    git("init", "--quiet", workspace);
    git("config", "user.name", "Share journey");
    git("config", "user.email", "test@example.com");
    git("config", "commit.gpgsign", "false");
    git("config", "core.hooksPath", join(scratch, "no-hooks"));
    commitVersion("Version one");

    const api = await fakeCloudflare();
    closeApi = () => api.close();
    const client = new CloudflareClient("api-secret", api.url);
    const connectionPath = join(scratch, "config/cloudflare.json");
    await connect({ apiToken: "api-secret", name: "proto-test", path: connectionPath, client });
    originPort = () => {
      const config = api.state.ingress as { config: { ingress: { service: string }[] } };
      return Number(new URL(config.config.ingress[0]!.service).port);
    };
    const jwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "test", alg: "RS256" };
    session = await startShare(
      await loadProject(root),
      { target: { kind: "prototype", slug: "example" }, approvers: [approver], commenters: [] },
      {
        path: join(scratch, "config/share-session.json"),
        connectionPath,
        client,
        binary: await cloudflaredStub(join(scratch, "cloudflared")),
        shellDir,
        // Access keys and the edge: the shell host is behind Access (302), the render host
        // reaches this session's origin.
        fetch: async (resource, init) => {
          const url = new URL(String(resource));
          if (url.pathname === "/cdn-cgi/access/certs") return Response.json({ keys: [jwk] });
          if (url.host === shellHost)
            return new Response(null, {
              status: 302,
              headers: { Location: "https://acme.cloudflareaccess.com/cdn-cgi/access/login" },
            });
          return fetch(`http://127.0.0.1:${originPort()}${url.pathname}${url.search}`, {
            ...init,
            headers: { host: url.host },
            redirect: "manual",
          });
        },
      }
    );
    transport = await browserServer(
      {
        root: scratch,
        handler: tunnel,
        options: { publicOrigin: "", renderOrigin: "" },
        rebuild() {},
      },
      undefined,
      { public: shellHost, render: renderHost }
    );
    shareBrowser = await transport.launch("chromium");
  }, 240_000);

  afterAll(async () => {
    releaseStreams();
    await shareBrowser?.close();
    await session?.stop();
    await transport?.close();
    await closeApi?.();
    rmSync(workspace, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  });

  /** A fresh reviewer page on the share link; `prepare` runs before it navigates. */
  async function openShare(prepare?: (page: Page) => Promise<unknown>) {
    const context = await shareBrowser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await prepare?.(page);
    await page.goto(session.summary.link, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return page;
  }

  const shown = (page: Page, text: string) =>
    renderFrame(page, `https://${renderHost}`, "[data-testid=shared-view]").then(frame =>
      frame.getByText(text).waitFor({ timeout: 30_000 })
    );

  async function reviewStatus() {
    const result = await runCli(["review", "status", "example", "--app", root, "--json"]);
    expect(result.code, result.stderr).toBe(0);
    const body = JSON.parse(result.stdout) as {
      review?: { events: { type: string; authorId?: string; commit?: string | null }[] };
      events?: { type: string; authorId?: string; commit?: string | null }[];
    };
    return body.review?.events ?? body.events ?? [];
  }

  /** Start a comment on the shared screen and type `body` without sending it. */
  async function draft(page: Page, body: string) {
    const frame = await renderFrame(page, `https://${renderHost}`, "[data-testid=shared-view]");
    await page.getByTestId("comment-tool").click();
    await frame.getByTestId("proto-picker").waitFor();
    const bounds = (await frame.locator("[data-testid=shared-view] h1").boundingBox())!;
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    const composer = page.getByTestId("comment-composer");
    await composer.waitFor();
    await composer.getByRole("textbox", { name: "Write a comment…" }).fill(body);
    return composer;
  }

  it("E2E-001: open, comment, reply, no credentials, stale approval refused, reload, approve", async () => {
    // Invariant: a reviewer reaches only the shared screen, converses with the agent, and can
    // approve only the version on screen, recorded with their email and its commit.
    // Owner: the share journey across shell, review server and session.
    const page = await openShare();
    try {
      await shown(page, "Version one");
      expect(await page.getByRole("link", { name: "Private" }).count()).toBe(0);

      const composer = await draft(page, "The heading needs more contrast");
      await composer.locator('button[type="submit"]').click();
      const project = await loadProject(root);
      const stored = async () => (await project.store().list({ key: "example" }))[0]?.id ?? "";
      await expect.poll(stored).not.toBe("");
      const id = await stored();
      const replied = await runCli([
        "comments",
        "reply",
        id,
        "--note",
        "Raised the contrast.",
        "--app",
        root,
        "--json",
      ]);
      expect(replied.code, replied.stderr).toBe(0);
      await page.getByRole("tab", { name: /Comments/ }).click();
      await page.getByText("Raised the contrast.").waitFor({ timeout: 20_000 });

      // US-008.EC-4: a share has no credentials, so Settings has no such section.
      await page.goto(`https://${shellHost}/?settings=credentials`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator('a[href*="settings=project"]').first().waitFor();
      expect(await page.locator('a[href*="settings=credentials"]').count()).toBe(0);
      await page.goto(session.summary.link, { waitUntil: "domcontentloaded" });
      await shown(page, "Version one");

      // US-005: a refresh reaches the open page as S1; the screen keeps the loaded version.
      commitVersion("Version two");
      await session.refresh();
      const notice = page.getByTestId("session-notice");
      await notice.getByText("A new version is available.").waitFor({ timeout: 20_000 });
      await shown(page, "Version one");

      // US-009.AC-2: approving the old version is refused; the dialog does not stay open.
      const banner = page.getByRole("banner");
      await banner.getByRole("button", { name: "Approve" }).click();
      await page.getByRole("button", { name: "Approve anyway" }).click();
      await expect.poll(() => page.getByRole("dialog").count()).toBe(0);
      expect(await notice.getAttribute("data-status")).toBe("stale");
      expect((await reviewStatus()).some(event => event.type === "approved")).toBe(false);

      // Reload keeps the view (the URL) and shows the new version, which approves.
      await notice.getByRole("button", { name: "Reload" }).click();
      await shown(page, "Version two");
      expect(new URL(page.url()).searchParams.get("p")).toBe("example");
      await banner.getByRole("button", { name: "Approve" }).click();
      await page.getByRole("button", { name: "Approve anyway" }).click();
      await banner.getByText("Approved", { exact: true }).waitFor();
      expect((await reviewStatus()).at(-1)).toMatchObject({
        type: "approved",
        authorId: approver,
        commit: git("rev-parse", "HEAD"),
      });
    } finally {
      await page.context().close();
    }
  }, 180_000);

  it("E2E-004: session and version notices after failures, a dropped stream and a lost chunk", async () => {
    // Invariant: only a failed bootstrap retry ends the session (S4); a missed snapshot event
    // or a chunk of a replaced version still reaches S1. Owner: shell session watch, end to end.
    const notice = (page: Page) => page.getByTestId("session-notice");
    const bootstraps = (page: Page) => {
      const seen = { count: 0 };
      page.on("requestfinished", request => {
        if (request.url().endsWith("/__proto/bootstrap.json")) seen.count += 1;
      });
      return seen;
    };

    // Review API fetches only: the event stream and render tickets keep their own recovery.
    const api = (url: URL) =>
      url.host === shellHost &&
      url.pathname.startsWith("/api/") &&
      !url.pathname.endsWith("/events") &&
      !url.pathname.endsWith("/render-ticket");

    // A passing API failure: the bootstrap retry answers, so no notice.
    let failed = 0;
    let seen = { count: 0 };
    const passing = await openShare(async page => {
      seen = bootstraps(page);
      await page.route(
        api,
        route => {
          failed += 1;
          return route.abort();
        },
        { times: 1 }
      );
    });
    try {
      await shown(passing, "Version two");
      expect(failed).toBe(1);
      await expect.poll(() => seen.count).toBeGreaterThanOrEqual(2);
      await passing.waitForTimeout(500);
      expect(await notice(passing).count()).toBe(0);

      // The API and the bootstrap retry both fail: S4, warning about the unsent draft.
      const composer = await draft(passing, "Unsent thought");
      await passing.route(api, route => route.abort());
      await passing.route(`https://${shellHost}/__proto/bootstrap.json`, route => route.abort());
      await composer.locator('button[type="submit"]').click();
      await notice(passing).getByText("This session ended.").waitFor({ timeout: 20_000 });
      await notice(passing).getByText("Your unsent comment will be lost.").waitFor();
    } finally {
      await passing.context().close();
    }

    // The stream drops across a refresh and reconnects: the missed event becomes S1.
    const dropped = await openShare();
    try {
      await shown(dropped, "Version two");
      streamsHeld = new Promise<void>(resolve => {
        releaseStreams = resolve;
      });
      transport.dropStreams();
      commitVersion("Version three");
      await session.refresh();
      await dropped.waitForTimeout(500);
      expect(await notice(dropped).count()).toBe(0);
      streamsHeld = null;
      releaseStreams();
      await notice(dropped).getByText("A new version is available.").waitFor({ timeout: 20_000 });
    } finally {
      await dropped.context().close();
    }

    // A lazy chunk of the loaded version is gone after one refresh: the frame failure is S1.
    streamsHeld = new Promise<void>(resolve => {
      releaseStreams = resolve;
    });
    const held: Route[] = [];
    const lost = await openShare(page =>
      page.route(/\/assets\/example\.proto-[^/]+\.js(\?|$)/, route => {
        held.push(route);
      })
    );
    try {
      await expect.poll(() => held.length, { timeout: 30_000 }).toBeGreaterThan(0);
      commitVersion("Version four");
      await session.refresh();
      for (const route of held.splice(0)) await route.continue();
      await notice(lost).getByText("A new version is available.").waitFor({ timeout: 20_000 });
    } finally {
      streamsHeld = null;
      releaseStreams();
      await lost.context().close();
    }
  }, 240_000);
});
