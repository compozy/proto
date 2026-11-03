// IT-LIVE-001 owns provider conformance. This opt-in suite creates real resources and removes them.
// Manual email login, cookie scope and expiry observations are recorded using docs/proto/share.md.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { CloudflareClient } from "../../../src/share/cloudflare.ts";
import { disconnect } from "../../../src/share/connection.ts";
import { stopShare, runningShare, type ShareSummary } from "../../../src/share/session.ts";
import { runCli, type CliResult } from "../../../src/cli/main.ts";
import { loadProject } from "../../../src/node/project.ts";

it.skipIf(!process.env.PROTO_TEST_CLOUDFLARE_TOKEN)("IT-LIVE-001: real Access fronts this origin; stop and disconnect revoke access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "proto-share-live-"));
  const path = join(directory, "cloudflare.json");
  const apiToken = process.env.PROTO_TEST_CLOUDFLARE_TOKEN!;
  const client = new CloudflareClient(apiToken);
  const project = await loadProject(process.env.PROTO_TEST_CLOUDFLARE_APP ?? resolve(import.meta.dirname, "../../../../../apps/app"));
  const slug = process.env.PROTO_TEST_CLOUDFLARE_SLUG ?? (await project.registry()).prototypes[0]!.slug;
  const runtime = { client, connectionPath: path, path: join(directory, "share-session.json") };
  const cli = (args: string[]) => runCli(["share", ...args, "--json"], {
    cwd: project.root, project, share: runtime, readToken: async () => apiToken,
  });
  let completion: CliResult["completion"];
  try {
    const connected = await cli(["connect", "--name", process.env.PROTO_TEST_CLOUDFLARE_NAME ?? `proto-live-${randomBytes(5).toString("hex")}`,
      ...(process.env.PROTO_TEST_CLOUDFLARE_DOMAIN ? ["--domain", process.env.PROTO_TEST_CLOUDFLARE_DOMAIN] : []),
    ]);
    expect(connected.exitCode).toBe(0);
    const started = await cli(["--slug", slug, "--commenter", process.env.PROTO_TEST_CLOUDFLARE_EMAIL ?? "review@example.com"]);
    expect(started.exitCode).toBe(0);
    completion = started.completion;
    const summary = started.data as ShareSummary;
    const login = await fetch(summary.link, { redirect: "manual" });
    expect(login.status).toBe(302);
    expect(new URL(login.headers.get("location")!).hostname).toContain("cloudflareaccess.com");
    await login.body?.cancel();
    // Optional operator-supplied Access assertion exercises the real proxy's idle-stream lifetime.
    const assertion = process.env.PROTO_TEST_CLOUDFLARE_JWT;
    if (assertion) {
      const stream = await fetch(`${new URL(summary.link).origin}/api/events`, { headers: { "Cf-Access-Jwt-Assertion": assertion }, redirect: "manual" });
      expect(stream.status).toBe(200);
      const reader = stream.body!.getReader();
      const deadline = Date.now() + 151_000;
      try {
        while (Date.now() < deadline) {
          const part = await reader.read();
          expect(part.done).toBe(false);
        }
      } finally { await reader.cancel(); }
    }
    expect((await cli(["stop"])).exitCode).toBe(0);
    await completion;
    const denied = await fetch(summary.link, { redirect: "manual" });
    expect(denied.status).not.toBe(200);
    await denied.body?.cancel();
    const result = await cli(["disconnect"]);
    expect(result).toMatchObject({ exitCode: 0, data: { kept: ["otp_provider"] } });
  } finally {
    if (await runningShare(runtime)) await stopShare(runtime);
    await completion;
    await disconnect({ path, client });
    await rm(directory, { recursive: true, force: true });
  }
}, 300_000);
