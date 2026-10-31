import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { upgradeReviewFile } from "../../../src/model/upgrade.ts";
import { atomicWrite } from "../../../src/store/file-store.ts";
const fixtures = fileURLToPath(new URL("../../fixtures/review/", import.meta.url));
async function files(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(path)));
    else if (entry.name.endsWith(".json")) found.push(path);
  }
  return found;
}
describe("Review upgrades", () => {
  it("UT-034: real fixture histories survive upgrades and v3 disk round trips", async () => {
    const directory = await mkdtemp(join(tmpdir(), "proto-upgrade-"));
    try {
      for (const fixture of await files(fixtures)) {
        const raw = JSON.parse(await readFile(fixture, "utf8"));
        const result = upgradeReviewFile(raw);
        expect(result, fixture).toMatchObject({ ok: true });
        if (!result.ok) continue;
        expect(result.file.comments).toHaveLength(raw.comments.length);
        expect(result.file.sequence).toBe(
          raw.sequence ??
            Math.max(
              0,
              ...raw.comments.map((c: { id: string; slug: string }) =>
                Number(c.id.slice(c.slug.length + 1))
              )
            )
        );
        for (const [i, comment] of result.file.comments.entries()) {
          const old = raw.comments[i];
          expect({
            ...comment,
            context: old.context,
            target: old.target,
            thread: old.thread,
          }).toEqual({ ...old, context: old.context, target: old.target, thread: old.thread });
          expect(comment.context).toEqual({
            ...old.context,
            commit: old.context.commit ?? null,
            theme:
              ({ claro: "light", escuro: "dark" } as Record<string, string>)[old.context.theme] ??
              old.context.theme,
            role: old.context.role === "membro" ? "member" : (old.context.role ?? null),
          });
          expect(comment.thread).toHaveLength(old.thread.length);
          for (const [j, message] of comment.thread.entries())
            expect(message).toMatchObject({
              ...old.thread[j],
              id: old.thread[j].id ?? `legacy-${old.id}-${j}`,
              attachments: old.thread[j].attachments ?? [],
              editedAt: old.thread[j].editedAt ?? null,
            });
          expect(comment.target.kind).toBe(old.target.kind);
          if (comment.target.kind !== "node")
            expect({
              ...comment.target,
              source: old.target.source,
              sourceChain: old.target.sourceChain,
            }).toEqual(old.target);
        }
        const path = join(directory, "roundtrip.json");
        await atomicWrite(path, result.file);
        expect(upgradeReviewFile(JSON.parse(await readFile(path, "utf8")))).toEqual({
          ok: true,
          file: result.file,
          rewrites: [],
        });
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("UT-088: populated v1 ids, edits, attachments and unknown fields survive", async () => {
    const raw = JSON.parse(
      await readFile(join(fixtures, "reloaddev-v1/mentoria/comments.json"), "utf8")
    );
    const message = raw.comments[0].thread[0];
    message.id = "existing-id";
    message.editedAt = "2026-10-30T00:00:00Z";
    message.attachments = [
      {
        id: crypto.randomUUID(),
        name: "shot.png",
        type: "image/png",
        width: 1,
        height: 1,
        size: 12,
        custom: "image-data",
      },
    ];
    message.custom = { preserve: true };
    raw.custom = [1, 2];
    const result = upgradeReviewFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.comments[0]!.thread[0]).toMatchObject({
      id: "existing-id",
      editedAt: message.editedAt,
      attachments: [{ id: message.attachments[0].id, size: 12 }],
    });
    expect(result.file.extra?.legacyUnknown).toMatchObject({
      "/custom": [1, 2],
      "/comments/0/thread/0/custom": { preserve: true },
      "/comments/0/thread/0/attachments/0/custom": "image-data",
    });
    expect(upgradeReviewFile(result.file)).toEqual({ ok: true, file: result.file, rewrites: [] });
  });
  it("UT-089: source and localized value rewrites are reported", async () => {
    const raw = JSON.parse(
      await readFile(join(fixtures, "reloaddev-v1/mentoria/comments.json"), "utf8")
    );
    raw.slug = "fluxo-demo";
    raw.comments = [raw.comments[0]];
    const comment = raw.comments[0];
    comment.id = "fluxo-demo-1";
    comment.slug = raw.slug;
    comment.context.theme = "escuro";
    comment.context.role = "membro";
    comment.target.source = "apps/app/src/x.tsx:1:1";
    comment.target.sourceChain = ["src/designs/foo/index.tsx"];
    const result = upgradeReviewFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.key).toBe("flow-demo");
    expect(result.file.comments[0]).toMatchObject({
      id: "flow-demo-1",
      context: { theme: "dark", role: "member" },
      target: { source: "src/x.tsx:1:1", sourceChain: ["src/drafts/foo/index.tsx"] },
    });
    expect(result.rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "apps/app/src/x.tsx:1:1", to: "src/x.tsx:1:1" }),
        expect.objectContaining({
          from: "src/designs/foo/index.tsx",
          to: "src/drafts/foo/index.tsx",
        }),
      ])
    );
  });
  it("UT-034: malformed versions return failure without throwing", () => {
    for (const value of [
      null,
      {},
      [],
      { version: 7 },
      { version: 2, slug: "demo", comments: [null] },
    ])
      expect(upgradeReviewFile(value).ok).toBe(false);
  });
});
