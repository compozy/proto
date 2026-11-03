// Suite: share snapshot. Invariants: target isolation and commit certification.
// IN: real discovery and Git status across an isolated workspace.
// OUT: Cloudflare/session orchestration; render output belongs to build/build.test.ts.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { loadProject } from "../../../src/node/project.ts";
import { appFixture } from "../app-fixture.ts";
import {
  checkDirtyTree,
  cleanupSnapshots,
  scopedProject,
  shareDirectory,
} from "../../../src/share/snapshot.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function fixture() {
  const root = appFixture("share-scope-");
  roots.push(root);
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "flows"));
  writeFileSync(
    join(root, "proto.config.ts"),
    `export default {
    title:'Share',specs:{auth:'Auth',cart:'Cart',private:'Private'},roles:{member:'Member'}
  };`
  );
  for (const [slug, spec] of [
    ["login-form", "auth"],
    ["cart", "cart"],
    ["private", "private"],
  ])
    writeFileSync(
      join(root, `src/${slug}.proto.tsx`),
      `export const meta=definePrototype({
      title:'${slug}',spec:'${spec}',states:[{id:'default',label:'Default'},{id:'extra',label:'Extra'}]
    });export default function View(){return null}`
    );
  writeFileSync(join(root, "src/broken.proto.tsx"), "export const meta=invalid();");
  writeFileSync(
    join(root, "flows/checkout.flow.ts"),
    `export const flow=defineFlow({
    title:'Checkout',spec:'cart',start:['login'],nodes:{
      login:{proto:'login-form',state:'default'},cart:{proto:'cart',state:'default',end:true}
    },edges:[['login','cart',{on:'Next'}]]
  });`
  );
  return loadProject(root);
}

it("UT-001: a prototype scope retains only its specs, diagnostics and roles", async () => {
  const project = await fixture();
  const registry = await project.registry();
  expect(registry.problems.length).toBeGreaterThan(0);
  const scoped = await scopedProject(project, { kind: "prototype", slug: "login-form" }).registry();
  expect(scoped.prototypes.map(proto => proto.slug)).toEqual(["login-form"]);
  expect(scoped.flows).toEqual([]);
  expect(scoped.specs).toEqual({ auth: "Auth" });
  expect(scoped.roles).toEqual({ member: "Member" });
  expect(scoped.problems).toEqual([]);
  expect(
    scoped.warnings.filter(warning => warning.proto).map(warning => warning.proto)
  ).toEqual(["login-form"]);
  expect(await scopedProject(project, { kind: "all" }).registry()).toEqual(registry);
  const missing = [
    { kind: "prototype", slug: "missing" },
    { kind: "flow", id: "missing" },
  ] as const;
  for (const target of missing)
    await expect(scopedProject(project, target).registry()).rejects.toMatchObject({
      code: "share_target_not_found",
      exit: 1,
    });
});

it("UT-002: a flow scope retains exactly the prototypes rendered by its steps", async () => {
  const project = await fixture();
  const registry = await scopedProject(project, { kind: "flow", id: "checkout" }).registry();
  expect(registry.flows.map(flow => flow.id)).toEqual(["checkout"]);
  expect(registry.prototypes.map(proto => proto.slug).sort()).toEqual(["cart", "login-form"]);
  expect(registry.specs).toEqual({ auth: "Auth", cart: "Cart" });
  expect(registry.problems).toEqual([]);
});

function repository() {
  const root = mkdtempSync(join(tmpdir(), "proto-share-git-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Share test");
  git("config", "user.email", "share@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", join(root, "no-hooks"));
  const app = join(root, "apps/app");
  mkdirSync(join(app, "proto/review"), { recursive: true });
  mkdirSync(join(root, "apps/sibling"), { recursive: true });
  writeFileSync(join(root, ".gitignore"), "/node_modules\n");
  writeFileSync(join(app, "source.ts"), "initial");
  writeFileSync(join(app, "proto/review/example.json"), "{}");
  writeFileSync(join(root, "apps/sibling/source.ts"), "initial");
  git("add", ".");
  git("commit", "--quiet", "-m", "fixture");
  return { root, app, git };
}

it("UT-004: clean trees and review/cache/staging edits remain approvable without ignore rules", async () => {
  const { app } = repository();
  const before = await checkDirtyTree(app, { approvers: true });
  expect(before).toMatchObject({ dirty: false, approvable: true, commit: expect.any(String) });
  writeFileSync(join(app, "proto/review/example.json"), '{"comments":[]}');
  writeFileSync(join(app, "proto/review/.gitignore"), ".server");
  mkdirSync(shareDirectory(app), { recursive: true });
  writeFileSync(join(shareDirectory(app), "artifact"), "snapshot");
  mkdirSync(join(app, ".proto-build-crashed"));
  writeFileSync(join(app, ".proto-build-crashed/asset"), "staging");
  expect(await checkDirtyTree(app, { approvers: true, before })).toEqual(before);
  await cleanupSnapshots(app);
  expect(existsSync(shareDirectory(app))).toBe(false);
  expect(existsSync(join(app, ".proto-build-crashed"))).toBe(false);
  expect(existsSync(join(app, "proto/review/example.json"))).toBe(true);
});

it.each(["untracked", "sibling", "commit"])(
  "UT-004: %s changes across build checks prevent approval",
  async change => {
    const { root, app, git } = repository();
    const before = await checkDirtyTree(app, { approvers: true });
    if (change === "untracked") {
      git("config", "status.showUntrackedFiles", "no");
      writeFileSync(join(app, "new.ts"), "new import");
    } else if (change === "sibling") {
      writeFileSync(join(root, "apps/sibling/source.ts"), "changed");
    } else {
      git("commit", "--quiet", "--allow-empty", "-m", "HEAD moved");
    }
    await expect(checkDirtyTree(app, { approvers: true, before })).rejects.toMatchObject({
      code: "share_dirty_tree",
      exit: 1,
    });
    expect(await checkDirtyTree(app, { before })).toMatchObject({ dirty: true, approvable: false });
  }
);

it("UT-004: no Git fails approval; commenter-only dirty work reports not approvable", async () => {
  const root = mkdtempSync(join(tmpdir(), "proto-share-no-git-"));
  roots.push(root);
  await expect(checkDirtyTree(root, { approvers: true })).rejects.toMatchObject({
    code: "share_dirty_tree",
  });
  expect(await checkDirtyTree(root)).toEqual({ commit: null, dirty: true, approvable: false });
  const { app } = repository();
  writeFileSync(join(app, "source.ts"), "changed");
  await expect(checkDirtyTree(app, { approvers: true })).rejects.toMatchObject({
    code: "share_dirty_tree",
  });
  expect(await checkDirtyTree(app)).toMatchObject({ dirty: true, approvable: false });
});
