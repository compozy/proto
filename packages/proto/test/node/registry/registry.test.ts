import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, expect, it } from "vitest";
import { findPrototypes } from "../../../src/node/discovery.ts";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const meta =
  '{ title: "Login", spec: "auth", states: [{id:"idle",label:"Idle"},{id:"loading",label:"Loading"},{id:"error",label:"Error"},{id:"done",label:"Done"}] }';
function discover(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "proto-registry-"));
  roots.push(root);
  for (const [file, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), code);
  }
  return findPrototypes(root, root, {
    title: "Test",
    specs: { auth: "Auth" },
    roles: { member: "Member" },
    siteUrl: null,
  });
}
const source = (value = meta, jsx = "<View />") =>
  `export const meta = definePrototype(${value}); export default () => ${jsx};`;
it("UT-001 metadata and UT-008 discovery never executes modules", () => {
  const r = discover({ "src/login-form.proto.tsx": 'throw Error("no");' + source() });
  expect(r.problems).toEqual([]);
  expect(r.entries[0]).toMatchObject({
    slug: "login-form",
    kind: "component",
    meta: { spec: "auth" },
  });
  expect(r.entries[0]?.meta?.states).toHaveLength(4);
});
it("UT-002 draft identity and UT-011 component index identity", () => {
  expect(
    discover({ "src/drafts/review-digest/index.proto.tsx": source(meta, "<div />") }).entries[0]
  ).toMatchObject({ slug: "review-digest", kind: "draft" });
  expect(discover({ "src/login/index.proto.tsx": source() }).entries[0]?.kind).toBe("component");
});
it("UT-003 duplicate identity names both files", () =>
  expect(
    discover({ "src/login.proto.tsx": source(), "src/other/login.proto.tsx": source() }).problems[0]
      ?.message
  ).toMatch(/src\/login.*src\/other\/login/));
it("UT-004 reserved and invalid slugs", () =>
  expect(
    discover({
      "src/flow-intro.proto.tsx": source(),
      "src/Intro_1.proto.tsx": source(),
    }).problems.map(p => p.code)
  ).toEqual(expect.arrayContaining(["reserved_slug", "invalid_slug"])));
it("UT-005 computed metadata is rejected with location", () =>
  expect(discover({ "src/login.proto.tsx": source("makeMeta()") }).problems[0]).toMatchObject({
    code: "invalid_meta",
    line: 1,
  }));
it("UT-006 duplicate states", () =>
  expect(
    discover({ "src/login.proto.tsx": source(meta.replace('id:"done"', 'id:"idle"')) }).problems[0]
      ?.code
  ).toBe("duplicate_state"));
it("UT-007 intrinsic markup has location and drafts allow markup", () => {
  expect(discover({ "src/login.proto.tsx": source(meta, "<div />") }).problems[0]).toMatchObject({
    code: "markup",
    line: 1,
  });
  expect(
    discover({ "src/drafts/login/index.proto.tsx": source(meta, "<div />") }).problems
  ).toEqual([]);
});
it("UT-009 unknown roles", () =>
  expect(
    discover({ "src/login.proto.tsx": source(meta.replace("title:", 'roles:["owner"],title:')) })
      .problems[0]?.code
  ).toBe("unknown_role"));
it("UT-010 unknown specs", () =>
  expect(
    discover({ "src/login.proto.tsx": source(meta.replace('"auth"', '"billing"')) }).problems[0]
      ?.code
  ).toBe("unknown_spec"));

it("IT-012 and UT-097 check refuses invalid registry and reports unavailable specs", async () => {
  const { loadProject } = await import("../../../src/node/project.ts");
  const { checkProject } = await import("../../../src/node/check.ts");
  const root = mkdtempSync(join(tmpdir(), "proto-check-"));
  roots.push(root);
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), '{"type":"module"}');
  writeFileSync(join(root, "proto.config.ts"), 'export default {title:"Check",specs:()=>null};');
  writeFileSync(join(root, "src/test.proto.tsx"), source("computed()"));
  const project = await loadProject(root);
  const result = await checkProject(project);
  expect(result.ok).toBe(false);
  expect(result.problems[0]?.code).toBe("invalid_meta");
  expect(result.warnings.map(w => w.code)).toContain("specs_unavailable");
});
