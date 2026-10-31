import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { releasePlan } from "./plan.mjs";
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const version = run("git-cliff", ["--bumped-version"]).replace(/^v/, "");
const plan = releasePlan(version, "stable");
const notes = run("git-cliff", ["--unreleased", "--tag", plan.tag]);
if (!notes.includes(`## ${plan.tag}`)) throw new Error("Release notes lack version heading");
const manifest = JSON.parse(readFileSync("packages/proto/package.json", "utf8"));
manifest.version = version;
writeFileSync("packages/proto/package.json", JSON.stringify(manifest, null, 4) + "\n");
mkdirSync(".release-notes", { recursive: true });
writeFileSync(`.release-notes/${plan.tag}.md`, notes + "\n");
writeFileSync("CHANGELOG.md", run("git-cliff", ["--tag", plan.tag]) + "\n");
run("bun", ["install", "--ignore-scripts"]);
run("bunx", [
  "oxfmt",
  "packages/proto/package.json",
  "CHANGELOG.md",
  `.release-notes/${plan.tag}.md`,
]);
run("git", ["switch", "-C", plan.branch]);
run("git", [
  "add",
  "packages/proto/package.json",
  "bun.lock",
  "CHANGELOG.md",
  `.release-notes/${plan.tag}.md`,
]);
run("git", ["-c", "core.hooksPath=/dev/null", "commit", "-m", plan.title]);
run("git", ["push", "--force-with-lease", "origin", `HEAD:refs/heads/${plan.branch}`]);
const prs = JSON.parse(
  run("gh", ["pr", "list", "--head", plan.branch, "--base", "main", "--json", "number"])
);
const args = ["--title", plan.title, "--body-file", `.release-notes/${plan.tag}.md`];
if (prs.length) run("gh", ["pr", "edit", String(prs[0].number), ...args]);
else run("gh", ["pr", "create", "--head", plan.branch, "--base", "main", ...args]);
