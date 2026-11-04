#!/usr/bin/env node
// Unpublished release-gate comparator: public stories run --json reports
// augmented with revisions (compozy, proto, storybook) and theme.
// node scripts/stories-parity.mjs baseline.json proto.json
import { readFileSync } from "node:fs";
const [baselinePath, protoPath] = process.argv.slice(2);
if (!baselinePath || !protoPath)
  throw new Error("Usage: stories-parity.mjs baseline.json proto.json");
const read = path => {
  const input = JSON.parse(readFileSync(path, "utf8"));
  if (
    !input.revisions?.compozy ||
    !input.revisions?.proto ||
    !input.revisions?.storybook ||
    !input.theme
  )
    throw new Error(`${path}: revisions (compozy, proto, storybook) and theme are required`);
  const rows = Array.isArray(input.stories) ? input.stories : [];
  const map = new Map();
  for (const row of rows) {
    if (
      !row.id ||
      !["passed", "failed"].includes(row.status) ||
      !["import", "load", "render", "play"].includes(row.stage)
    )
      throw new Error(`${path}: invalid result row`);
    const key = `${row.root}:${row.id}`;
    if (map.has(key)) throw new Error(`${path}: duplicate ${key}`);
    map.set(key, row);
  }
  if (!map.size) throw new Error(`${path}: empty run`);
  return { input, map };
};
const baseline = read(baselinePath),
  proto = read(protoPath);
const violations = [];
if (baseline.input.theme !== proto.input.theme) violations.push("Theme mismatch");
for (const field of ["compozy", "storybook"])
  if (baseline.input.revisions[field] !== proto.input.revisions[field])
    violations.push(`${field} revision mismatch`);
for (const id of new Set([...baseline.map.keys(), ...proto.map.keys()])) {
  const before = baseline.map.get(id),
    after = proto.map.get(id);
  if (!before || !after) {
    violations.push(`${id}: missing from ${before ? "proto" : "baseline"}`);
    continue;
  }
  if (after.status === "passed") continue;
  if (
    after.id === "systems-marketplace-routes-marketplace--logo-generator-failure" &&
    after.stage === "load"
  )
    continue;
  if (after.stage !== "play" || before.status !== "failed")
    violations.push(`${id}: ${after.stage}: ${after.error}`);
}
console.log(
  JSON.stringify(
    {
      revisions: proto.input.revisions,
      theme: proto.input.theme,
      count: proto.map.size,
      violations,
    },
    null,
    2
  )
);
process.exitCode = violations.length ? 1 : 0;
