import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { test, expect } from "vitest";
// @ts-expect-error Packaging scripts run as native ESM, outside the application TS graph.
import { checkSize, budget } from "../../../scripts/check-size.mjs";
// @ts-expect-error Release tooling runs as native ESM.
import { withVersion } from "../../../../../scripts/release/sync-version.mjs";

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

// Owner: release preparation (pr-release `release_artifacts`). The release pull request changes
// only the published package's version: pr-release's own root package.json rewrite is undone.
test("release version sync touches only the published package version", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdir } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const script = fileURLToPath(
    new URL("../../../../../scripts/release/sync-version.mjs", import.meta.url)
  );
  const dir = await mkdtemp(join(tmpdir(), "proto-release-sync-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  const root = '{\n    "name": "proto",\n    "private": true\n}\n';
  const manifest =
    '{\n    "name": "@compozy/proto",\n    "version": "0.1.1",\n    "type": "module"\n}\n';
  try {
    git("init", "--initial-branch=main");
    await mkdir(join(dir, "packages/proto"), { recursive: true });
    await writeFile(join(dir, "package.json"), root);
    await writeFile(join(dir, "packages/proto/package.json"), manifest);
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "init");
    // What pr-release leaves behind: a reformatted root manifest with a version it does not own.
    await writeFile(
      join(dir, "package.json"),
      '{\n  "private": true,\n  "name": "proto",\n  "version": "0.1.2"\n}\n'
    );
    execFileSync("node", [script], {
      cwd: dir,
      env: { ...process.env, PR_RELEASE_VERSION_NUMBER: "0.1.2" },
    });
    expect(await readFile(join(dir, "package.json"), "utf8")).toBe(root);
    expect(await readFile(join(dir, "packages/proto/package.json"), "utf8")).toBe(
      manifest.replace('"0.1.1"', '"0.1.2"')
    );
    expect(() => execFileSync("node", [script], { cwd: dir, stdio: "pipe" })).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  for (const version of ["v1.0.0", "01.0.0", "1.0", "1.0.0\n", "1.0.0;echo bad"])
    expect(() => withVersion(manifest, version)).toThrow("Invalid version");
  expect(() => withVersion("{}", "0.2.0")).toThrow("no top-level");
});

test("release workflow contract isolates publication and finalizes GitHub only after npm", async () => {
  const workflow = await readFile(
    new URL("../../../../../.github/workflows/release.yml", import.meta.url),
    "utf8"
  );
  expect(workflow).toContain(
    "github.event_name == 'push' && !(startsWith(github.event.head_commit.message, 'build: release v') || startsWith(github.event.head_commit.message, 'build: prepare release v'))"
  );
  expect(workflow).toContain(
    "github.event_name == 'pull_request' || (github.ref == 'refs/heads/main' && (github.event_name == 'workflow_dispatch' || (startsWith(github.event.head_commit.message, 'build: release v') || startsWith(github.event.head_commit.message, 'build: prepare release v'))))"
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
  expect(workflow).toContain("BOOTSTRAP_NPM_TOKEN: ${{ secrets.NPM_TOKEN }}");
  // pr-release owns the release pull request and the publication identity.
  expect(workflow).toContain('go run "$PR_RELEASE_MODULE" pr-release --force --enable-rollback');
  expect(workflow).toContain("plan --ref HEAD --version");
  expect(workflow.indexOf("node packages/proto/scripts/publish.mjs")).toBeLessThan(
    workflow.indexOf("bash scripts/release/finalize.sh")
  );
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

// Owner: release authentication boundary; package existence, never version absence, chooses auth.
test("registry package status permits one bootstrap and refuses token auth thereafter", async () => {
  // @ts-expect-error Release tooling runs as native ESM.
  const { publicationAuth } = await import("../../../scripts/publication-auth.mjs");
  const candidate = { version: "0.1.0", channel: "stable", bootstrapToken: "test-secret" };
  expect(publicationAuth(404, candidate)).toBe("bootstrap");
  expect(publicationAuth(200, candidate)).toBe("oidc");
  expect(() => publicationAuth(200, { ...candidate, token: "test-secret" })).toThrow("refused");
  for (const status of [401, 403, 429, 500])
    expect(() => publicationAuth(status, candidate)).toThrow("Registry lookup failed");
  for (const patch of [{ version: "0.2.0" }, { channel: "beta" }, { bootstrapToken: "" }])
    expect(() => publicationAuth(404, { ...candidate, ...patch })).toThrow("bootstrap requires");
});

// Owner: publication boundary; processing is bounded and immutable retries require matching provenance.
test("publication waits through processing and verifies both new and existing versions", async () => {
  // @ts-expect-error Release tooling runs as native ESM.
  const verification = await import("../../../scripts/verify-publication.mjs");
  const { waitForPublication, verifyAttestation } = verification;
  const commit = "a".repeat(40);
  const digest = "b".repeat(128);
  const integrity = `sha512-${Buffer.from(digest, "hex").toString("base64")}`;
  const entry = { dist: { integrity, attestations: { provenance: {} } } };
  const statement = {
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [{ digest: { sha512: digest } }],
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            repository: "https://github.com/compozy/proto",
            path: ".github/workflows/release.yml",
            ref: "refs/heads/main",
          },
        },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/compozy/proto@refs/heads/main",
            digest: { gitCommit: commit },
          },
        ],
      },
    },
  };
  const document = () => ({
    attestations: [
      {
        predicateType: statement.predicateType,
        bundle: {
          dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString("base64") },
        },
      },
    ],
  });
  for (const candidate of [integrity, undefined]) {
    let clock = 0;
    const waits: number[] = [];
    await waitForPublication({
      endpoint: "registry",
      version: "0.1.0",
      tag: "latest",
      integrity: candidate,
      commit,
      now: () => clock,
      log: () => {},
      sleep: async (ms: number) => {
        waits.push(ms);
        clock += ms;
      },
      fetcher: async (url: string) =>
        new Response(
          JSON.stringify(
            url === "registry"
              ? clock < 160000
                ? {}
                : { versions: { "0.1.0": entry }, "dist-tags": { latest: "0.1.0" } }
              : document()
          )
        ),
    });
    expect(clock).toBeGreaterThanOrEqual(160000);
    expect(clock).toBeLessThanOrEqual(600000);
    expect(waits.slice(0, 4)).toEqual([5000, 10000, 20000, 40000]);
  }
  expect(() => verifyAttestation(document(), entry, "c".repeat(40))).toThrow("provenance");
  expect(() => verifyAttestation(document(), { dist: { integrity: "wrong" } }, commit)).toThrow(
    "provenance"
  );
  for (const field of ["repository", "path", "ref"] as const) {
    const original = statement.predicate.buildDefinition.externalParameters.workflow[field];
    statement.predicate.buildDefinition.externalParameters.workflow[field] = "wrong";
    expect(() => verifyAttestation(document(), entry, commit)).toThrow("provenance");
    statement.predicate.buildDefinition.externalParameters.workflow[field] = original;
  }
  let clock = 0;
  await expect(
    waitForPublication({
      endpoint: "registry",
      version: "0.1.0",
      tag: "latest",
      commit,
      timeoutMs: 12000,
      now: () => clock,
      log: () => {},
      sleep: async (ms: number) => {
        clock += ms;
      },
      fetcher: async () => new Response("{}"),
    })
  ).rejects.toThrow("deadline");
  expect(clock).toBe(12000);
});
