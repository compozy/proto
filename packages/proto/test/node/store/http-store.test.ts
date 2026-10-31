import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HttpStore, remoteUrl } from "../../../src/store/http-store.ts";
import { httpContract } from "../server/harness.ts";
import { runStoreContract, input, png, agent, reviewer } from "./contract.ts";
import { runCli } from "../../../src/cli/main.ts";
import { loadProject } from "../../../src/node/project.ts";
import { executeTool } from "../../../src/mcp.ts";
// I/O boundary only: give the credential file a disposable home; storage/network remain real.
const home = vi.hoisted(() => ({ path: "" }));
vi.mock("node:os", async importOriginal => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => home.path,
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
// Invariants: bearer transport, redirect policy and local credentials. Owner: HttpStore/CLI.
describe("IT-022: HttpStore + fileStorage with session administrative setup", () => {
  runStoreContract(() => httpContract(undefined, true));
});
it("UT-079: HTTPS is required outside literal loopback addresses", () => {
  for (const url of [
    "http://proto.acme.com",
    "http://127.0.0.1.evil.test",
    "https://user:secret@example.com",
  ])
    expect(() => remoteUrl(url)).toThrowError(expect.objectContaining({ code: "insecure_remote" }));
  for (const url of [
    "http://127.0.0.1:8787",
    "http://[::1]:8787",
    "http://localhost:8787",
    "https://acme.com/proto/",
  ])
    expect(() => remoteUrl(url)).not.toThrow();
});
it("UT-080: a redirect never receives a second credential-bearing request", async () => {
  let targetRequests = 0,
    firstAuthorization = "";
  const server = createServer((req, res) => {
    if (req.url === "/redirected") {
      targetRequests++;
      res.end("bad");
      return;
    }
    firstAuthorization = req.headers.authorization ?? "";
    res.writeHead(302, { location: "/redirected" });
    res.end();
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    await expect(
      new HttpStore({ url, token: `pcr_${"a".repeat(64)}` }).list()
    ).rejects.toMatchObject({ code: "redirect_refused" });
    expect(targetRequests).toBe(0);
    expect(firstAuthorization).toMatch(/^Bearer pcr_/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
it("IT-025: login/logout persist mode 0600 and never print a token", async () => {
  const h = await httpContract();
  home.path = await mkdtemp(join(tmpdir(), "proto-auth-"));
  const output: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    output.push(args.join(" "));
  });
  const url = h.client.url.href;
  try {
    const login = await runCli(["auth", "login", "--remote", url], {
      readToken: async () => h.harness.credential.token,
    });
    expect(login.exitCode).toBe(0);
    const path = join(home.path, ".config/compozy-proto/credentials.json");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(path, "utf8"))[new URL(url).origin].token).toBe(
      h.harness.credential.token
    );
    const listed = await runCli(["auth", "credentials", "--json"]);
    expect(listed.data).toMatchObject({
      credentials: [{ id: h.harness.credential.credential.id, scopes: ["comment"] }],
    });
    expect(JSON.stringify([login, listed, ...output])).not.toContain(h.harness.credential.token);
    vi.stubEnv("PROTO_REMOTE_URL", url);
    vi.stubEnv("PROTO_REMOTE_TOKEN", undefined);
    const project = await loadProject(resolve(import.meta.dirname, "../../../../../apps/app"));
    expect(await project.store({ remote: true }).list()).toEqual([]);
    expect(
      (await runCli(["auth", "revoke", h.harness.credential.credential.id, "--remote", url]))
        .exitCode
    ).toBe(4);
    expect((await runCli(["auth", "logout", "--remote", url])).exitCode).toBe(0);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({});
  } finally {
    await h.dispose();
    await rm(home.path, { recursive: true, force: true });
  }
});
// Multiple real CLI subprocesses plus MCP/network round trips need headroom on a 2-core CI runner.
it("IT-022 / E2E-012: real CLI and MCP use bearer authority and equal JSON", async () => {
  const h = await httpContract();
  try {
    const c = await h.store.add("login-form", input, reviewer);
    const env = {
      ...process.env,
      PROTO_REMOTE_URL: h.client.url.href,
      PROTO_REMOTE_TOKEN: h.harness.credential.token,
    };
    const cli = async (args: string[]) =>
      promisify(execFile)(
        "bun",
        [
          resolve(import.meta.dirname, "../../../src/cli/main.ts"),
          ...args,
          "--app",
          resolve(import.meta.dirname, "../../../../../apps/app"),
          "--json",
        ],
        { env }
      );
    const listed = JSON.parse((await cli(["comments", "list", "--remote"])).stdout);
    expect(listed.comments[0].id).toBe(c.id);
    const replied = JSON.parse(
      (
        await cli([
          "comments",
          "reply",
          c.id,
          "--remote",
          "--note",
          "Fixed",
          "--author",
          "reviewer",
        ])
      ).stdout
    );
    expect(replied.comment.thread.at(-1)).toMatchObject({ author: "agent", authorId: "agent-id" });
    await expect(cli(["review", "approve", "login-form", "--remote"])).rejects.toMatchObject({
      code: 4,
      stdout: expect.stringContaining("scope_denied"),
    });
    vi.stubEnv("PROTO_REMOTE_URL", h.client.url.href);
    vi.stubEnv("PROTO_REMOTE_TOKEN", h.harness.credential.token);
    const project = await loadProject(resolve(import.meta.dirname, "../../../../../apps/app"));
    expect(await executeTool("proto_comments_list", { remote: true }, project)).toEqual(
      JSON.parse((await cli(["comments", "list", "--remote"])).stdout)
    );
    const own = await h.client.add("login-form", input, reviewer);
    expect(own.thread[0].author).toBe("agent");
    const pending = await h.client.upload("login-form", { name: "shot.png", bytes: png }, reviewer);
    await h.client.editMessage(own.id, own.thread[0].id, { attach: [pending.id] }, agent);
    expect((await h.client.readAttachment("login-form", pending.id)).bytes).toEqual(png);
    await expect(h.client.remove(own.id, reviewer)).rejects.toMatchObject({ code: "scope_denied" });
  } finally {
    await h.dispose();
  }
}, 30_000);
