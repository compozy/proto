import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function releasePlan(version, channel) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-beta\.(0|[1-9]\d*))?$/.test(version))
    throw new Error("Invalid release version");
  if (!["stable", "beta"].includes(channel) || (channel === "beta") !== version.includes("-beta."))
    throw new Error("Version/channel mismatch");
  return {
    version,
    channel,
    tag: `v${version}`,
    branch: `release/v${version}`,
    title: `build: release v${version}`,
    npmTag: channel === "stable" ? "latest" : "beta",
    prerelease: channel === "beta",
  };
}
export const isReleaseSubject = subject => subject.startsWith("build: release v");
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = JSON.parse(readFileSync("packages/proto/package.json", "utf8")).version;
  const requested = process.env.RELEASE_VERSION;
  if (requested && requested !== version)
    throw new Error("Dispatch version must match committed package");
  const plan = releasePlan(
    version,
    process.env.RELEASE_CHANNEL || (version.includes("-beta.") ? "beta" : "stable")
  );
  const subject = execFileSync("git", ["log", "-1", "--format=%s"], { encoding: "utf8" }).trim();
  if (
    process.env.GITHUB_EVENT_NAME === "push" &&
    subject !== plan.title &&
    !subject.startsWith(`${plan.title} (#`)
  )
    throw new Error("Release merge subject does not match package version");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const tagged = spawnSync("git", ["rev-parse", "--verify", `refs/tags/${plan.tag}^{commit}`], {
    encoding: "utf8",
  });
  if (
    process.env.GITHUB_EVENT_NAME !== "pull_request" &&
    tagged.status === 0 &&
    tagged.stdout.trim() !== commit
  )
    throw new Error("Existing release tag points to another commit");
  for (const [key, value] of Object.entries({ ...plan, commit }))
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
