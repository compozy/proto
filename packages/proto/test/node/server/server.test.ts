import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createReviewServer } from "../../../src/server/index.ts";
import { runStoreContract, input, png } from "../store/contract.ts";
import {
  httpContract,
  serverHarness,
  browserServer,
  publicOrigin,
  renderOrigin,
} from "./harness.ts";
// Invariants: public authorization and origin isolation. Owner: remote fetch boundary.
describe("IT-021: fileStorage over HTTP", () => {
  runStoreContract(() => httpContract());
});
describe("Remote authorization and render grants", () => {
  let h: Awaited<ReturnType<typeof serverHarness>>;
  beforeEach(async () => {
    h = await serverHarness();
  });
  afterEach(async () => {
    await h.dispose();
  });
  it("UT-055/075/076/077/093: bootstrap and both sign-in handoffs preserve relative returnTo", async () => {
    const anonymous = await h.request("api/comments", "GET", undefined, "");
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).error).toMatchObject({
      code: "auth_required",
      signInUrl: expect.stringContaining("/proto/sign-in?"),
    });
    expect(
      await (await h.request("__proto/bootstrap.json", "GET", undefined, "")).json()
    ).toMatchObject({
      mode: "remote",
      apiBase: "/proto/api/",
      renderUrl: `${renderOrigin}/__proto/render/`,
      principal: null,
    });
    const document = await h.request("?p=login-form&state=error", "GET", undefined, "");
    expect(document.status).toBe(302);
    const handoff = await h.request(
      new URL(document.headers.get("location")!, publicOrigin).href,
      "GET",
      undefined,
      ""
    );
    expect(new URL(handoff.headers.get("location")!).searchParams.get("returnTo")).toBe(
      "/proto/?p=login-form&state=error"
    );
    expect(
      new URL(
        (await h.request("sign-in?returnTo=https://evil.test/", "GET", undefined, "")).headers.get(
          "location"
        )!
      ).searchParams.get("returnTo")
    ).toBe("/proto/");
    h.options.signIn = (_request, returnTo) => Response.json({ returnTo });
    h.rebuild();
    expect(await (await h.request("sign-in?returnTo=%2Fproto%2F%3Fp%3Dlogin-form")).json()).toEqual(
      { returnTo: "/proto/?p=login-form" }
    );
  });
  it("UT-057/058/078/092: hashed credentials are returned once, revalidated, and revocable", async () => {
    expect(h.credential.token).toMatch(/^pcr_[a-f0-9]{64}$/);
    const stored = await readFile(join(h.root, "reviews/.server/credentials.json"), "utf8");
    expect(stored).not.toContain(h.credential.token);
    const headers = { authorization: `Bearer ${h.credential.token}` };
    const session = await h.request("api/session", "GET", undefined, "", headers);
    expect((await session.json()).principal).toMatchObject({
      id: "agent-id",
      kind: "agent",
      name: "Pedro Nauck · codex-ci",
      scopes: ["comment"],
    });
    expect((await h.options.storage.credentials.list("agent-id"))[0]!.lastUsedAt).not.toBeNull();
    expect(
      await (await h.request("api/credentials", "POST", { name: "forged" }, "", headers)).json()
    ).toMatchObject({ error: { code: "scope_denied" } });
    const agent = h.identities.get("agent")!;
    h.identities.delete("agent");
    expect((await h.request("api/session", "GET", undefined, "", headers)).status).toBe(401);
    h.identities.set("agent", { ...agent, scopes: ["review"] });
    expect((await h.request("api/session", "GET", undefined, "", headers)).status).toBe(401);
    h.identities.set("agent", agent);
    const listed = await (await h.request("api/credentials", "GET", undefined, "agent")).text();
    expect(listed).not.toContain(h.credential.token);
    expect(listed).not.toContain('"hash"');
    await h.request(`api/credentials/${h.credential.credential.id}`, "DELETE", undefined, "agent");
    expect(
      await (await h.request("api/session", "GET", undefined, "", headers)).json()
    ).toMatchObject({ error: { code: "credential_revoked" } });
  });
  it("UT-086: cookie CSRF and ambiguous credentials are rejected", async () => {
    for (const headers of [{ origin: "https://evil.test" }, { "x-proto-request": "" }] as Record<
      string,
      string
    >[])
      expect(
        await (
          await h.request(
            "api/comments",
            "POST",
            { key: "login-form", ...input },
            "review",
            headers
          )
        ).json()
      ).toMatchObject({ error: { code: "cross_origin_write" } });
    expect(
      await (
        await h.request("api/session", "GET", undefined, "review", {
          authorization: `Bearer ${h.credential.token}`,
        })
      ).json()
    ).toMatchObject({ error: { code: "ambiguous_credentials" } });
    expect(
      (
        await h.request("api/comments", "POST", { key: "login-form", ...input }, "", {
          authorization: `Bearer ${h.credential.token}`,
          origin: "https://evil.test",
          "x-proto-request": "",
        })
      ).status
    ).toBe(201);
  });
  it("UT-072: same-name principals cannot edit or detach each other's messages", async () => {
    const { comment } = await (
      await h.request("api/comments", "POST", { key: "login-form", ...input }, "review")
    ).json();
    expect(
      await (
        await h.request(
          `api/comments/${comment.id}/messages/${comment.thread[0].id}`,
          "PATCH",
          { body: "spoofed", authorId: "review-id" },
          "comment"
        )
      ).json()
    ).toMatchObject({ error: { code: "message_not_owned" } });
    expect(
      (
        await h.request(`api/comments/${comment.id}/messages/${comment.thread[0].id}`, "PATCH", {
          body: "mine",
        })
      ).status
    ).toBe(200);
  });
  it("UT-095: PSL and private suffixes reject same-site deployment unless acknowledged", () => {
    for (const [publicOrigin, renderOrigin] of [
      ["https://acme.com", "https://render.acme.com"],
      ["https://a.co.uk", "https://x.a.co.uk"],
      ["https://a.github.io", "https://render.a.github.io"],
    ] as [string, string][]) {
      expect(() => createReviewServer({ ...h.options, publicOrigin, renderOrigin })).toThrow(
        /registrable/
      );
      expect(() =>
        createReviewServer({ ...h.options, publicOrigin, renderOrigin, allowSameSiteRender: true })
      ).not.toThrow();
    }
    expect(() =>
      createReviewServer({
        ...h.options,
        publicOrigin: "https://a.github.io",
        renderOrigin: "https://b.github.io",
      })
    ).not.toThrow();
  });
  it("IT-026/032/033: assets are isolated, tickets expire, shared grants renew without session cookies", async () => {
    let now = Date.now();
    h.options.clock = () => now;
    h.rebuild();
    expect((await h.request("")).status).toBe(200);
    expect((await h.request("__proto/render/assets/app.js")).status).toBe(404);
    expect((await h.request(`${renderOrigin}/__proto/render/assets/app.js`)).status).toBe(401);
    const ticket = await (
      await h.request("api/render-ticket?slug=login-form&state=default")
    ).json();
    const exchanged = await h.request(ticket.url, "GET", undefined, "");
    expect(exchanged.status).toBe(302);
    const cookie = exchanged.headers.get("set-cookie")!;
    expect(cookie).toContain("Secure; HttpOnly; SameSite=None");
    expect(cookie).not.toContain("Domain=");
    const grant = cookie.split(";")[0]!;
    for (const path of ["login-form", "second", "assets/app.js"])
      expect(
        (
          await h.request(`${renderOrigin}/__proto/render/${path}`, "GET", undefined, "", {
            cookie: grant,
          })
        ).status
      ).toBe(200);
    now += 61000;
    expect((await h.request(ticket.url, "GET", undefined, "")).status).toBe(401);
    expect(
      (
        await h.request(`${renderOrigin}/__proto/render/second`, "GET", undefined, "", {
          cookie: grant,
        })
      ).status
    ).toBe(200);
    now += 3600000;
    const expired = await h.request(`${renderOrigin}/__proto/render/second`, "GET", undefined, "", {
      cookie: grant,
    });
    expect(expired.status).toBe(401);
    expect(await expired.text()).toContain("auth:expired");
    const renewed = await (await h.request("api/render-ticket?slug=second&state=default")).json();
    expect((await h.request(renewed.url, "GET", undefined, "")).status).toBe(302);
    expect(
      (
        await h.request(`${renderOrigin}/proto/api/comments`, "GET", undefined, "", {
          cookie: grant,
        })
      ).status
    ).toBe(401);
  });
  it("IT-023: remote SSE emits the changed key", async () => {
    const response = await h.request("api/events");
    const reader = response.body!.getReader();
    await reader.read();
    await h.request("api/comments", "POST", { key: "login-form", ...input });
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"key":"login-form"');
    await reader.cancel();
  });
  it("IT-026/032: Chromium loads a built gallery and excludes the session cookie from render", async () => {
    const { build } = await import("vite");
    const { chromium } = await import("playwright");
    const source = join(h.root, "build-source");
    await mkdir(source);
    await writeFile(
      join(source, "index.html"),
      '<html><body><main></main><script type="module" src="./main.js"></script></body></html>'
    );
    await writeFile(
      join(source, "main.js"),
      'fetch("api/comments").then(r=>r.json()).then(r=>document.querySelector("main").textContent=r.comments[0].thread[0].body)'
    );
    await build({
      root: source,
      configFile: false,
      base: "/proto/",
      logLevel: "silent",
      build: { outDir: h.options.gallery.dir, emptyOutDir: false },
    });
    await h.request("api/comments", "POST", { key: "login-form", ...input });
    const transport = await browserServer(h);
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-proxy-server",
        "--host-resolver-rules=MAP gallery.example.com 127.0.0.1, MAP render.example.net 127.0.0.1",
      ],
    });
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      await context.addCookies([
        {
          name: "session",
          value: "review",
          url: h.options.publicOrigin,
          secure: true,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      await page.goto(`${h.options.publicOrigin}/proto/`);
      await page.getByText(input.body, { exact: true }).waitFor();
      const ticket = await page.evaluate(async () =>
        (await fetch("api/render-ticket?slug=login-form&state=default")).json()
      );
      await page.goto(ticket.url);
      expect(page.url()).not.toContain("ticket=");
      expect((await context.cookies(h.options.renderOrigin)).map(c => c.name)).toEqual([
        "__Host-proto-render",
      ]);
      expect(
        transport.seen
          .filter(r => r.host.startsWith("render."))
          .every(r => !r.cookie.includes("session="))
      ).toBe(true);
      const response = await page.goto(`${h.options.renderOrigin}/__proto/render/assets/app.js`);
      expect(response!.status()).toBe(200);
    } finally {
      await browser.close();
      await transport.close();
    }
  });
  it("IT-024: image, edit, discard, SSE and credential-revoke rows for all columns", async () => {
    for (const who of ["review", "comment", "bearer", ""]) {
      const headers: Record<string, string> =
        who === "bearer"
          ? { authorization: `Bearer ${h.credential.token}` }
          : who
            ? { cookie: `session=${who}`, origin: publicOrigin, "x-proto-request": "1" }
            : {};
      const send = (path: string, method = "GET", body?: BodyInit) =>
        h.handler(
          new Request(`${publicOrigin}/proto/api/${path}`, {
            method,
            headers,
            ...(body ? { body } : {}),
          })
        );
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "shot.png");
      const upload = await send("attachments?key=login-form", "POST", form);
      expect(upload.status).toBe(who ? 201 : 401);
      const events = await send("events");
      expect(events.status).toBe(who ? 200 : 401);
      await events.body?.cancel();
      const revoke = await send("credentials/absent", "DELETE");
      expect(revoke.status).toBe(who === "review" || who === "comment" ? 204 : who ? 403 : 401);
      if (!who) continue;
      const { attachment } = await upload.json();
      const downloaded = await send(`attachments/login-form/${attachment.id}`);
      expect(downloaded.status).toBe(200);
      expect(downloaded.headers.get("content-security-policy")).toBe("default-src 'none'");
      const whoSession = who === "bearer" ? "" : who;
      const { comment } = await (
        await h.request(
          "api/comments",
          "POST",
          { key: "login-form", ...input, attachments: [attachment.id] },
          whoSession,
          headers
        )
      ).json();
      const edited = await h.request(
        `api/comments/${comment.id}/messages/${comment.thread[0].id}`,
        "PATCH",
        { body: "edited", detach: [attachment.id] },
        whoSession,
        headers
      );
      expect(edited.status).toBe(200);
      const nextForm = new FormData();
      nextForm.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "other.png");
      const next = await (await send("attachments?key=login-form", "POST", nextForm)).json();
      expect((await send(`attachments/login-form/${next.attachment.id}`, "DELETE")).status).toBe(
        204
      );
    }
  });
  // Dozens of real credential/file-lock requests across four principals; allow headroom on 2-core CI.
  it("UT-056 / IT-024: matrix read/comment/review/credential/ticket rows for every remote column", async () => {
    for (const who of ["review", "comment", "bearer", ""]) {
      const headers: Record<string, string> =
        who === "bearer" ? { authorization: `Bearer ${h.credential.token}` } : {};
      const identity = who === "bearer" ? "" : who;
      const authenticated = !!who,
        session = who === "review" || who === "comment";
      const cases: [string, string, unknown, number][] = [
        ["__proto/bootstrap.json", "GET", undefined, 200],
        ["api/session", "GET", undefined, authenticated ? 200 : 401],
        ["api/registry", "GET", undefined, authenticated ? 200 : 401],
        ["api/comments", "GET", undefined, authenticated ? 200 : 401],
        ["api/comments", "POST", { key: "login-form", ...input }, authenticated ? 201 : 401],
        [
          "api/reviews/login-form/transitions",
          "POST",
          { to: "approved", confirmOpen: true },
          who === "review" ? 200 : authenticated ? 403 : 401,
        ],
        ["api/credentials", "GET", undefined, session ? 200 : authenticated ? 403 : 401],
        ["api/credentials", "POST", { name: "test" }, session ? 201 : authenticated ? 403 : 401],
        [
          "api/render-ticket?slug=login-form&state=default",
          "GET",
          undefined,
          session ? 200 : authenticated ? 403 : 401,
        ],
      ];
      for (const [path, method, body, status] of cases)
        expect(
          (await h.request(path, method, body, identity, headers)).status,
          `${who} ${method} ${path}`
        ).toBe(status);
      const { comment } = await (
        await h.request("api/comments", "POST", { key: "login-form", ...input })
      ).json();
      for (const [path, method, body, status] of [
        [
          `api/comments/${comment.id}/replies`,
          "POST",
          { body: "reply" },
          authenticated ? 201 : 401,
        ],
        [
          `api/comments/${comment.id}/status`,
          "PATCH",
          { status: "resolved" },
          authenticated ? 200 : 401,
        ],
        [
          `api/comments/${comment.id}`,
          "DELETE",
          undefined,
          who === "review" ? 204 : authenticated ? 403 : 401,
        ],
      ] as [string, string, unknown, number][])
        expect(
          (await h.request(path, method, body, identity, headers)).status,
          `${who} ${path}`
        ).toBe(status);
    }
  }, 30_000);
});
