#!/usr/bin/env node
/**
 * pr-release `release_artifacts` step (.pr-release.yaml). pr-release writes the new version into
 * the root package.json with Go's JSON encoder, but the published package is packages/proto and
 * the private workspace root has no version. Restore the root manifest from HEAD and change only
 * `"version"` in packages/proto/package.json, so a release diff is one line plus the lockfile.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Replace the top-level `"version"` value of a package.json source, keeping everything else. */
export function withVersion(source, version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-beta\.(0|[1-9]\d*))?$/.test(version))
    throw new Error(`Invalid version: ${version}`);
  const pattern = /^(\s*"version"\s*:\s*)"[^"]*"/m;
  if (!pattern.test(source)) throw new Error('package.json has no top-level "version"');
  const next = source.replace(pattern, `$1"${version}"`);
  if (JSON.parse(next).version !== version) throw new Error("Version replacement failed");
  return next;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.env.PR_RELEASE_VERSION_NUMBER;
  if (!version) throw new Error("PR_RELEASE_VERSION_NUMBER is not set; run through pr-release");
  const committed = path => execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" });
  writeFileSync("package.json", committed("package.json"));
  writeFileSync(
    "packages/proto/package.json",
    withVersion(committed("packages/proto/package.json"), version)
  );
}
