import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mkdtempSync, cpSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { runCli } from "../../../src/cli/main.ts";
import { loadProject, type ProtoProject } from "../../../src/node/project.ts";
import { FileStore } from "../../../src/store/index.ts";
const timestamp = "2026-10-30T22:41:03.000Z";
const app = resolve(import.meta.dirname, "../../../../../apps/app");
let root: string;
let project: ProtoProject;
let store: FileStore;
let uuid = 0;
beforeAll(async () => {
  root = mkdtempSync(join(app, ".proto-cli-test-"));
  for (const path of [
    "proto.config.ts",
    "proto.canvas.tsx",
    "vite.config.ts",
    "vite.shared.ts",
    "src",
    "flows",
  ])
    cpSync(join(app, path), join(root, path), { recursive: true });
  const viteConfig = join(root, "vite.config.ts");
  writeFileSync(
    viteConfig,
    readFileSync(viteConfig, "utf8").replace(
      "defineConfig({ plugins:",
      'defineConfig({ cacheDir: ".vite", plugins:'
    )
  );
  execFileSync("git", ["init", "-q", root]);
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=Proto Fixture",
      "-c",
      "user.email=fixture@example.test",
      "commit",
      "--allow-empty",
      "-qm",
      "fixture",
    ],
    { env: { ...process.env, GIT_AUTHOR_DATE: timestamp, GIT_COMMITTER_DATE: timestamp } }
  );
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`
  );
  project = await loadProject(root);
  store = new FileStore({
    root,
    registry: () => project.registry(),
    clock: () => new Date(timestamp),
  });
  project = { ...project, store: () => store };
});
afterAll(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});
const cli = (...args: string[]) => runCli([...args, "--json"], { cwd: root, project });
it("UT-048 list JSON has the documented projection", async () => {
  const result = await cli("list");
  expect(result.exitCode).toBe(0);
  expect(result.data).toMatchObject({
    prototypes: expect.arrayContaining([
      expect.objectContaining({ slug: "login-form", states: expect.any(Array) }),
    ]),
    flows: expect.arrayContaining([expect.objectContaining({ steps: expect.any(Number) })]),
  });
  expect(JSON.stringify(result.data)).not.toContain('"blocks"');
});
it("UT-050 unknown command returns usage exit 2", async () =>
  expect((await cli("unknown")).exitCode).toBe(2));
it("UT-051 missing comment preserves registered error and exit", async () =>
  expect(await cli("comments", "show", "login-form-99")).toMatchObject({
    exitCode: 1,
    data: { error: { code: "comment_not_found" } },
  }));
it("IT-014 comment operations share the seeded store contract", async () => {
  const add = await cli(
    "comments",
    "add",
    "login-form",
    "--state",
    "error",
    "--selector",
    "#error",
    "--note",
    "Initial"
  );
  expect(add.exitCode).toBe(0);
  const id = "login-form-1";
  for (const args of [
    ["show", id],
    ["reply", id, "--note", "Reply"],
    ["edit", id, "--note", "Edited"],
    ["resolve", id, "--note", "Fixed"],
    ["reopen", id, "--note", "Again"],
    ["list", "--waiting"],
    ["attachments", id],
  ])
    expect((await cli("comments", ...args)).exitCode).toBe(0);
  expect((await cli("review", "status", "login-form")).data).toMatchObject({
    key: "login-form",
    open: 1,
  });
  expect((await cli("review", "approve", "login-form", "--confirm-open")).exitCode).toBe(0);
  expect((await cli("review", "reopen", "login-form")).exitCode).toBe(0);
  expect((await cli("comments", "delete", id)).data).toEqual({ deleted: id });
});
it("UT-098 unlock requires force and reports the removed owner", async () => {
  await store.ready();
  const lock = join(root, "proto/review/login-form.lock");
  mkdirSync(lock, { recursive: true });
  writeFileSync(
    join(lock, "owner.json"),
    JSON.stringify({
      token: "foreign",
      hostId: "another-host",
      pid: 81233,
      processStartedAt: "yesterday",
    })
  );
  expect((await cli("review", "unlock", "login-form")).exitCode).toBe(2);
  expect((await cli("review", "unlock", "login-form", "--force")).data).toEqual({
    removedOwner: { hostId: "another-host", pid: 81233 },
  });
});
it("UT-045 draft scaffold and UT-047 duplicate slug", async () => {
  expect((await cli("new", "review-digest", "--draft")).exitCode).toBe(0);
  expect(await cli("new", "review-digest", "--draft")).toMatchObject({
    exitCode: 1,
    data: { error: { code: "slug_taken" } },
  });
});
it("UT-046 component scaffold composes the view", async () => {
  writeFileSync(join(root, "src/example.tsx"), "export function Example(){return <div/>;}");
  expect((await cli("new", "--in", "src/example.tsx")).exitCode).toBe(0);
  expect(readFileSync(join(root, "src/example.proto.tsx"), "utf8")).toContain("<Example />");
});
it("UT-049 check exits one on problems and zero on warnings", async () => {
  writeFileSync(join(root, "src/broken.proto.tsx"), "export const meta = compute();");
  expect((await cli("check")).exitCode).toBe(1);
  rmSync(join(root, "src/broken.proto.tsx"));
  const specs = project.config.specs;
  project.config.specs = null;
  try {
    const warnings = await cli("check");
    expect(warnings.exitCode).toBe(0);
    expect(warnings.data).toMatchObject({
      warnings: expect.arrayContaining([expect.objectContaining({ code: "specs_unavailable" })]),
    });
  } finally {
    project.config.specs = specs;
  }
}, 30000);
it("IT-014 flow and URL JSON operations", async () => {
  expect((await cli("flow", "new", "created", "--spec", "auth")).exitCode).toBe(0);
  for (const args of [["list"], ["show", "created"], ["coverage"]])
    expect((await cli("flow", ...args)).exitCode).toBe(0);
  expect((await cli("url", "login-form", "--bare", "--state", "error")).data).toMatchObject({
    url: expect.stringContaining("/__proto/render/login-form"),
  });
});
it("UT-040 UT-041 UT-043 IT-010 init writes the integration and checks it", async () => {
  const fresh = mkdtempSync(join(app, ".proto-init-test-"));
  try {
    writeFileSync(
      join(fresh, "vite.config.ts"),
      'import react from "@vitejs/plugin-react"; export default {plugins:[react()]};'
    );
    const init = await runCli(["init", "--skills", "--json"], { cwd: fresh });
    expect(init.exitCode).toBe(0);
    expect((init.data as { files: string[] }).files).toEqual(
      expect.arrayContaining([
        "proto.config.ts",
        "proto.canvas.tsx",
        "src/drafts/welcome/index.proto.tsx",
        "vite.config.ts",
        "docs/design/prototyping.md",
      ])
    );
    expect(readFileSync(join(fresh, "docs/design/prototyping.md"), "utf8")).toContain(
      "target: library"
    );
    expect(readFileSync(join(fresh, "vite.config.ts"), "utf8")).toContain("proto()");
    expect((await runCli(["init", "--json"], { cwd: fresh })).data).toMatchObject({
      skipped: true,
    });
    expect((await runCli(["init", "--force", "--json"], { cwd: fresh })).data).toMatchObject({
      skipped: false,
    });
    expect((await runCli(["check", "--json"], { cwd: fresh })).exitCode).toBe(0);
  } finally {
    rmSync(fresh, { recursive: true, force: true });
  }
}, 30000);
it("UT-042 init outside a Vite app fails clearly", async () => {
  const empty = mkdtempSync(join(app, ".proto-empty-test-"));
  try {
    expect(
      await runCli(["init", "--json"], { cwd: empty, project: { ...project, root: empty } })
    ).toMatchObject({ exitCode: 1, data: { error: { code: "not_a_vite_app" } } });
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
it("IT-014 image attachment, detach and download use the store boundary", async () => {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=",
    "base64"
  );
  writeFileSync(join(root, "shot.png"), bytes);
  const added = await cli(
    "comments",
    "add",
    "login-form",
    "--selector",
    "#error",
    "--note",
    "Image"
  );
  const id = (added.data as { comment: { id: string } }).comment.id;
  const attached = await cli("comments", "attach", id, "shot.png");
  expect(attached.exitCode).toBe(0);
  const attachmentId = (
    attached.data as { comment: { thread: { attachments: { id: string }[] }[] } }
  ).comment.thread[0]!.attachments[0]!.id;
  expect((await cli("comments", "attachments", id)).data).toEqual({
    files: [`.tmp/proto/${id}/${attachmentId}.png`],
  });
  expect((await cli("comments", "detach", id, attachmentId)).exitCode).toBe(0);
});
it("remote approval is denied and remote transport fails clearly until slice 8", async () => {
  expect(await cli("review", "approve", "login-form", "--remote")).toMatchObject({
    exitCode: 4,
    data: { error: { code: "scope_denied" } },
  });
  expect(await cli("comments", "list", "--remote")).toMatchObject({
    exitCode: 4,
    data: { error: { code: "auth_required" } },
  });
});
it("UT-054 a missing Chromium launcher gives exit 3", async () => {
  const { vi } = await import("vitest");
  const { chromium } = await import("playwright");
  const spy = vi.spyOn(chromium, "launch").mockRejectedValueOnce(Error("Executable missing"));
  try {
    expect(await cli("screenshot", "login-form")).toMatchObject({
      exitCode: 3,
      data: { error: { code: "playwright_missing" } },
    });
  } finally {
    spy.mockRestore();
  }
});
it("UT-053 IT-016 Chromium writes a 1440-wide PNG and inert evidence HTML", async context => {
  const { chromium } = await import("playwright");
  const { existsSync } = await import("node:fs");
  if (!existsSync(chromium.executablePath())) {
    context.skip();
    return;
  }
  const { createServer } = await import("node:net");
  const portServer = createServer();
  await new Promise<void>((resolve, reject) => {
    portServer.once("error", reject);
    portServer.listen(0, "127.0.0.1", resolve);
  });
  const port = (portServer.address() as { port: number }).port;
  await new Promise<void>(resolve => portServer.close(() => resolve()));
  const savedPort = project.config.dev.port;
  project.config.dev.port = port;
  try {
    const screenshot = await cli("screenshot", "login-form", "--state", "error");
    expect(screenshot).toMatchObject({
      exitCode: 0,
      data: { path: "docs/design/login-form/error--light--1440.png", width: 1440 },
    });
    const { inspectImage } = await import("../../../src/node/image.ts");
    expect(
      inspectImage(readFileSync(join(root, "docs/design/login-form/error--light--1440.png")))
    ).toMatchObject({ width: 1440 });
    const evidence = await cli("evidence", "login-form", "--state", "error");
    expect(evidence).toMatchObject({
      exitCode: 0,
      data: { path: "docs/design/login-form/index.html" },
    });
    expect(readFileSync(join(root, "docs/design/login-form/index.html"), "utf8")).not.toMatch(
      /<script/i
    );
  } finally {
    project.config.dev.port = savedPort;
  }
}, 30000);

it("IT-014 migrate dispatches through the catalog without requiring proto.config", async () => {
  const target = mkdtempSync(join(app, ".proto-migrate-cli-"));
  try {
    const source = join(target, "gallery/comments/proto-shell");
    mkdirSync(source, { recursive: true });
    cpSync(
      resolve(import.meta.dirname, "../../fixtures/review/stack-v2/proto-shell/comments.json"),
      join(source, "comments.json")
    );
    const result = await runCli(["migrate", "--from", "gallery/comments", "--dry-run", "--json"], {
      cwd: target,
    });
    expect(result).toMatchObject({
      exitCode: 0,
      data: {
        dryRun: true,
        errors: [],
        keys: expect.arrayContaining([
          expect.objectContaining({ key: "proto-shell", status: "planned" }),
        ]),
      },
    });
    expect(
      (
        await runCli(
          ["migrate", "--from", "gallery/comments", "--theme-map", "invalid", "--json"],
          { cwd: target }
        )
      ).exitCode
    ).toBe(2);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
it("IT-014 real CLI process uses project.store FileStore wiring", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const result = await promisify(execFile)("bun", [
    resolve(import.meta.dirname, "../../../src/cli/main.ts"),
    "comments",
    "list",
    "--app",
    root,
    "--status",
    "all",
    "--json",
  ]);
  expect(JSON.parse(result.stdout)).toHaveProperty("comments");
});
