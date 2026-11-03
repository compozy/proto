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
  // Invariant: every review endpoint hides keys outside the allowlist, independent of authorization.
  // Owner: review router; canonical suite: router.test.ts (proto-share IT-008).
  it("proto-share IT-008: a plain authorizer cannot bypass any key guard", async () => {
    const author = { kind: "reviewer" as const };
    const hidden = await h.store.add("flow-sign-in", input, author);
    const message = hidden.thread[0];
    expect(message).toBeDefined();
    if (!message) throw new Error("The hidden comment must have an initial message");
    await h.store.add("login-form", input, author);
    const attachment = await h.store.upload(
      "flow-sign-in",
      { name: "shot.png", bytes: png },
      author
    );
    router = createReviewRouter({
      store: h.store,
      registry: () => registry,
      authorize: async () => ({ author }),
      reviewKeys: async () => new Set(["login-form"]),
      events,
    });
    const notifications: unknown[] = [];
    const stop = events.subscribe(event => notifications.push(event));
    const cases: [string, string, unknown?][] = [
      ["comments?key=flow-sign-in", "GET"],
      ["comments", "POST", { ...input, key: "flow-sign-in" }],
      [`comments/${hidden.id}`, "GET"],
      [`comments/${hidden.id}`, "DELETE"],
      [`comments/${hidden.id}/replies`, "POST", { body: "reply" }],
      [`comments/${hidden.id}/status`, "PATCH", { status: "resolved" }],
      [`comments/${hidden.id}/messages/${message.id}`, "PATCH", { body: "edit" }],
      ["reviews/flow-sign-in", "GET"],
      ["reviews/flow-sign-in/transitions", "POST", { to: "approved", confirmOpen: true }],
      [`attachments/flow-sign-in/${attachment.id}`, "GET"],
      [`attachments/flow-sign-in/${attachment.id}`, "DELETE"],
      ["attachments?key=flow-sign-in", "POST"],
    ];
    for (const [path, method, body] of cases) {
      const response = await router(request(path, method, body));
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(await response.json()).toMatchObject({ error: { code: "comment_not_found" } });
    }
    const listed = await (await router(request("comments"))).json();
    expect(listed.comments.map((comment: { slug: string }) => comment.slug)).toEqual([
      "login-form",
    ]);
    expect(await h.store.get(hidden.id)).toEqual(hidden);
    expect((await h.store.review("flow-sign-in")).events).toEqual([]);
    expect((await h.store.readAttachment("flow-sign-in", attachment.id)).bytes).toEqual(png);
    expect((await router(request("reviews/login-form"))).status).toBe(200);
    expect(notifications).toEqual([]);
    stop();
  });
  // Invariant: one live version supplies both comparison and stored commit.
  // Owner: review router; canonical suite: router.test.ts (proto-share UT-017).
  it("proto-share UT-017: version is read once and null snapshots and reopening need no id", async () => {
    let reads = 0;
    let snapshot: string | null = "A";
    router = createReviewRouter({
      store: h.store,
      registry: () => registry,
      authorize: async () => ({ author: { kind: "reviewer" } }),
      version: async () => {
        reads++;
        return {
          snapshot: snapshot === null ? null : `${snapshot}${reads}`,
          commit: (reads === 1 ? "a" : "b").repeat(40),
        };
      },
      commit: () => {
        throw new Error("version must own the commit");
      },
    });
    const approved = await router(
      request("reviews/login-form/transitions", "POST", { to: "approved", snapshot: "A1" })
    );
    expect(approved.status).toBe(200);
    expect(reads).toBe(1);
    expect((await h.store.review("login-form")).events[0]?.commit).toBe("a".repeat(40));
    expect(
      (await router(request("reviews/login-form/transitions", "POST", { to: "in_review" }))).status
    ).toBe(200);
    snapshot = null;
    expect(
      (await router(request("reviews/login-form/transitions", "POST", { to: "approved" }))).status
    ).toBe(200);
    expect((await h.store.review("login-form")).events.at(-1)?.commit).toBe("b".repeat(40));
    expect(reads).toBe(3);
  });
});

// Invariant: the local review HTTP boundary accepts component keys and retains the selected story.
// Owner: review router and real FileStore (backend half of the picker journey).
it("creates and lists a story comment through the local router", async () => {
  const stories: NonNullable<Registry["stories"]> = [
    {
      slug: "ui-button",
      root: "ui",
      file: "src/button.stories.tsx",
      title: "UI/Button",
      path: ["UI", "Button"],
      description: null,
      stories: [
        { id: "ui-button--primary", exportName: "Primary", name: "Primary", play: false, tags: [] },
      ],
    },
  ];
  const h = await makeFileStore({ registry: async () => ({ ...registry, stories }) });
  const router = createReviewRouter({
    store: h.store,
    registry: () => ({ ...registry, stories }),
    authorize: createDevAuthorizer({ shellOrigin: origin }),
  });
  try {
    const response = await router(
      new Request(`${origin}/__proto/api/comments`, {
        method: "POST",
        headers: { origin, host: "127.0.0.1:4400" },
        body: JSON.stringify({
          ...input,
          key: "story--ui-button",
          context: { ...input.context, state: "ui-button--primary" },
        }),
      })
    );
    expect(response.status).toBe(201);
    const { comment } = await response.json();
    expect(comment.slug).toBe("story--ui-button");
    expect(comment.context.state).toBe("ui-button--primary");
    const listed = await router(new Request(`${origin}/__proto/api/comments?key=story--ui-button`));
    expect((await listed.json()).comments).toEqual([comment]);
  } finally {
    await h.dispose();
  }
});
