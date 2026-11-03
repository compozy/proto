import { afterEach, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { locateCloudflared, spawnCloudflared } from "../../../src/share/cloudflared.ts";
import { cloudflaredStub } from "./cloudflared-stub.ts";

// Invariant owner: binary acquisition and process I/O. Canonical suite: node/share.
const directories: string[] = [];
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });
async function directory() { const path = await mkdtemp(join(tmpdir(), "proto-cloudflared-")); directories.push(path); return path; }
it("UT-012: a supported PATH binary wins; an older binary selects the pinned download", async () => {
  const path = await directory(); const cache = await directory();
  const binary = await cloudflaredStub(join(path, "cloudflared"));
  expect(await locateCloudflared({ path, cache })).toBe(binary);
  await cloudflaredStub(binary, "2025.12.9");
  let requested = "";
  await expect(locateCloudflared({ path, cache, platform: "linux", arch: "x64", fetch: async input => {
    requested = String(input); return new Response("not the official asset");
  } })).rejects.toMatchObject({ code: "cloudflared_unavailable" });
  expect(requested).toContain("/2026.10.5/cloudflared-linux-amd64");
});
it("UT-013: checksum mismatch leaves no downloaded executable or temporary file", async () => {
  const cache = await directory();
  await expect(locateCloudflared({ path: "", cache, platform: "darwin", arch: "arm64", fetch: async () => new Response("wrong archive") })).rejects.toMatchObject({ code: "cloudflared_unavailable" });
  expect(await readdir(cache)).toEqual([]);
});
it("sentinel lifetime: closing the parent pipe terminates its connector", async () => {
  const path = await directory();
  const binary = await cloudflaredStub(join(path, "cloudflared"));
  const connector = await spawnCloudflared(binary, "tunnel-secret");
  expect(connector.pid).toBeGreaterThan(0);
  await connector.close();
  expect(() => process.kill(connector.pid, 0)).toThrow();
});
