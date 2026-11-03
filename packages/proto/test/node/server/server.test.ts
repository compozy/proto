import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createReviewServer, fileStorage, ReviewEvents } from "../../../src/server/index.ts";
import { runStoreContract, input, png } from "../store/contract.ts";
import {
  httpContract,
  serverHarness,
  browserServer,
  buildRemoteGallery,
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
  // Invariant: the served registry admits prototypes and flows, and hides outside keys and tickets.
  // Owner: remote server wiring; canonical suite: server.test.ts (proto-share IT-008).
  it("proto-share IT-008: served registry confines review reads, writes and render tickets", async () => {
    const hidden = await h.options.storage.store.add("second", input, { kind: "reviewer" });
    const path = join(h.options.gallery.dir, "__proto/registry.json");
    const registry = JSON.parse(await readFile(path, "utf8"));
    registry.prototypes = registry.prototypes.filter((item: { slug: string }) => item.slug !== "second");
    await writeFile(path, JSON.stringify(registry));
    h.options.restrictReviewToRegistry = true;
    h.rebuild();
    for (const endpoint of [
      "comments?key=second",
      `comments/${hidden.id}`,
      "reviews/second",
      "render-ticket?slug=second",
    ]) {
      const response = await h.request(`api/${endpoint}`);
      expect(response.status, endpoint).toBe(404);
      expect(await response.json()).toMatchObject({ error: { code: "comment_not_found" } });
    }
    expect((await (await h.request("api/comments")).json()).comments).toEqual([]);
    expect((await h.request("api/comments", "POST", { ...input, key: "second" })).status).toBe(404);
    expect((await h.request("api/comments", "POST", { ...input, key: "flow-sign-in" })).status).toBe(201);
    expect(
      (await h.request("api/reviews/login-form/transitions", "POST", { to: "approved" })).status
    ).toBe(200);
  });
  // Invariant: same-site render origins and missing request markers never authorize shell writes.
  // Owner: remote server authorization; canonical suite: server.test.ts (proto-share IT-019).
  it("proto-share IT-019: same-site rendering retains exact Origin and request-marker checks", async () => {
    h.options.publicOrigin = "https://review.example.com";
    h.options.renderOrigin = "https://render.example.com";
    h.options.allowSameSiteRender = true;
    h.options.authorize = async () => ({
      id: "ana@example.com",
      name: "Ana",
      scopes: ["review", "comment"],
    });
    h.rebuild();
    for (const headers of [
      { origin: h.options.renderOrigin, "x-proto-request": "1" },
      { origin: h.options.publicOrigin },
    ] as Record<string, string>[]) {
      const response = await h.handler(
        new Request(`${h.options.publicOrigin}/proto/api/comments`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...input, key: "login-form" }),
        })
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "cross_origin_write" } });
    }
    expect(await h.options.storage.store.list()).toEqual([]);
  });
  // Invariant: stale and missing ids cannot approve or emit; accepted approvals name the live commit.
  // Owner: remote server/bootstrap-to-router seam; canonical suite: server.test.ts (proto-share IT-020).
  it("proto-share IT-020: refreshed bootstrap rejects stale approval and stores the current commit", async () => {
    const path = join(h.options.gallery.dir, "__proto/bootstrap.json");
    const bootstrap = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify({ ...bootstrap, snapshot: "A" }));
    const events = new ReviewEvents();
    h.options.events = events;
    h.options.requireSnapshot = true;
    h.rebuild();
    expect((await (await h.request("__proto/bootstrap.json")).json()).snapshot).toBe("A");
    await writeFile(path, JSON.stringify({ ...bootstrap, snapshot: "B", commit: "b".repeat(40) }));
    const notifications: unknown[] = [];
    const stop = events.subscribe(event => notifications.push(event));
    try {
      for (const snapshot of ["A", undefined]) {
        const stale = await h.request("api/reviews/login-form/transitions", "POST", {
          to: "approved",
          snapshot,
        });
        expect(stale.status).toBe(409);
        expect(await stale.json()).toMatchObject({ error: { code: "snapshot_stale" } });
      }
      expect((await h.options.storage.store.review("login-form")).events).toEqual([]);
      expect(notifications).toEqual([]);
      const current = await h.request("api/reviews/login-form/transitions", "POST", {
        to: "approved",
        snapshot: "B",
      });
      expect(current.status).toBe(200);
      expect((await current.json()).review.events[0]).toMatchObject({
        type: "approved",
        commit: "b".repeat(40),
      });
      expect(notifications).toEqual([{ type: "review", key: "login-form" }]);
    } finally {
      stop();
    }
  });
  // Invariant: disabled credential endpoints create no records and advertise no credential capability.
  // Owner: remote server; canonical suite: server.test.ts (proto-share IT-025).
  it("proto-share IT-025: disabled credentials return 404 without creating a credentials file", async () => {
    h.options.storage = fileStorage(join(h.root, "share-reviews"));
    h.options.disableCredentials = true;
    h.options.authorize = async () => ({
      id: "ana@example.com",
      name: "Ana",
      scopes: ["review", "comment"],
    });
    h.rebuild();
    for (const [path, method, body] of [
      ["credentials", "GET", undefined],
      ["credentials", "POST", { name: "agent" }],
      ["credentials/absent", "DELETE", undefined],
    ] as const) {
      expect((await h.request(`api/${path}`, method, body)).status).toBe(404);
    }
    expect((await (await h.request("__proto/bootstrap.json")).json()).credentials).toBe(false);
    await expect(
      readFile(join(h.root, "share-reviews/.server/credentials.json"))
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
  // Owner: remote HTTP boundary; absent gallery output must respond instead of hanging.
  it("IT-026: missing gallery files fail immediately", async () => {
    await rm(h.options.gallery.dir, { recursive: true, force: true });
    expect((await h.request("")).status).toBe(404);
    const bootstrap = await h.request("__proto/bootstrap.json");
    expect(bootstrap.status).toBe(500);
    expect(await bootstrap.json()).toMatchObject({ error: { code: "internal_error" } });
  });
  it("UT-055/075/076/077/093: bootstrap and both sign-in handoffs preserve relative returnTo", async () => {
    const anonymous = await h.request("api/comments", "GET", undefined, "");
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).error).toMatchObject({
      code: "auth_required",
      signInUrl: "/proto/sign-in?returnTo=%2Fproto%2F",
    });
    const expiredReply = await h.request(
      "api/comments/login-form-1/replies",
      "POST",
      { body: "Reply" },
      ""
    );
    expect(expiredReply.status).toBe(401);
    expect(await expiredReply.json()).toMatchObject({
      error: { code: "auth_required", signInUrl: "/proto/sign-in?returnTo=%2Fproto%2F" },
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
    expect(h.credential.credential.scopes).toEqual(["comment"]);
    const added = await h.request(
      "api/comments",
      "POST",
      { key: "login-form", ...input },
      "",
      headers
    );
    expect(added.status).toBe(201);
    expect((await added.json()).comment.thread[0]).toMatchObject({
      author: "agent",
      authorId: "agent-id",
    });
    const agent = h.identities.get("agent")!;
    h.identities.delete("agent");
    const rejected = await h.request("api/session", "GET", undefined, "", headers);
    expect(rejected.status).toBe(401);
    expect(await rejected.json()).toMatchObject({ error: { code: "invalid_credential" } });
    h.identities.set("agent", { ...agent, scopes: ["review"] });
    const scopeless = await h.request("api/session", "GET", undefined, "", headers);
    expect(scopeless.status).toBe(401);
    expect(await scopeless.json()).toMatchObject({ error: { code: "invalid_credential" } });
    h.identities.set("agent", agent);
    const listed = await (await h.request("api/credentials", "GET", undefined, "agent")).text();
    expect(listed).not.toContain(h.credential.token);
    expect(listed).not.toContain('"hash"');
    await h.request(`api/credentials/${h.credential.credential.id}`, "DELETE", undefined, "agent");
    expect(
      await (await h.request("api/session", "GET", undefined, "", headers)).json()
    ).toMatchObject({ error: { code: "credential_revoked" } });
  });
  it("UT-079: server origins require HTTPS except loopback", () => {
    for (const property of ["publicOrigin", "renderOrigin"] as const)
      expect(() =>
        createReviewServer({ ...h.options, [property]: "http://unsafe.example.org" })
      ).toThrowError(expect.objectContaining({ code: "insecure_remote" }));
  });
  it("UT-076: document framing is limited to the canonical shell", async () => {
    const shell = await h.request("");
    expect(shell.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    const render = await h.request(`${renderOrigin}/__proto/render/login-form`);
    expect(render.status).toBe(401);
    expect(render.headers.get("content-security-policy")).toBe(`frame-ancestors ${publicOrigin}`);
  });
  it("UT-090: registry source roots reach the remote router and storage engine", async () => {
    const path = join(h.options.gallery.dir, "__proto/registry.json");
    const registry = JSON.parse(await readFile(path, "utf8"));
    registry.sourceRoots = { dirs: ["src", "journeys"], files: ["custom.canvas.tsx"] };
    await writeFile(path, JSON.stringify(registry));
    const rect = { x: 0, y: 0, width: 1, height: 1 };
    const target = {
      kind: "element",
      selector: "button",
      testId: null,
      tag: "button",
      text: "Target",
      source: "journeys/example.ts:1:1",
      sourceChain: ["custom.canvas.tsx:1:1"],
      rect,
      rectNormalized: rect,
      offset: null,
    };
    const accepted = await h.request("api/comments", "POST", {
      key: "login-form",
      ...input,
      target,
    });
    expect(accepted.status).toBe(201);
    const rejected = await h.request("api/comments", "POST", {
      key: "login-form",
      ...input,
      target: { ...target, source: "flows/old.ts:1:1" },
    });
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({ error: { code: "invalid_source" } });
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
  // Deployment-layer invariant: the actual package build speaks the shell protocol over isolated TLS origins.
  it("IT-026/032/033: real remote build picks, isolates cookies and renews expired grants", async () => {
    const { chromium } = await import("playwright");
    let now = Date.now();
    h.options.clock = () => now;
    const transport = await browserServer(h);
    await buildRemoteGallery(h);
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-proxy-server"],
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
      await page.addInitScript(() => {
        (window as any).protocolMessages = [];
        window.addEventListener("message", event => {
          if (event.data?.proto === 1) (window as any).protocolMessages.push(event.data);
        });
      });
      await page.goto(`${h.options.publicOrigin}/proto/?p=login-form`);
      const frame = page.frameLocator("iframe").first();
      await frame.getByTestId("remote-pick").waitFor();
      expect(await frame.getByTestId("hostile-cookie").textContent()).toBe("empty");
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).protocolMessages.some((m: any) => m.type === "ready"))
        )
        .toBe(true);
      await page.getByTestId("comment-tool").click();
      await frame.getByTestId("proto-picker").waitFor();
      const bounds = (await frame.getByTestId("remote-pick").boundingBox())!;
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.getByTestId("comment-composer").waitFor();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).protocolMessages.some((m: any) => m.type === "pick:result")
          )
        )
        .toBe(true);
      const oldFrame = page.frames().find(f => f.url().startsWith(h.options.renderOrigin))!;
      now += 3600001;
      await oldFrame.goto(oldFrame.url());
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).protocolMessages.some((m: any) => m.type === "auth:expired")
          )
        )
        .toBe(true);
      await frame.getByTestId("remote-pick").waitFor();
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as any).protocolMessages.filter((m: any) => m.type === "ready").length
          )
        )
        .toBeGreaterThan(1);
      const renders = transport.seen.filter(r => r.host.startsWith("render."));
      expect(renders.length).toBeGreaterThan(0);
      expect(renders.every(r => !r.cookie.includes("session="))).toBe(true);
      expect((await context.cookies(h.options.renderOrigin)).map(c => c.name)).toEqual([
        "__Host-proto-render",
      ]);
    } finally {
      await browser.close();
      await transport.close();
    }
  }, 120000);
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

// Invariant: SSE heartbeat and notification lifetime ends on abort, cancellation or backpressure.
// Owner: ReviewEvents; canonical suite: server.test.ts (proto-share UT-018).
describe("proto-share UT-018: SSE lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("sends snapshot ids and pings every 25 seconds, then stops on abort", async () => {
    vi.useFakeTimers();
    const events = new ReviewEvents();
    const abort = new AbortController();
    const reader = events.response(abort.signal).body!.getReader();
    const decode = async () => new TextDecoder().decode((await reader.read()).value);
    expect(await decode()).toBe(": connected\n\n");
    events.publish({ type: "snapshot", id: "B" });
    expect(await decode()).toBe('event: snapshot\ndata: {"id":"B"}\n\n');
    await vi.advanceTimersByTimeAsync(24999);
    const next = reader.read();
    let received = false;
    void next.then(() => {
      received = true;
    });
    await Promise.resolve();
    expect(received).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(new TextDecoder().decode((await next).value)).toBe(": ping\n\n");
    await vi.advanceTimersByTimeAsync(25000);
    expect(await decode()).toBe(": ping\n\n");
    abort.abort();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => events.publish({ type: "snapshot", id: "C" })).not.toThrow();
    await vi.advanceTimersByTimeAsync(50000);
    expect((await reader.read()).done).toBe(true);
  });
  it("cancellation and already aborted signals leave no timer or listener writes", async () => {
    vi.useFakeTimers();
    const events = new ReviewEvents();
    const abort = new AbortController();
    const response = events.response(abort.signal);
    await response.body!.cancel();
    abort.abort();
    const ended = events.response(abort.signal).body!.getReader();
    expect((await ended.read()).done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(50000);
    expect(() => events.publish({ type: "review", key: "login-form" })).not.toThrow();
  });
  it("heartbeat backpressure closes the stream without enqueueing after close", async () => {
    vi.useFakeTimers();
    const events = new ReviewEvents();
    const abort = new AbortController();
    const reader = events.response(abort.signal).body!.getReader();
    expect(() => vi.advanceTimersByTime(25000 * 104)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => {
      abort.abort();
      events.publish({ type: "snapshot", id: "C" });
      vi.advanceTimersByTime(50000);
    }).not.toThrow();
    let chunks = 0;
    while (!(await reader.read()).done) chunks++;
    expect(chunks).toBeGreaterThan(1);
    expect(chunks).toBeLessThan(104);
  });
});
