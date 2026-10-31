// Invariant: Better Auth identity/allowlist, Hono mount and render dispatch compose without CORS.
// Owner: API integration; disposable database like the existing db harness.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "@proto/db/testing";
import { createApp } from "../src/app";
import { createAuth } from "../src/platform/auth";
import { createProtoReview } from "../src/platform/proto";
import { loadEnv } from "../src/platform/env";
import {
  serverHarness,
  browserServer,
  buildRemoteGallery,
} from "../../../packages/proto/test/node/server/harness.ts";
describe.skipIf(!process.env.TEST_DATABASE_URL)("Proto API integration", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let fixture: Awaited<ReturnType<typeof serverHarness>>;
  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await serverHarness();
  });
  afterAll(async () => {
    await fixture?.dispose();
    await database?.drop();
  });
  it("IT-024/032: real session authorizes allowed users and never reaches auth on render", async () => {
    const env = loadEnv({
      DATABASE_URL: database.url,
      API_URL: "https://gallery.example.com",
      APP_URL: "https://gallery.example.com",
      BETTER_AUTH_SECRET: "test-secret-at-least-thirty-two-characters",
      PROTO_PUBLIC_ORIGIN: "https://gallery.example.com",
      PROTO_RENDER_ORIGIN: "https://render.example.net",
      PROTO_TICKET_SECRET: "s".repeat(32),
      PROTO_REVIEW_EMAILS: "review@example.com",
      PROTO_GALLERY_DIR: fixture.options.gallery.dir,
      NODE_ENV: "production",
    });
    const auth = createAuth(database.db, env);
    const proto = createProtoReview(database.db, env, auth)!;
    await proto.migrate();
    const app = createApp(database.db, env, proto.fetch);
    const signup = await auth.handler(
      new Request(`${env.API_URL}/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: env.APP_URL },
        body: JSON.stringify({
          email: "review@example.com",
          password: "test-password-strong",
          name: "Reviewer",
        }),
      })
    );
    expect(signup.status).toBe(200);
    const cookies = signup.headers.getSetCookie();
    expect(cookies.join(";")).toContain("Secure");
    expect(cookies.join(";")).toContain("HttpOnly");
    expect(cookies.join(";")).not.toMatch(/Domain=/i);
    const cookie = cookies.map(c => c.split(";")[0]).join("; ");
    const unverified = await app.request(`${env.PROTO_PUBLIC_ORIGIN}/proto/api/session`, {
      headers: { cookie },
    });
    expect(unverified.status).toBe(401);
    expect(await unverified.json()).toMatchObject({ error: { code: "auth_required" } });
    await database.db
      .$client`update "user" set email_verified = true where email = 'review@example.com'`;
    const session = await app.request(`${env.PROTO_PUBLIC_ORIGIN}/proto/api/session`, {
      headers: { cookie },
    });
    expect(session.status).toBe(200);
    expect((await session.json()).principal).toMatchObject({
      kind: "reviewer",
      scopes: ["review", "comment"],
    });
    const denied = await app.request(`${env.PROTO_PUBLIC_ORIGIN}/proto/api/credentials`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.test", "content-type": "application/json" },
      body: JSON.stringify({ name: "forged" }),
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    const render = await app.request(`${env.PROTO_RENDER_ORIGIN}/auth/get-session`, {
      headers: { cookie },
    });
    expect(render.status).toBe(401);
    expect(await render.text()).toContain("auth:expired");
    const document = await app.request(`${env.PROTO_PUBLIC_ORIGIN}/openapi.json`);
    expect(Object.keys((await document.json()).paths).some(path => path.startsWith("/proto"))).toBe(
      false
    );
  });
  // Deployed journey: actual SPA login, Hono/Beter Auth, package build, TLS and CLI process.
  it("E2E-012: browser reviewer and remote CLI agent complete the deployed review loop", async () => {
    const { chromium, createViteServer: createServer } =
      await import("../../../packages/proto/test/node/server/harness.ts");
    const { resolve, join } = await import("node:path");
    const { writeFile } = await import("node:fs/promises");
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const h = await serverHarness();
    let app: ReturnType<typeof createApp>;
    let spaOrigin = "";
    const tls = await browserServer(h, async request => {
      const url = new URL(request.url);
      if (
        url.host === new URL(h.options.renderOrigin).host ||
        url.pathname.startsWith("/proto/") ||
        url.pathname.startsWith("/auth/")
      )
        return app.request(request);
      return fetch(spaOrigin + url.pathname + url.search);
    });
    const env = loadEnv({
      DATABASE_URL: database.url,
      API_URL: h.options.publicOrigin,
      APP_URL: h.options.publicOrigin,
      BETTER_AUTH_SECRET: "deployment-test-secret-at-least-thirty-two-characters",
      PROTO_PUBLIC_ORIGIN: h.options.publicOrigin,
      PROTO_RENDER_ORIGIN: h.options.renderOrigin,
      PROTO_TICKET_SECRET: "s".repeat(32),
      PROTO_REVIEW_EMAILS: "deployed@example.com",
      PROTO_GALLERY_DIR: h.options.gallery.dir,
      NODE_ENV: "production",
    });
    const auth = createAuth(database.db, env);
    const proto = createProtoReview(database.db, env, auth)!;
    await proto.migrate();
    app = createApp(database.db, env, proto.fetch);
    const signup = await auth.handler(
      new Request(env.API_URL + "/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: env.APP_URL },
        body: JSON.stringify({
          email: "deployed@example.com",
          password: "deployed-password-strong",
          name: "Deployed Reviewer",
        }),
      })
    );
    expect(signup.status).toBe(200);
    await database.db
      .$client`update "user" set email_verified=true where email='deployed@example.com'`;
    await buildRemoteGallery(h);
    const spa = await createServer({
      root: resolve(import.meta.dirname, "../../app"),
      cacheDir: join(h.root, "vite-cache"),
      define: { "import.meta.env.VITE_API_URL": JSON.stringify(env.API_URL) },
      server: { host: "127.0.0.1", port: 0 },
      logLevel: "silent",
    });
    await spa.listen();
    spaOrigin = spa.resolvedUrls!.local[0]!.replace(/\/$/, "");
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-proxy-server",
        "--host-resolver-rules=MAP gallery.example.com 127.0.0.1, MAP render.example.net 127.0.0.1",
      ],
    });
    try {
      const page = await browser.newPage({ ignoreHTTPSErrors: true });
      const target = env.API_URL + "/proto/?p=login-form&state=default";
      await page.goto(target);
      await page.getByLabel("Email", { exact: true }).fill("deployed@example.com");
      await page.getByLabel("Password", { exact: true }).fill("deployed-password-strong");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(target);
      const frame = page.frameLocator("iframe").first();
      await frame.getByTestId("remote-pick").waitFor();
      await page.getByTestId("comment-tool").click();
      await frame.getByTestId("proto-picker").waitFor();
      const bounds = (await frame.getByTestId("remote-pick").boundingBox())!;
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      const composer = page.getByTestId("comment-composer");
      await composer.getByRole("textbox").fill("Please improve this target.");
      const posted = page.waitForResponse(
        response =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/proto/api/comments"
      );
      await composer.getByRole("button", { name: "Comment", exact: true }).click();
      const response = await posted;
      expect(response.status(), await response.text()).toBe(201);
      await page.getByRole("tab", { name: /Comments/ }).click();
      await page.getByRole("article", { name: "Comment #1" }).waitFor();
      const credential = await page.evaluate(async () =>
        (
          await fetch("api/credentials", {
            method: "POST",
            headers: { "content-type": "application/json", "x-proto-request": "1" },
            body: JSON.stringify({ name: "cli-journey" }),
          })
        ).json()
      );
      expect(credential.credential.scopes).toEqual(["comment"]);
      // DNS is the sole I/O substitution: Node and Chromium resolve the same two test domains locally.
      const preload = join(h.root, "dns.cjs");
      await writeFile(
        preload,
        `const dns=require('node:dns');const original=dns.lookup;dns.lookup=function(host,options,callback){if(typeof options==='function'){callback=options;options={};}if(['gallery.example.com','render.example.net'].includes(host)){queueMicrotask(()=>options?.all?callback(null,[{address:'127.0.0.1',family:4}]):callback(null,'127.0.0.1',4));return;}return original.call(this,host,options,callback);};require('node:module').syncBuiltinESMExports();`
      );
      const cli = async (...args: string[]) =>
        promisify(execFile)(
          process.execPath,
          [
            "--experimental-transform-types",
            "--require",
            preload,
            resolve(import.meta.dirname, "../../../packages/proto/dist/package/src/cli/main.js"),
            ...args,
            "--app",
            resolve(import.meta.dirname, "../../app"),
            "--json",
          ],
          {
            env: {
              ...process.env,
              PROTO_REMOTE_URL: env.API_URL + "/proto/",
              PROTO_REMOTE_TOKEN: credential.token,
              NODE_TLS_REJECT_UNAUTHORIZED: "0",
            },
            timeout: 30000,
          }
        );
      const listed = JSON.parse((await cli("comments", "list", "--remote")).stdout);
      const comment = listed.comments.find(
        (c: { thread: { body: string }[] }) => c.thread[0]?.body === "Please improve this target."
      );
      expect(comment).toBeDefined();
      const replied = JSON.parse(
        (
          await cli(
            "comments",
            "reply",
            comment.id,
            "--note",
            "Improved in the agent loop.",
            "--remote"
          )
        ).stdout
      );
      expect(replied.comment.thread.at(-1)).toMatchObject({
        author: "agent",
        authorId: comment.thread[0].authorId,
        authorName: "Deployed Reviewer · cli-journey",
      });
      await page.getByText("Improved in the agent loop.", { exact: true }).waitFor();
      await page.goto(env.API_URL + "/proto/?comments=waiting");
      await page.getByRole("tab", { name: "Waiting · 1", exact: true }).waitFor();
      expect(
        await page
          .getByRole("tab", { name: "Waiting · 1", exact: true })
          .getAttribute("aria-selected")
      ).toBe("true");
      await page
        .getByText("Deployed Reviewer · cli-journey replied · waiting for you", { exact: true })
        .waitFor();
      await page.goto(target);
      await page.getByRole("banner").getByRole("button", { name: "Approve", exact: true }).click();
      await page.getByRole("button", { name: "Approve anyway", exact: true }).click();
      await page.getByRole("banner").getByText("Approved", { exact: true }).waitFor();
      await expect(cli("review", "approve", "login-form", "--remote")).rejects.toMatchObject({
        code: 4,
        stdout: expect.stringContaining("scope_denied"),
      });
      expect(
        tls.seen
          .filter(r => r.host.startsWith("render."))
          .every(r => !r.cookie.includes("session_token"))
      ).toBe(true);
      expect(await frame.getByTestId("hostile-cookie").textContent()).toBe("empty");
      await database.db
        .$client`update "user" set email_verified=false where email='deployed@example.com'`;
      await expect(cli("comments", "list", "--remote")).rejects.toMatchObject({
        code: 4,
        stdout: expect.stringContaining("invalid_credential"),
      });
    } finally {
      await browser.close();
      await spa.close();
      await tls.close();
      await h.dispose();
    }
  }, 180000);
});
