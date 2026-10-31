/** Canonical store semantics, reused by FileStore and HttpStore/server suites. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NewComment, ReviewStore } from "../../../src/store/types.ts";
export const reviewer = { kind: "reviewer" as const };
export const agent = { kind: "agent" as const };
export const png = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=",
    "base64"
  )
);
export const input: NewComment = {
  body: "Review this",
  context: { state: "default", theme: "light", role: null, viewport: { width: 1440, height: 900 } },
  target: { kind: "node", node: null, label: "Whole flow" },
};
export type StoreHarness = {
  store: ReviewStore;
  retireKey(): Promise<void>;
  dispose(): Promise<void>;
};
export function runStoreContract(makeStore: () => Promise<StoreHarness>) {
  describe("ReviewStore contract", () => {
    let retireKey: () => Promise<void>;
    let store: ReviewStore, dispose: () => Promise<void>;
    beforeEach(async () => {
      ({ store, dispose, retireKey } = await makeStore());
    });
    afterEach(async () => {
      await dispose?.();
    });
    it("UT-027: unfiltered history survives registry retirement, explicit keys reject it", async () => {
      const comment = await store.add("login-form", input, reviewer);
      await retireKey();
      expect(await store.list({ status: "all" })).toEqual([comment]);
      await expect(store.list({ key: "login-form" })).rejects.toMatchObject({
        code: "comment_not_found",
      });
      await expect(
        store.reply(comment.id, { body: "Must not mutate retired history" }, agent)
      ).rejects.toMatchObject({ code: "comment_not_found" });
    });
    it("UT-027: retired ids survive deletion, including the last comment", async () => {
      const a = await store.add("login-form", input, reviewer),
        b = await store.add("login-form", input, reviewer);
      await store.remove(b.id, reviewer);
      expect((await store.add("login-form", input, reviewer)).id).toBe("login-form-3");
      await store.remove(a.id, reviewer);
      await store.remove("login-form-3", reviewer);
      expect((await store.add("login-form", input, reviewer)).id).toBe("login-form-4");
    });
    it("UT-028: reply records agent authorship", async () => {
      const c = await store.add("login-form", input, reviewer);
      const result = await store.reply(c.id, { body: "Done" }, agent);
      expect(result.thread.at(-1)).toMatchObject({ author: "agent", body: "Done" });
    });
    it("UT-029: repeated status transition does not append a second note", async () => {
      const c = await store.add("login-form", input, reviewer);
      const first = await store.setStatus(c.id, "resolved", agent, { body: "Fixed" });
      expect(await store.setStatus(c.id, "resolved", agent, { body: "Fixed" })).toEqual(first);
    });
    it("UT-030: simultaneous adds allocate distinct monotonically increasing ids", async () => {
      const results = await Promise.all([
        store.add("login-form", input, reviewer),
        store.add("login-form", input, agent),
      ]);
      expect(results.map(c => c.id).sort()).toEqual(["login-form-1", "login-form-2"]);
    });
    it("UT-033: message edit preserves identity and timestamps, attaches and detaches", async () => {
      const c = await store.add("login-form", input, agent),
        message = c.thread[0]!;
      const image = await store.upload(c.slug, { name: "shot.png", bytes: png }, agent);
      const edited = await store.editMessage(
        c.id,
        message.id,
        { body: "Updated", attach: [image.id] },
        agent
      );
      expect(edited.thread[0]).toMatchObject({
        id: message.id,
        at: message.at,
        body: "Updated",
        attachments: [{ id: image.id }],
      });
      expect(edited.thread[0]!.editedAt).not.toBeNull();
      expect((await store.readAttachment(c.slug, image.id)).bytes).toEqual(png);
      expect(
        (await store.editMessage(c.id, message.id, { detach: [image.id] }, agent)).thread[0]!
          .attachments
      ).toEqual([]);
    });
    it("UT-035: image byte/type/message limits reject without a partial mutation", async () => {
      await expect(
        store.upload(
          "login-form",
          { name: "big.png", bytes: new Uint8Array(5 * 1024 * 1024 + 1) },
          reviewer
        )
      ).rejects.toMatchObject({ code: "attachment_too_large" });
      await expect(
        store.upload(
          "login-form",
          { name: "a.txt", bytes: new TextEncoder().encode("plain") },
          reviewer
        )
      ).rejects.toMatchObject({ code: "attachment_type" });
      const images = await Promise.all(
        Array.from({ length: 7 }, () =>
          store.upload("login-form", { name: "shot.png", bytes: png }, reviewer)
        )
      );
      await expect(
        store.add("login-form", { ...input, attachments: images.map(i => i.id) }, reviewer)
      ).rejects.toMatchObject({ code: "attachment_limit" });
      expect(await store.list()).toEqual([]);
    });
    it("UT-037: approval requires confirmation and records locked open count and commit", async () => {
      await store.add("login-form", input, reviewer);
      await store.add("login-form", input, reviewer);
      await expect(
        store.transition("login-form", "approved", reviewer, { commit: null })
      ).rejects.toMatchObject({ code: "review_has_open_comments" });
      expect((await store.review("login-form")).events).toEqual([]);
      const state = await store.transition("login-form", "approved", reviewer, {
        commit: "a".repeat(40),
        confirmOpen: true,
      });
      expect(state.events[0]).toMatchObject({
        type: "approved",
        openCount: 2,
        commit: "a".repeat(40),
      });
    });
    it("UT-038: a comment atomically reopens an approved key", async () => {
      await store.transition("login-form", "approved", reviewer, { commit: null });
      const comment = await store.add("login-form", input, agent);
      const state = await store.review("login-form");
      expect(state.status).toBe("in_review");
      expect(state.events.at(-1)).toMatchObject({
        type: "auto_reopened",
        commentId: comment.id,
        openCount: 1,
      });
    });
    it("UT-039: waiting, author, spec and state filters combine", async () => {
      const first = await store.add("login-form", input, reviewer);
      await store.add("flow-sign-in", input, agent);
      await store.reply(first.id, { body: "Done" }, agent);
      expect(
        (
          await store.list({
            waiting: true,
            authorKind: "reviewer",
            spec: "auth",
            state: "default",
          })
        ).map(c => c.id)
      ).toEqual([first.id]);
      expect(await store.list({ waiting: true, spec: "absent" })).toEqual([]);
    });
    it("UT-071: pending uploads have one claim and only their uploader can claim/discard", async () => {
      const image = await store.upload("login-form", { name: "shot.png", bytes: png }, reviewer);
      await expect(
        store.add("login-form", { ...input, attachments: [image.id] }, agent)
      ).rejects.toMatchObject({ code: "message_not_owned" });
      await expect(store.discard("login-form", image.id, agent)).rejects.toMatchObject({
        code: "message_not_owned",
      });
      const claims = await Promise.allSettled([
        store.add("login-form", { ...input, attachments: [image.id] }, reviewer),
        store.add("login-form", { ...input, attachments: [image.id] }, reviewer),
      ]);
      expect(claims.filter(c => c.status === "fulfilled")).toHaveLength(1);
      expect((await store.list()).length).toBe(1);
    });
    it("UT-072: local author kinds own their messages", async () => {
      const c = await store.add("login-form", input, reviewer);
      await expect(
        store.editMessage(c.id, c.thread[0]!.id, { body: "Forged" }, agent)
      ).rejects.toMatchObject({ code: "message_not_owned" });
      expect((await store.get(c.id)).thread[0]!.body).toBe(input.body);
    });
    it("UT-073: racing approve/add yields a consistent transition history", async () => {
      await Promise.all([
        store.transition("login-form", "approved", reviewer, { commit: null, confirmOpen: true }),
        store.add("login-form", input, agent),
      ]);
      const state = await store.review("login-form");
      if (state.status === "approved")
        expect(state.events.at(-1)).toMatchObject({ type: "approved", openCount: 1 });
      else expect(state.events.map(e => e.type)).toEqual(["approved", "auto_reopened"]);
    });
  });
}
