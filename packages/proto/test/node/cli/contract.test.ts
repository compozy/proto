import { appFixture } from "../app-fixture.ts";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  cpSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { runCli } from "../../../src/cli/main.ts";
import { loadProject, type ProtoProject } from "../../../src/node/project.ts";
import { FileStore } from "../../../src/store/index.ts";
import { chromium, type BrowserServer } from "playwright";
import { existsSync } from "node:fs";
import { freePortPair } from "../ports.ts";

// Owner: CLI contracts. Each command sequence owns its files, cache and port pair;
// only the real Chromium process is shared through independent CDP connections.
// Seed the login/welcome journey used by these contracts; unrelated evolving app drafts
// belong to app adoption coverage, not every CLI command fixture.
describe("CLI contracts", { timeout: 30000 }, () => {
  const timestamp = "2026-10-30T22:41:03.000Z";
  const app = resolve(import.meta.dirname, "../../../../../apps/app");
  let root: string;
  let project: ProtoProject;
  let store: FileStore;
  let uuid = 0;
  let browserServer: BrowserServer | undefined;
  beforeAll(async () => {
    if (existsSync(chromium.executablePath())) browserServer = await chromium.launchServer();
  }, 60000);
  afterAll(async () => {
    await browserServer?.close();
  }, 30000);
  beforeEach(async () => {
    uuid = 0;
    root = appFixture("proto-cli-test-");
    for (const path of [
      "proto.config.ts",
      "proto.canvas.tsx",
      "vite.config.ts",
      "vite.shared.ts",
      "src/components",
      "src/drafts/welcome",
      "src/styles.css",
      "flows",
    ]) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      cpSync(join(app, path), join(root, path), { recursive: true });
    }
    const viteConfig = join(root, "vite.config.ts");
    writeFileSync(
      viteConfig,
      readFileSync(viteConfig, "utf8").replace(
        "defineConfig({ plugins:",
        'defineConfig({ cacheDir: ".vite", plugins:'
      )
    );
    execFileSync("git", ["init", "-q", root]);
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=Proto Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "--allow-empty",
        "-qm",
        "fixture",
      ],
      { env: { ...process.env, GIT_AUTHOR_DATE: timestamp, GIT_COMMITTER_DATE: timestamp } }
    );
    vi.spyOn(crypto, "randomUUID").mockImplementation(
      () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`
    );
    project = await loadProject(root);
    store = new FileStore({
      root,
      registry: () => project.registry(),
      clock: () => new Date(timestamp),
    });
    project.config.dev.port = await freePortPair();
    const actualProject = project;
    project = {
      ...project,
      store: options => (options?.remote ? actualProject.store(options) : store),
    };
  }, 60000);
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });
  const cli = (...args: string[]) => runCli([...args, "--json"], { cwd: root, project });
  // CLI/MCP owns one public result per capability, exercised through the SDK and real adapters.
  it("IT-015: every MCP capability returns the CLI JSON result", async () => {
    const { catalog } = await import("../../../src/capabilities/catalog.ts");
    const { createMcpServer } = await import("../../../src/mcp.ts");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { input, agent, png } = await import("../store/contract.ts");
    const image = await store.upload("login-form", { name: "shot.png", bytes: png }, agent);
    const comment = await store.add("login-form", { ...input, attachments: [image.id] }, agent);
    writeFileSync(join(root, "shot.png"), png);
    const baseline = join(root, "baseline-review");
    cpSync(join(root, "proto/review"), baseline, { recursive: true });
    const baseUuid = uuid;
    const flow = (await project.registry()).flows[0]!.id;
    const cases: Record<string, Record<string, string | boolean>> = {
      list: {},
      check: {},
      url: { slug: "login-form" },
      "flow list": {},
      "flow show": { id: flow },
      "flow coverage": {},
      new: { slug: "parity-draft", draft: true },
      "flow new": { slug: "parity-flow", spec: "auth" },
      "comments list": {},
      "comments show": { id: comment.id },
      "comments add": { slug: "login-form", selector: "#error", note: "Parity" },
      "comments reply": { id: comment.id, note: "Parity" },
      "comments resolve": { id: comment.id, note: "Parity" },
      "comments reopen": { id: comment.id, note: "Parity" },
      "comments edit": { id: comment.id, note: "Parity" },
      "comments attach": { id: comment.id, file: "shot.png" },
      "comments detach": { id: comment.id, attachment: image.id },
      "comments attachments": { id: comment.id },
      "comments delete": { id: comment.id },
      "review status": { key: "login-form" },
      screenshot: { slug: "login-form", state: "error" },
      evidence: { slug: "login-form", state: "error" },
    };
    const server = await createMcpServer(project);
    const client = new Client({ name: "all-capabilities", version: "1" });
    const [left, right] = InMemoryTransport.createLinkedPair();
    const launcher = vi
      .spyOn(chromium, "launch")
      .mockImplementation(() => chromium.connect(browserServer!.wsEndpoint()));
    const reset = () => {
      rmSync(join(root, "proto/review"), { recursive: true, force: true });
      cpSync(baseline, join(root, "proto/review"), { recursive: true });
      uuid = baseUuid;
    };
    try {
      await Promise.all([server.connect(left), client.connect(right)]);
      expect(Object.keys(cases).sort()).toEqual(
        catalog
          .filter(c => c.mcp)
          .map(c => c.cli)
          .sort()
      );
      for (const capability of catalog.filter(c => c.mcp)) {
        reset();
        const args = cases[capability.cli]!;
        const argv = [
          ...capability.cli.split(" "),
          ...capability.positionals.flatMap(name =>
            args[name] === undefined ? [] : [String(args[name])]
          ),
          ...Object.entries(args)
            .filter(([key]) => !capability.positionals.includes(key))
            .flatMap(([key, value]) =>
              typeof value === "boolean" ? ["--" + key] : ["--" + key, String(value)]
            ),
        ];
        const cliResult = await cli(...argv);
        expect(cliResult.exitCode, capability.cli).toBe(0);
        const created = (cliResult.data as { file?: string }).file;
        if (created) rmSync(join(root, created));
        reset();
        const result = await client.callTool({ name: capability.mcp!, arguments: args });
        expect(result.isError, capability.cli).not.toBe(true);
        expect(JSON.parse((result.content as { text: string }[])[0]!.text), capability.cli).toEqual(
          cliResult.data
        );
        if (created) rmSync(join(root, created));
      }
    } finally {
      launcher.mockRestore();
      await client.close();
      await server.close();
    }
  }, 180000);
  it("UT-048 list JSON has the documented projection", async () => {
    const result = await cli("list");
    expect(result.exitCode).toBe(0);
    expect(result.data).toMatchObject({
      prototypes: expect.arrayContaining([
        expect.objectContaining({ slug: "login-form", states: expect.any(Array) }),
      ]),
      flows: expect.arrayContaining([expect.objectContaining({ steps: expect.any(Number) })]),
    });
    expect(JSON.stringify(result.data)).not.toContain('"blocks"');
  });
  it("UT-050 unknown command returns usage exit 2", async () =>
    expect((await cli("unknown")).exitCode).toBe(2));
  it("UT-051 missing comment preserves registered error and exit", async () =>
    expect(await cli("comments", "show", "login-form-99")).toMatchObject({
      exitCode: 1,
      data: { error: { code: "comment_not_found" } },
    }));
  it("IT-014 comment operations share the seeded store contract", async () => {
    const add = await cli(
      "comments",
      "add",
      "login-form",
      "--state",
      "error",
      "--selector",
      "#error",
      "--note",
      "Initial"
    );
    expect(add).toMatchObject({
      exitCode: 0,
      data: {
        comment: {
          id: "login-form-1",
          status: "open",
          thread: [expect.objectContaining({ body: "Initial", author: "agent" })],
        },
      },
    });
    const id = "login-form-1";
    for (const args of [
      ["show", id],
      ["reply", id, "--note", "Reply"],
      ["edit", id, "--note", "Edited"],
      ["resolve", id, "--note", "Fixed"],
      ["reopen", id, "--note", "Again"],
      ["list", "--waiting"],
      ["attachments", id],
    ]) {
      const result = await cli("comments", ...args);
      expect(result.exitCode).toBe(0);
      if (args[0] === "list") expect(result.data).toMatchObject({ comments: expect.any(Array) });
      else if (args[0] === "attachments") expect(result.data).toEqual({ files: [] });
      else {
        const expected = {
          id,
          status: args[0] === "resolve" ? "resolved" : "open",
          thread: expect.any(Array),
        };
        expect(result.data).toMatchObject(args[0] === "show" ? expected : { comment: expected });
      }
    }
    expect((await cli("review", "status", "login-form")).data).toMatchObject({
      key: "login-form",
      open: 1,
    });
    expect((await cli("review", "approve", "login-form", "--confirm-open")).data).toMatchObject({
      review: { key: "login-form", status: "approved", open: 1, events: expect.any(Array) },
    });
    expect((await cli("review", "reopen", "login-form")).data).toMatchObject({
      review: { key: "login-form", status: "in_review", open: 1, events: expect.any(Array) },
    });
    expect((await cli("comments", "delete", id)).data).toEqual({ deleted: id });
  });
  it("UT-098 unlock requires force and reports the removed owner", async () => {
    await store.ready();
    const lock = join(root, "proto/review/login-form.lock");
    mkdirSync(lock, { recursive: true });
    writeFileSync(
      join(lock, "owner.json"),
      JSON.stringify({
        token: "foreign",
        hostId: "another-host",
        pid: 81233,
        processStartedAt: "yesterday",
      })
    );
    expect((await cli("review", "unlock", "login-form")).exitCode).toBe(2);
    expect((await cli("review", "unlock", "login-form", "--force")).data).toEqual({
      removedOwner: { hostId: "another-host", pid: 81233 },
    });
  });
  it("UT-045 draft scaffold and UT-047 duplicate slug", async () => {
    expect(await cli("new", "review-digest", "--draft")).toMatchObject({
      exitCode: 0,
      data: {
        file: "src/drafts/review-digest/index.proto.tsx",
        slug: "review-digest",
        url: expect.stringContaining("p=review-digest"),
      },
    });
    expect(await cli("new", "review-digest", "--draft")).toMatchObject({
      exitCode: 1,
      data: { error: { code: "slug_taken" } },
    });
  });
  it("UT-046 component scaffold composes the view", async () => {
    writeFileSync(join(root, "src/example.tsx"), "export function Example(){return <div/>;}");
    expect((await cli("new", "--in", "src/example.tsx")).exitCode).toBe(0);
    expect(readFileSync(join(root, "src/example.proto.tsx"), "utf8")).toContain("<Example />");
  });
  it("UT-049 check exits one on problems and zero on warnings", async () => {
    writeFileSync(join(root, "src/broken.proto.tsx"), "export const meta = compute();");
    expect((await cli("check")).exitCode).toBe(1);
    rmSync(join(root, "src/broken.proto.tsx"));
    const specs = project.config.specs;
    project.config.specs = null;
    try {
      const warnings = await cli("check");
      expect(warnings.exitCode).toBe(0);
      expect(warnings.data).toMatchObject({
        warnings: expect.arrayContaining([expect.objectContaining({ code: "specs_unavailable" })]),
      });
    } finally {
      project.config.specs = specs;
    }
  }, 120000);
  it("IT-014 flow and URL JSON operations", async () => {
    expect(await cli("flow", "new", "created", "--spec", "auth")).toMatchObject({
      exitCode: 0,
      data: { file: "flows/created.flow.ts", slug: "created", url: expect.any(String) },
    });
    expect((await cli("flow", "list")).data).toMatchObject({
      flows: expect.arrayContaining([
        expect.objectContaining({
          id: "created",
          nodes: expect.any(Array),
          edges: expect.any(Array),
        }),
      ]),
    });
    expect((await cli("flow", "show", "created")).data).toMatchObject({
      id: "created",
      title: "created",
      steps: expect.any(Array),
      edges: expect.any(Array),
      problems: [],
      warnings: expect.any(Array),
    });
    expect((await cli("flow", "coverage")).data).toMatchObject({ uncovered: expect.any(Array) });
    expect((await cli("url", "login-form", "--bare", "--state", "error")).data).toMatchObject({
      url: expect.stringContaining("/__proto/render/login-form"),
    });
  });
  it("UT-040 UT-041 UT-043 IT-010 init writes the integration and checks it", async () => {
    const fresh = appFixture("proto-init-test-");
    try {
      // Its own repository: the skills land at this fixture's Git top level, not this checkout's.
      execFileSync("git", ["init", "-q", fresh]);
      writeFileSync(
        join(fresh, "vite.config.ts"),
        'import react from "@vitejs/plugin-react"; export default {cacheDir:".vite",plugins:[react()]};'
      );
      const init = await runCli(["init", "--skills", "--json"], { cwd: fresh });
      expect(init.exitCode).toBe(0);
      expect((init.data as { files: string[] }).files).toEqual(
        expect.arrayContaining([
          "proto.config.ts",
          "proto.canvas.tsx",
          "src/drafts/welcome/index.proto.tsx",
          "vite.config.ts",
          "docs/design/prototyping.md",
        ])
      );
      expect(readFileSync(join(fresh, "docs/design/prototyping.md"), "utf8")).toContain(
        "target: library"
      );
      const guide = readFileSync(join(fresh, "docs/design/prototyping.md"), "utf8");
      expect(guide).toContain('preview: "http://127.0.0.1:4401/__proto/render/{slug}?chrome=0"');
      expect(guide).toContain('evidence: "proto evidence {slug} --state <id>"');
      expect(guide).toContain('output: "docs/design/{slug}/"');
      expect(readFileSync(join(fresh, "vite.config.ts"), "utf8")).toContain("proto()");
      expect((await runCli(["init", "--json"], { cwd: fresh })).data).toMatchObject({
        skipped: true,
      });
      expect((await runCli(["init", "--force", "--json"], { cwd: fresh })).data).toMatchObject({
        skipped: false,
      });
      expect((await runCli(["check", "--json"], { cwd: fresh })).exitCode).toBe(0);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  }, 120000);
  // Invariant: `init --skills` makes every shipped skill an exact copy under the repository root's
  // `.agents/skills`, also in an app that is already set up, and reports 0.1.x copies without
  // deleting them. Owner: CLI contracts (installer).
  it("US-001 init --skills syncs the shipped skills at the repository root", async () => {
    const repo = appFixture("proto-skills-test-");
    try {
      execFileSync("git", ["init", "-q", repo]);
      const app = join(repo, "apps/web");
      mkdirSync(app, { recursive: true });
      writeFileSync(join(app, "vite.config.ts"), "export default { plugins: [] };");
      const installed = join(repo, ".agents/skills");
      mkdirSync(join(installed, "author-prototype"), { recursive: true });
      writeFileSync(join(installed, "author-prototype/SKILL.md"), "0.1.x copy");
      mkdirSync(join(installed, "proto/references"), { recursive: true });
      writeFileSync(join(installed, "proto/SKILL.md"), "stale copy");
      writeFileSync(join(installed, "proto/references/removed.md"), "stale copy");
      mkdirSync(join(repo, ".claude/skills"), { recursive: true });
      symlinkSync(
        "../../.agents/skills/apply-prototype-comments",
        join(repo, ".claude/skills/apply-prototype-comments")
      );

      const first = await runCli(["init", "--skills", "--json"], { cwd: app });
      expect(first).toMatchObject({ exitCode: 0, data: { skipped: false } });
      expect(first.data).toMatchObject({
        skills: [
          { name: "proto", path: "../../.agents/skills/proto", status: "updated" },
          {
            name: "proto-apply-comments",
            path: "../../.agents/skills/proto-apply-comments",
            status: "installed",
          },
        ],
        legacySkills: [
          {
            name: "author-prototype",
            path: "../../.agents/skills/author-prototype",
            replacedBy: "proto",
          },
          {
            name: "apply-prototype-comments",
            path: "../../.claude/skills/apply-prototype-comments",
            replacedBy: "proto-apply-comments",
          },
        ],
      });
      const shipped = resolve(import.meta.dirname, "../../../skills");
      const files = (dir: string) =>
        readdirSync(dir, { recursive: true, encoding: "utf8" })
          .filter(file => statSync(join(dir, file)).isFile())
          .sort();
      for (const name of ["proto", "proto-apply-comments"]) {
        expect(files(join(installed, name))).toEqual(files(join(shipped, name)));
        for (const file of files(join(shipped, name)))
          expect(readFileSync(join(installed, name, file))).toEqual(
            readFileSync(join(shipped, name, file))
          );
      }
      expect(readFileSync(join(installed, "author-prototype/SKILL.md"), "utf8")).toBe("0.1.x copy");

      writeFileSync(join(app, "proto.config.ts"), 'export default { title: "Kept" };\n');
      const again = await runCli(["init", "--skills", "--json"], { cwd: app });
      expect(again).toMatchObject({
        exitCode: 0,
        data: {
          skipped: true,
          files: [],
          skills: [{ status: "unchanged" }, { status: "unchanged" }],
        },
      });
      expect(readFileSync(join(app, "proto.config.ts"), "utf8")).toBe(
        'export default { title: "Kept" };\n'
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
  it("UT-042 init outside a Vite app fails clearly", async () => {
    const empty = appFixture("proto-empty-test-");
    try {
      expect(
        await runCli(["init", "--json"], { cwd: empty, project: { ...project, root: empty } })
      ).toMatchObject({ exitCode: 1, data: { error: { code: "not_a_vite_app" } } });
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
  it("IT-014 image attachment, detach and download use the store boundary", async () => {
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=",
      "base64"
    );
    writeFileSync(join(root, "shot.png"), bytes);
    const added = await cli(
      "comments",
      "add",
      "login-form",
      "--selector",
      "#error",
      "--note",
      "Image"
    );
    const id = (added.data as { comment: { id: string } }).comment.id;
    const attached = await cli("comments", "attach", id, "shot.png");
    expect(attached.exitCode).toBe(0);
    const attachmentId = (
      attached.data as { comment: { thread: { attachments: { id: string }[] }[] } }
    ).comment.thread[0]!.attachments[0]!.id;
    expect((await cli("comments", "attachments", id)).data).toEqual({
      files: [`.tmp/proto/${id}/${attachmentId}.png`],
    });
    expect((await cli("comments", "detach", id, attachmentId)).exitCode).toBe(0);
  });
  it("remote approval is denied and an unconfigured remote requires authentication", async () => {
    expect(await cli("review", "approve", "login-form", "--remote")).toMatchObject({
      exitCode: 4,
      data: { error: { code: "scope_denied" } },
    });
    expect(await cli("comments", "list", "--remote")).toMatchObject({
      exitCode: 4,
      data: { error: { code: "auth_required" } },
    });
  });
  it("UT-054 a missing Chromium launcher gives exit 3", async () => {
    const { vi } = await import("vitest");
    const { chromium } = await import("playwright");
    const spy = vi.spyOn(chromium, "launch").mockRejectedValueOnce(Error("Executable missing"));
    try {
      expect(await cli("screenshot", "login-form")).toMatchObject({
        exitCode: 3,
        data: { error: { code: "playwright_missing" } },
      });
    } finally {
      spy.mockRestore();
    }
  });
  it("E2E-011: a real CLI agent loop records evidence, replies and resolves", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const config = join(root, "proto.config.ts");
    writeFileSync(
      config,
      readFileSync(config, "utf8").replace(
        "defineProtoConfig({",
        `defineProtoConfig({dev:{port:${project.config.dev.port}},`
      )
    );
    const run = async (...args: string[]) =>
      JSON.parse(
        (
          await promisify(execFile)(
            "bun",
            [
              resolve(import.meta.dirname, "../../../src/cli/main.ts"),
              ...args,
              "--app",
              root,
              "--json",
            ],
            { timeout: 90000 }
          )
        ).stdout
      );
    const added = await run(
      "comments",
      "add",
      "login-form",
      "--state",
      "error",
      "--selector",
      "#error",
      "--note",
      "Improve the sign-in wording",
      "--author",
      "reviewer"
    );
    expect(
      (await run("list")).prototypes.some((p: { slug: string }) => p.slug === "login-form")
    ).toBe(true);
    expect((await run("comments", "list")).comments.map((c: { id: string }) => c.id)).toContain(
      added.comment.id
    );
    const source = join(root, "src/components/login-form.tsx");
    writeFileSync(
      source,
      readFileSync(source, "utf8").replaceAll('"Sign in"', '"Sign in securely"')
    );
    const shot = await run("screenshot", "login-form", "--state", "error");
    expect(shot).toMatchObject({
      path: "docs/design/login-form/error--light--1440.png",
      width: 1440,
    });
    const evidence = await run("evidence", "login-form", "--state", "error");
    expect(readFileSync(join(root, evidence.path), "utf8")).toContain("Sign in securely");
    const record = join(root, "docs/design/login-form/review.md");
    writeFileSync(record, `# Review\n\nUpdated sign-in wording. [Evidence](./index.html)\n`);
    expect(readFileSync(record, "utf8")).toContain("[Evidence](./index.html)");
    const reply = await run(
      "comments",
      "reply",
      added.comment.id,
      "--note",
      `Updated wording. Evidence: ${evidence.path}`
    );
    expect(reply.comment.thread.at(-1)).toMatchObject({
      author: "agent",
      body: expect.stringContaining(evidence.path),
    });
    expect((await run("comments", "resolve", added.comment.id)).comment.status).toBe("resolved");
    expect((await run("comments", "list")).comments).toEqual([]);
  }, 180000);
  it("UT-053 IT-016 Chromium writes a 1440-wide PNG and inert evidence HTML", async context => {
    if (!browserServer) {
      context.skip();
      return;
    }
    const endpoint = browserServer.wsEndpoint();
    // Launcher is the I/O boundary: both commands connect to the same real process,
    // and capture's close disconnects each client without restarting Chromium.
    const launcher = vi
      .spyOn(chromium, "launch")
      .mockImplementation(() => chromium.connect(endpoint));
    try {
      const screenshot = await cli("screenshot", "login-form", "--state", "error");
      expect(screenshot).toMatchObject({
        exitCode: 0,
        data: { path: "docs/design/login-form/error--light--1440.png", width: 1440 },
      });
      const { inspectImage } = await import("../../../src/node/image.ts");
      expect(
        inspectImage(readFileSync(join(root, "docs/design/login-form/error--light--1440.png")))
      ).toMatchObject({ width: 1440 });
      const evidence = await cli("evidence", "login-form", "--state", "error");
      expect(evidence).toMatchObject({
        exitCode: 0,
        data: { path: "docs/design/login-form/index.html" },
      });
      expect(readFileSync(join(root, "docs/design/login-form/index.html"), "utf8")).not.toMatch(
        /<script/i
      );
    } finally {
      launcher.mockRestore();
    }
  }, 120000);

  it("IT-014 migrate dispatches through the catalog without requiring proto.config", async () => {
    const target = appFixture("proto-migrate-cli-");
    try {
      const source = join(target, "gallery/comments/proto-shell");
      mkdirSync(source, { recursive: true });
      cpSync(
        resolve(import.meta.dirname, "../../fixtures/review/stack-v2/proto-shell/comments.json"),
        join(source, "comments.json")
      );
      const result = await runCli(
        ["migrate", "--from", "gallery/comments", "--dry-run", "--json"],
        {
          cwd: target,
        }
      );
      expect(result).toMatchObject({
        exitCode: 0,
        data: {
          dryRun: true,
          errors: [],
          keys: expect.arrayContaining([
            expect.objectContaining({ key: "proto-shell", status: "planned" }),
          ]),
        },
      });
      expect(
        (
          await runCli(
            ["migrate", "--from", "gallery/comments", "--theme-map", "invalid", "--json"],
            { cwd: target }
          )
        ).exitCode
      ).toBe(2);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
  it("IT-014 real CLI process uses project.store FileStore wiring", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const result = await promisify(execFile)("bun", [
      resolve(import.meta.dirname, "../../../src/cli/main.ts"),
      "comments",
      "list",
      "--app",
      root,
      "--status",
      "all",
      "--json",
    ]);
    expect(JSON.parse(result.stdout)).toHaveProperty("comments");
  });
  it("human output: failures go to stderr as ✗ <message> (<code>) with the registry exit; --json keeps the error body on stdout", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = (...args: string[]) =>
      promisify(execFile)("bun", [
        resolve(import.meta.dirname, "../../../src/cli/main.ts"),
        ...args,
      ]).then(
        output => ({ code: 0, ...output }),
        (error: { code: number; stdout: string; stderr: string }) => error
      );
    const human = await run("comments", "show", "login-form-404", "--app", root);
    expect(human.code).toBe(1);
    expect(human.stdout).toBe("");
    expect(human.stderr).toMatch(/^✗ .+ \(comment_not_found\)\n$/);
    const json = await run("comments", "show", "login-form-404", "--app", root, "--json");
    expect(json.code).toBe(1);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.stdout)).toMatchObject({ error: { code: "comment_not_found" } });
  });
  it("human output never prints a credential token", async () => {
    const { formatHuman } = await import("../../../src/cli/human.ts");
    const token = `pcr_${"ab".repeat(32)}`;
    const credential = {
      remote: "https://acme.test/proto/",
      id: "cr_1",
      name: "laptop",
      scopes: ["comment"],
      token,
    };
    const outputs = [
      formatHuman(["auth", "credentials"], { exitCode: 0, data: { credentials: [credential] } }),
      formatHuman(["auth", "login", "--remote", credential.remote], {
        exitCode: 0,
        data: { saved: true, ...credential },
      }),
    ];
    for (const output of outputs) {
      expect(output.stdout + output.stderr).toContain("laptop");
      expect(output.stdout + output.stderr).not.toContain(token);
    }
  });
});
