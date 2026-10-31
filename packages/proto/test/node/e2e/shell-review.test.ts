/**
 * Review journeys of the shell (`_tests.md` E2E-008, E2E-009, the shell half of IT-029 and
 * IT-002): the shell built from source, `apps/app` on the real `proto dev` with its review store
 * in a temporary directory, agents writing through the real CLI in a separate process, and the
 * real remote review server for the expired-session round trip. Playwright Chromium drives the
 * browser; assertions own the journeys, not serialization (the CLI and store suites own that).
 */
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { NewComment } from "../../../src/model/review.ts";
import { loadProject } from "../../../src/node/project.ts";
import { createReviewServer, fileStorage } from "../../../src/server/index.ts";
import {
  buildShell,
  onFreePorts,
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

async function open(path: string) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${dev.origin}${path}`);
  return page;
}

describe("review journeys against proto dev", () => {
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
    const page = await open("/?comments=waiting");
    await page.getByRole("tab", { name: /Waiting · 0/ }).waitFor({ timeout: 20_000 });

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
    await page.goto(`${dev.origin}/?comments=resolved`);
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
      await page.goto(`${origin}${screen}`);
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
      await page.waitForURL(`${origin}${screen}`);
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
