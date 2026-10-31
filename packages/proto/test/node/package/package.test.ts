import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { test, expect } from "vitest";
// @ts-expect-error Packaging scripts run as native ESM, outside the application TS graph.
import { checkSize, budget } from "../../../scripts/check-size.mjs";
// @ts-expect-error Release tooling runs as native ESM.
import { releasePlan, isReleaseSubject } from "../../../../../scripts/release/plan.mjs";

test("UT-085: package build accepts a small shell and rejects one above 400 KiB gzip", async () => {
  const dir = await mkdtemp(join(tmpdir(), "proto-size-"));
  try {
    await writeFile(join(dir, "shell.js"), "export const shell = true;");
    expect(await checkSize(dir)).toBeLessThan(budget);
    await writeFile(join(dir, "shell.js"), randomBytes(budget + 4096));
    await expect(checkSize(dir)).rejects.toThrow("exceeds");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("release plan owns version, branch, merge subject and channel identity", () => {
  expect(releasePlan("0.1.0", "stable")).toMatchObject({
    branch: "release/v0.1.0",
    title: "build: release v0.1.0",
    npmTag: "latest",
    prerelease: false,
  });
  expect(releasePlan("0.2.0-beta.1", "beta")).toMatchObject({ npmTag: "beta", prerelease: true });
  for (const version of ["v1.0.0", "01.0.0", "1.0", "1.0.0\n", "1.0.0;echo bad"])
    expect(() => releasePlan(version, "stable")).toThrow();
  expect(() => releasePlan("0.2.0-beta.1", "stable")).toThrow();
  expect(() => releasePlan("0.2.0", "beta")).toThrow();
  expect(isReleaseSubject("build: release v0.1.0 (#123)")).toBe(true);
  expect(isReleaseSubject("feat: add shell")).toBe(false);
});

test("release workflow contract isolates publication and finalizes GitHub only after npm", async () => {
  const workflow = await readFile(
    new URL("../../../../../.github/workflows/release.yml", import.meta.url),
    "utf8"
  );
  expect(workflow).toContain(
    "github.event_name == 'push' && !startsWith(github.event.head_commit.message, 'build: release v')"
  );
  expect(workflow).toContain(
    "github.event_name == 'pull_request' || (github.ref == 'refs/heads/main' && (github.event_name == 'workflow_dispatch' || startsWith(github.event.head_commit.message, 'build: release v')))"
  );
  expect(workflow).toContain("&& '-publish' || ''");
  expect(workflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  expect(workflow).toContain("id-token: write");
  for (const step of [
    "Publish npm with trusted identity",
    "Tag and publish GitHub Release after npm succeeds",
  ]) {
    expect(workflow.split(`- name: ${step}`)[1]?.split("- name:")[0]).toContain(
      "if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'"
    );
  }
  expect(workflow).not.toMatch(/secrets\.(NPM_TOKEN|NODE_AUTH_TOKEN)/);
  expect(workflow.indexOf("node packages/proto/scripts/publish.mjs")).toBeLessThan(
    workflow.indexOf("bash scripts/release/finalize.sh")
  );
});

test("release planner validates the actual Git commit and refuses conflicting tags without mutation", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdir } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const dir = await mkdtemp(join(tmpdir(), "proto-release-plan-"));
  const planner = fileURLToPath(
    new URL("../../../../../scripts/release/plan.mjs", import.meta.url)
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    git("init", "--initial-branch=main");
    git("config", "user.name", "Release Contract");
    git("config", "user.email", "contract@example.invalid");
    await mkdir(join(dir, "packages/proto"), { recursive: true });
    await writeFile(join(dir, "packages/proto/package.json"), '{"version":"0.1.0"}');
    git("add", ".");
    git("-c", "core.hooksPath=/dev/null", "commit", "-m", "build: release v0.1.0");
    const head = git("rev-parse", "HEAD");
    const output = join(dir, "output");
    const env = {
      ...process.env,
      GITHUB_EVENT_NAME: "push",
      GITHUB_OUTPUT: output,
      RELEASE_CHANNEL: "stable",
      RELEASE_VERSION: "0.1.0",
    };
    execFileSync("node", [planner], { cwd: dir, env });
    expect(await readFile(output, "utf8")).toContain(`commit=${head}`);
    expect(git("rev-parse", "HEAD")).toBe(head);
    git("tag", "v0.1.0");
    git("-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-m", "build: release v0.1.0");
    execFileSync("node", [planner], {
      cwd: dir,
      env: { ...env, GITHUB_EVENT_NAME: "pull_request" },
      stdio: "pipe",
    });
    expect(() => execFileSync("node", [planner], { cwd: dir, env, stdio: "pipe" })).toThrow();
    expect(() =>
      execFileSync("node", [planner], {
        cwd: dir,
        env: { ...env, RELEASE_VERSION: "0.2.0" },
        stdio: "pipe",
      })
    ).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Owner: executable package/release boundary; denied refs cannot reach registry I/O.
test("publication rejects non-main refs before reading the package or contacting npm", async () => {
  const { spawnSync } = await import("node:child_process");
  const script = new URL("../../../scripts/publish.mjs", import.meta.url);
  for (const ref of ["refs/heads/feature", "refs/heads/release/v0.1.0", "refs/tags/v0.1.0", ""]) {
    const result = spawnSync("node", [script.pathname], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_REF: ref },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Publication is restricted to refs/heads/main");
  }
});
test("source CLI --version reports the package version", async () => {
  const { execFileSync } = await import("node:child_process");
  const manifest = JSON.parse(
    await readFile(new URL("../../../package.json", import.meta.url), "utf8")
  );
  const cli = new URL("../../../src/cli/main.ts", import.meta.url).pathname;
  for (const flag of ["--version", "-v"])
    expect(execFileSync("bun", [cli, flag], { encoding: "utf8" }).trim()).toBe(manifest.version);
});
