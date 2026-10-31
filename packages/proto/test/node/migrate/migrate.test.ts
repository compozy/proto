/** Owner: local migration. Invariants: lossless verified copy, no source deletion, resumable conflicts. */
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { migrateFiles } from "../../../src/migrate/index.ts";
import { loadProject } from "../../../src/node/project.ts";
import { png } from "../store/contract.ts";
const fixtures = resolve(import.meta.dirname, "../../fixtures/review");
const cli = resolve(import.meta.dirname, "../../../src/cli/main.ts");
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function setup(family = "stack-v2") {
  const root = await mkdtemp(join(tmpdir(), "proto-migration-"));
  roots.push(root);
  const source = join(root, "gallery/comments");
  await mkdir(source, { recursive: true });
  if (family === "compozy-v2-sequence") {
    await mkdir(join(source, "login-form"));
    await cp(join(fixtures, family, "comments.json"), join(source, "login-form/comments.json"));
  } else await cp(join(fixtures, family), source, { recursive: true });
  return { root, source };
}
it("UT-063: legacy config data migrates without evaluating imports; dry-run writes nothing", async () => {
  const { root, source } = await setup();
  await writeFile(
    join(root, "gallery.config.ts"),
    'import { defineGalleryConfig } from "uninstalled-legacy-package"; export default defineGalleryConfig({ title:"Legacy", specs:{auth:"Auth"}, roles:{membro:"Member"}, siteUrl:"https://example.com" });'
  );
  const dry = await migrateFiles(root, { from: source, dryRun: true });
  expect(dry.config.status).toBe("planned");
  expect(dry.keys[0]?.status).toBe("planned");
  await expect(stat(join(root, "proto"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(stat(join(root, "proto.config.ts"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(stat(join(root, "proto-migration-report.json"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  const report = await migrateFiles(root, { from: source });
  expect(report.verified).toBe(true);
  const project = await loadProject(root);
  expect(project.config).toMatchObject({
    title: "Legacy",
    specs: { auth: "Auth" },
    roles: { membro: "Member" },
    siteUrl: "https://example.com",
  });
  expect(report.deletable).not.toContain("vite.presentation.ts");
  expect(report.deletable).not.toContain("preview/");
});
it("UT-064: mapped flow identity, themes, roles, sources and image hashes survive copying", async () => {
  const { root, source } = await setup("reloaddev-v1");
  const raw = JSON.parse(await readFile(join(source, "mentoria/comments.json"), "utf8"));
  raw.slug = "fluxo-demo";
  raw.comments = [raw.comments[0]];
  const comment = raw.comments[0];
  comment.id = "fluxo-demo-1";
  comment.slug = raw.slug;
  comment.context.theme = "escuro";
  comment.context.role = "membro";
  comment.target.source = "apps/platform/src/designs/demo/index.tsx:1:2";
  const id = crypto.randomUUID();
  comment.thread[0].attachments = [
    { id, name: "shot.png", type: "image/png", size: png.length, width: 1, height: 1 },
  ];
  const folder = join(source, "fluxo-demo");
  await mkdir(join(folder, "attachments"), { recursive: true });
  await writeFile(join(folder, "attachments", `${id}.png`), png);
  await writeFile(join(folder, "comments.json"), JSON.stringify(raw));
  const report = await migrateFiles(root, {
    from: source,
    flowPrefix: "fluxo-",
    themeMap: { escuro: "dark", claro: "light" },
    roleMap: { membro: "member" },
  });
  expect(report.errors).toEqual([]);
  const key = report.keys.find(key => key.key === "flow-demo")!;
  expect(key).toMatchObject({
    sourceVersion: 1,
    comments: 1,
    verified: true,
    sequence: 1,
    attachments: [{ id, bytes: png.length, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }],
  });
  expect(key.rewrites).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ from: "fluxo-demo", to: "flow-demo" }),
      expect.objectContaining({ from: "escuro", to: "dark" }),
      expect.objectContaining({ from: "membro", to: "member" }),
      expect.objectContaining({ to: "src/drafts/demo/index.tsx:1:2" }),
    ])
  );
  expect(
    new Uint8Array(await readFile(join(root, "proto/review/flow-demo/attachments", `${id}.png`)))
  ).toEqual(png);
  expect(await readFile(join(folder, "comments.json"), "utf8")).toBe(JSON.stringify(raw));
});
it("UT-082: conflicting target is preserved while other keys proceed", async () => {
  const { root, source } = await setup("reloaddev-v1");
  await mkdir(join(root, "proto/review"), { recursive: true });
  const target = join(root, "proto/review/mentoria.json");
  await writeFile(target, '{"different":true}');
  const report = await migrateFiles(root, { from: source });
  expect(report.errors).toContainEqual(
    expect.objectContaining({ key: "mentoria", code: "migration_conflict" })
  );
  expect(report.keys.filter(key => key.verified)).toHaveLength(7);
  expect(await readFile(target, "utf8")).toBe('{"different":true}');
  expect(report.deletable).toEqual([]);
});
it("UT-083: rerun preserves verified key bytes and repairs an interrupted image copy", async () => {
  const { root, source } = await setup();
  const raw = JSON.parse(await readFile(join(source, "proto-shell/comments.json"), "utf8"));
  const id = crypto.randomUUID();
  raw.comments[0].thread[0].attachments = [
    { id, name: "shot.png", type: "image/png", size: png.length, width: 1, height: 1 },
  ];
  await mkdir(join(source, "proto-shell/attachments"));
  await writeFile(join(source, "proto-shell/attachments", `${id}.png`), png);
  await writeFile(join(source, "proto-shell/comments.json"), JSON.stringify(raw));
  const first = await migrateFiles(root, { from: source });
  expect(first.verified).toBe(true);
  const target = join(root, "proto/review/proto-shell.json"),
    before = await stat(target);
  const second = await migrateFiles(root, { from: source });
  expect(second.keys[0]?.status).toBe("unchanged");
  expect((await stat(target)).mtimeMs).toBe(before.mtimeMs);
  await rm(join(root, "proto/review/proto-shell/attachments", `${id}.png`));
  const recovered = await migrateFiles(root, { from: source });
  expect(recovered.verified).toBe(true);
  expect(recovered.keys[0]?.status).toBe("migrated");
  expect(
    new Uint8Array(await readFile(join(root, "proto/review/proto-shell/attachments", `${id}.png`)))
  ).toEqual(png);
});
it.each(["stack-v2", "compozy-v2-sequence"])(
  "IT-019: %s copy migrates through CLI and proto check exits zero",
  async family => {
    const { root, source } = await setup(family);
    await writeFile(join(root, "gallery.config.ts"), 'export default {title:"Fixture"};');
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await writeFile(join(root, "vite.config.ts"), "export default {};");
    const slug = family === "stack-v2" ? "proto-shell" : "login-form";
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, `src/${slug}.proto.tsx`),
      `const definePrototype = x => x; export const meta=definePrototype({title:"Fixture",states:[{id:"compare",label:"Compare"}]});export default function Prototype(){return null;}`
    );
    await symlink(
      resolve(import.meta.dirname, "../../../node_modules"),
      join(root, "node_modules"),
      "dir"
    );
    const exec = promisify(execFile);
    const migrated = await exec(
      "bun",
      [cli, "migrate", "--from", source, "--app", root, "--json"],
      { cwd: root }
    );
    const report = JSON.parse(migrated.stdout);
    expect(report.verified).toBe(true);
    expect(report.keys.every((key: { verified: boolean }) => key.verified)).toBe(true);
    const checked = await exec("bun", [cli, "check", "--app", root, "--json"], { cwd: root });
    expect(JSON.parse(checked.stdout).ok).toBe(true);
    const project = await loadProject(root);
    expect((await project.migrate({ from: source })).keys[0]?.status).toBe("unchanged");
  },
  30000
);
