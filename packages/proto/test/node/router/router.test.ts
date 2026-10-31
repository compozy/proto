import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createReviewRouter,
  createDevAuthorizer,
  ReviewEvents,
} from "../../../src/review/index.ts";
import type { Registry } from "../../../src/model/registry.ts";
import { makeFileStore } from "../store/harness.ts";
import { input, png } from "../store/contract.ts";
const origin = "http://127.0.0.1:4400";
const registry: Registry = {
  title: "Test",
  locale: "en",
  specs: { auth: "Auth" },
  roles: {},
  siteUrl: null,
  problems: [],
  warnings: [],
  flows: [],
  prototypes: [
    {
      slug: "login-form",
      title: "Login",
      kind: "component",
      file: "src/login-form.proto.tsx",
      spec: "auth",
      surface: null,
      route: null,
      blocks: [],
      roles: [],
      standalone: false,
      states: [{ id: "default", label: "Default" }],
    },
  ],
};
describe("Review fetch router", () => {
  let h: Awaited<ReturnType<typeof makeFileStore>>,
    router: ReturnType<typeof createReviewRouter>,
    events: ReviewEvents;
  beforeEach(async () => {
    h = await makeFileStore();
    events = new ReviewEvents();
    router = createReviewRouter({
      store: h.store,
      registry: () => registry,
      events,
      authorize: createDevAuthorizer({ shellOrigin: origin }),
      commit: () => "b".repeat(40),
    });
  });
  afterEach(async () => {
    await h.dispose();
  });
  const request = (
    path: string,
    method = "GET",
    value?: unknown,
    headers: Record<string, string> = {}
  ) =>
    new Request(`${origin}/__proto/api/${path}`, {
      method,
      headers: { host: "127.0.0.1:4400", origin, ...headers },
      ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
    });
  it("IT-001: shell POST persists v3 and emits keyed SSE comments", async () => {
    const stream = await router(request("events")),
      reader = stream.body!.getReader();
    await reader.read();
    const response = await router(
      request("comments", "POST", {
        ...input,
        key: "login-form",
        author: "agent",
        authorId: "forged",
      })
    );
    expect(response.status).toBe(201);
    const message = (await response.json()).comment.thread[0];
    expect(message).toMatchObject({ author: "reviewer" });
    expect(message).not.toHaveProperty("authorId");
    expect((await h.store.readFile("login-form")).version).toBe(3);
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      'event: comments\ndata: {"key":"login-form"}'
    );
    await reader.cancel();
  });
  it("IT-003: cross-origin and null origins cannot write", async () => {
    for (const bad of ["http://evil.test", "null", "http://127.0.0.1:4401", ""]) {
      const response = await router(
        request("comments", "POST", { ...input, key: "login-form" }, { origin: bad })
      );
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("cross_origin_write");
    }
    expect(await h.store.list()).toEqual([]);
  });
  it("UT-094: every request enforces Host; localhost reads redirect", async () => {
    const bad = await router(request("registry", "GET", undefined, { host: "evil.test:4400" }));
    expect(bad.status).toBe(403);
    expect((await bad.json()).error.code).toBe("host_not_allowed");
    expect(
      (await router(request("registry", "GET", undefined, { host: "localhost:4400" }))).headers.get(
        "location"
      )
    ).toBe(`${origin}/__proto/api/registry`);
  });
  it("UT-090: source and sourceChain are confined before persistence", async () => {
    const rect = { x: 0, y: 0, width: 1, height: 1 };
    const target = {
      kind: "element",
      selector: "div",
      testId: null,
      tag: "div",
      text: "",
      source: null,
      sourceChain: [],
      rect,
      rectNormalized: rect,
      offset: null,
    };
    for (const source of [
      "../../.github/workflows/ci.yml:1:1",
      "/etc/passwd:1:1",
      "file:///x",
      "package.json:1:1",
    ])
      for (const field of ["source", "sourceChain"]) {
        const response = await router(
          request("comments", "POST", {
            ...input,
            key: "login-form",
            target: { ...target, [field]: field === "source" ? source : [source] },
          })
        );
        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe("invalid_source");
      }
    expect(await h.store.list()).toEqual([]);
    expect(
      (
        await router(
          request("comments", "POST", {
            ...input,
            key: "login-form",
            target: { ...target, source: "src/components/a.tsx:3:4" },
          })
        )
      ).status
    ).toBe(201);
  });
  it("IT-004: multipart upload is claimed and served as a safe download", async () => {
    const form = new FormData();
    form.set("file", new Blob([png], { type: "image/png" }), "shot.png");
    const upload = await router(
      new Request(`${origin}/__proto/api/attachments?key=login-form`, {
        method: "POST",
        headers: { origin, host: "127.0.0.1:4400" },
        body: form,
      })
    );
    expect(upload.status).toBe(201);
    const { attachment } = await upload.json();
    expect(
      (
        await router(
          request("comments", "POST", { ...input, key: "login-form", attachments: [attachment.id] })
        )
      ).status
    ).toBe(201);
    const image = await router(request(`attachments/login-form/${attachment.id}`));
    expect(image.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(image.headers.get("x-content-type-options")).toBe("nosniff");
    expect(image.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(png);
  });
  it("IT-006: router approval and another process add share state and notify watchers", async () => {
    const notifications: string[] = [];
    const stop = await h.store.subscribe(event => notifications.push(`${event.type}:${event.key}`));
    try {
      expect(
        (await router(request("reviews/login-form/transitions", "POST", { to: "approved" }))).status
      ).toBe(200);
      await expect.poll(() => notifications).toContain("review:login-form");
      notifications.length = 0;
      await promisify(execFile)(process.execPath, [
        "--experimental-transform-types",
        fileURLToPath(new URL("../store/process.ts", import.meta.url)),
        "add",
        h.root,
      ]);
      const review = (await (await router(request("reviews/login-form"))).json()).review;
      expect(review.status).toBe("in_review");
      expect(review.events.map((event: { type: string }) => event.type)).toEqual([
        "approved",
        "auto_reopened",
      ]);
      await expect.poll(() => notifications).toContain("comments:login-form");
      await expect.poll(() => notifications).toContain("review:login-form");
    } finally {
      stop();
    }
  }, 15000);
  it("Router CRUD validates input and preserves derived authorship", async () => {
    const added = await (
        await router(request("comments", "POST", { ...input, key: "login-form" }))
      ).json(),
      id = added.comment.id;
    expect(
      (await router(request(`comments/${id}/replies`, "POST", { body: "Reply", author: "agent" })))
        .status
    ).toBe(201);
    expect(
      (
        await router(
          request(`comments/${id}/messages/${added.comment.thread[0].id}`, "PATCH", {
            body: "Edited",
          })
        )
      ).status
    ).toBe(200);
    expect(
      (
        await router(
          request(`comments/${id}/status`, "PATCH", { status: "resolved", note: "Done" })
        )
      ).status
    ).toBe(200);
    expect(
      (await (await router(request("comments?status=resolved"))).json()).comments
    ).toHaveLength(1);
    expect((await router(request("comments?waiting=bad"))).status).toBe(400);
    expect((await router(request(`comments/${id}`, "DELETE"))).status).toBe(204);
    expect((await router(request(`comments/${id}`))).status).toBe(404);
  });
});
