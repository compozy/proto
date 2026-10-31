import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { expect, it } from "vitest";
import { findFlows } from "../../../src/node/flows.ts";
const config = {
  title: "Test",
  specs: { auth: "Auth" },
  roles: { member: "Member" },
  siteUrl: "https://example.com",
};
const prototypes = [
  {
    slug: "welcome",
    kind: "component" as const,
    file: "src/welcome.proto.tsx",
    meta: {
      title: "Welcome",
      spec: "auth",
      states: [
        { id: "idle", label: "Idle" },
        { id: "done", label: "Done" },
      ] as [{ id: string; label: string }, { id: string; label: string }],
    },
  },
];
const valid =
  '{title:"Test",spec:"auth",start:["site"],nodes:{site:{external:"site"},login:{proto:"welcome",state:"idle",end:true}},edges:[["site","login",{on:"Sign in"}]]}';
function scan(code: string, file = "flows/sign-in.flow.ts") {
  const root = mkdtempSync(join(tmpdir(), "proto-flow-"));
  try {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), code);
    return findFlows(root, root, prototypes, config);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
it.each([
  ["flow_outside_root", valid, "src/test.flow.ts"],
  ["invalid_flow_id", valid, "flows/Bad.flow.ts"],
  ["missing_flow", "computed()"],
  ["invalid_flow", valid.replace('title:"Test"', "title:false")],
  ["unknown_spec", valid.replace('spec:"auth"', 'spec:"missing"')],
  ["unknown_prototype", valid.replace('proto:"welcome"', 'proto:"missing"')],
  ["unknown_state", valid.replace('state:"idle"', 'state:"missing"')],
  ["unknown_role", valid.replace('state:"idle"', 'state:"idle",role:"owner"')],
  ["duplicate_node", valid.replace("nodes:{", 'nodes:{site:{external:"site"},')],
  ["invalid_node", valid.replace('external:"site"', 'external:"site",proto:"welcome"')],
  ["unknown_node", valid.replace('start:["site"]', 'start:["site","missing"]')],
  ["duplicate_edge", valid.replace("edges:[", 'edges:[["site","login",{on:"Sign in"}],')],
  ["unreachable", valid.replace("nodes:{", 'nodes:{unused:{external:"email",end:true},')],
  ["dead_end", valid.replace("end:true", "end:false")],
])("UT-012 %s", (code, value, file?: string) =>
  expect(scan(`export const flow=defineFlow(${value});`, file).problems.map(p => p.code)).toEqual([
    code,
  ])
);
it("UT-019 BFS numbering and UT-020 uncovered states", () => {
  const journey =
    '{title:"Journey",spec:"auth",start:["site"],nodes:{site:{external:"site"},"sign-in":{proto:"welcome",state:"idle"},error:{proto:"welcome",state:"idle"},home:{proto:"welcome",state:"idle",end:true}},edges:[["site","sign-in",{on:"Start"}],["sign-in","error",{on:"Wrong password"}],["error","home",{on:"Success"}]]}';
  const result = scan(`throw Error("never execute");export const flow=defineFlow(${journey});`);
  expect(result.problems).toEqual([]);
  expect(result.flows[0]?.nodes.map(n => [n.id, n.step])).toEqual([
    ["site", 1],
    ["sign-in", 2],
    ["error", 3],
    ["home", 4],
  ]);
  expect(result.warnings).toContainEqual({
    code: "uncovered_state",
    spec: "auth",
    slug: "welcome",
    state: "done",
  });
});
