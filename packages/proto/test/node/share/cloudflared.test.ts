import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cloudflaredAssets,
  locateCloudflared,
  spawnCloudflared,
} from "../../../src/share/cloudflared.ts";
import { cloudflaredStub } from "./cloudflared-stub.ts";

// Invariant owner: binary acquisition and process I/O. Canonical suite: node/share.
const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "proto-cloudflared-"));
  directories.push(path);
  return path;
}
// Invariant: the pinned archive integrity contract uses archive digests, before extraction.
// Owner: binary acquisition; release metadata checked with GitHub's release-assets API.
it("OPUS-B01/UT-012: macOS pins identify the published 2026.10.5 archives", () => {
  expect(cloudflaredAssets["darwin-x64"]).toEqual({
    name: "cloudflared-darwin-amd64.tgz",
    sha256: "6699392fed92367808c248c2d90bed66e49bbf66e1b4ee3e4141230f3f7391b3",
  });
  expect(cloudflaredAssets["darwin-arm64"]).toEqual({
    name: "cloudflared-darwin-arm64.tgz",
    sha256: "184c7d4f5f977348243a6d7ca8f6cf6073b9b2746cfe8c1fe15aa59e9a522bf0",
  });
});
it("UT-012: a supported PATH binary wins; an older binary selects the pinned download", async () => {
  const path = await directory();
  const cache = await directory();
  const binary = await cloudflaredStub(join(path, "cloudflared"));
  expect(await locateCloudflared({ path, cache })).toBe(binary);
  await cloudflaredStub(binary, "2025.12.9");
  let requested = "";
  await expect(
    locateCloudflared({
      path,
      cache,
      platform: "linux",
      arch: "x64",
      fetch: async input => {
        requested = String(input);
        return new Response("not the official asset");
      },
    })
  ).rejects.toMatchObject({ code: "cloudflared_unavailable" });
  expect(requested).toContain("/2026.10.5/cloudflared-linux-amd64");
});
// Invariant: acquisition failures preserve their cause and exit code, and clean temporary files.
// Owner/canonical suite: binary acquisition, node/share/cloudflared.
it("UT-013: failed download reports its HTTP status and leaves no temporary file", async () => {
  const cache = await directory();
  await expect(
    locateCloudflared({
      path: "",
      cache,
      platform: "linux",
      arch: "x64",
      fetch: async () => new Response(null, { status: 503 }),
    })
  ).rejects.toMatchObject({
    code: "cloudflared_unavailable",
    exit: 3,
    message: "Download failed: HTTP 503. Install cloudflared and retry.",
  });
  expect(await readdir(cache)).toEqual([]);
});
it("UT-013: checksum mismatch reports its cause and leaves no downloaded executable or temporary file", async () => {
  const cache = await directory();
  await expect(
    locateCloudflared({
      path: "",
      cache,
      platform: "darwin",
      arch: "arm64",
      fetch: async () => new Response("wrong archive"),
    })
  ).rejects.toMatchObject({
    code: "cloudflared_unavailable",
    exit: 3,
    message: "Checksum mismatch. Install cloudflared and retry.",
  });
  expect(await readdir(cache)).toEqual([]);
});
it("sentinel lifetime: closing the parent pipe terminates its connector", async () => {
  const path = await directory();
  const binary = await cloudflaredStub(join(path, "cloudflared"));
  const report = join(path, "report.json");
  vi.stubEnv("PROTO_STUB_REPORT", report);
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "account-secret");
  const connector = await spawnCloudflared(binary, "tunnel-secret");
  expect(connector.pid).toBeGreaterThan(0);
  await expect
    .poll(async () => JSON.parse(await readFile(report, "utf8")))
    .toMatchObject({
      pid: connector.pid,
      hasApiToken: false,
      argv: ["tunnel", "--no-autoupdate", "--metrics", "127.0.0.1:0", "run"],
    });
  expect(await readFile(report, "utf8")).not.toContain("tunnel-secret");
  await connector.close();
  expect(() => process.kill(connector.pid, 0)).toThrow();
});
