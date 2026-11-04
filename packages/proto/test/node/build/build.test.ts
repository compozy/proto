import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { chromium } from "playwright";
import { loadProject } from "../../../src/node/project.ts";
import { buildProject } from "../../../src/node/build.ts";
import { buildAndSwap, cleanupSnapshots, shareDirectory } from "../../../src/share/snapshot.ts";
import { bootstrapSchema } from "../../../src/model/bootstrap.ts";
import { png, input, reviewer } from "../store/contract.ts";
import { buildShell } from "../e2e/shell.ts";
import { storiesFixture } from "../app-fixture.ts";
import { storyHref, type StoryResult } from "../../../src/model/protocol.ts";
const pkg = resolve(import.meta.dirname, "../../..");
const roots: string[] = [];
const shell = join(pkg, "dist/shell");
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
async function fixture(includeReview = false) {
  await mkdir(join(pkg, ".tmp"), { recursive: true });
  const root = await mkdtemp(join(pkg, ".tmp/static-"));
  roots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "proto.config.ts"),
    `export default {title:'Static fixture',build:{includeReview:${includeReview}},guards:{forbidRuntimeImports:['src/data.ts']}};`
  );
  await writeFile(
    join(root, "vite.config.ts"),
    `import react from '@vitejs/plugin-react'; export default {plugins:[react()]};`
  );
  await writeFile(
    join(root, "proto.canvas.tsx"),
    `export function Canvas({children}) { return children; }`
  );
  await writeFile(
    join(root, "src/view.tsx"),
    `export function View() { return <button>Static prototype</button>; }`
  );
  await writeFile(
    join(root, "src/example.proto.tsx"),
    `import {definePrototype} from '@compozy/proto'; import {View} from './view'; export const meta=definePrototype({title:'Example',states:[{id:'default',label:'Default'}]}); export default function Example(){return <View/>;}`
  );
  // This shell fixture owns only data/render tests, never claims the in-flight shell UI.
  const fixtureShell = join(root, "fixture-shell");
  await mkdir(fixtureShell);
  await writeFile(
    join(fixtureShell, "index.html"),
    "<!doctype html><title>Static data fixture</title>"
  );
  const project = await loadProject(root);
  return {
    root,
    project,
    options: { shellDir: existsSync(join(shell, "index.html")) ? shell : fixtureShell },
  };
}
async function seed(project: Awaited<ReturnType<typeof loadProject>>) {
  const store = project.store();
  const image = await store.upload(
    "example",
    { bytes: png, name: "pixel.png", type: "image/png" },
    reviewer
  );
  const comment = await store.add(
    "example",
    { ...input, body: "Existing thread", attachments: [image.id] },
    reviewer
  );
  return { image, comment };
}
// Owner: build output contract. An explicit destination never deletes an existing gallery.
it("custom output preserves dist-proto and writes the snapshot version in bootstrap", async () => {
  const { root, project, options } = await fixture();
  await mkdir(join(root, "dist-proto"));
  await writeFile(join(root, "dist-proto/keep.txt"), "existing gallery");
  const output = join(root, "snapshots/version-a");
  await buildProject(project, { ...options, output, snapshot: "version-a" });
  expect(await readFile(join(root, "dist-proto/keep.txt"), "utf8")).toBe("existing gallery");
  const bootstrap = bootstrapSchema.parse(
    JSON.parse(await readFile(join(output, "__proto/bootstrap.json"), "utf8"))
  );
  expect(bootstrap.snapshot).toBe("version-a");
  await writeFile(join(root, "src/example.proto.tsx"), "export const meta=invalid();");
  await expect(buildProject(project, { ...options, output })).rejects.toThrow(/invalid_meta/);
  expect(existsSync(join(output, "index.html"))).toBe(true);
  expect(await readFile(join(root, "dist-proto/keep.txt"), "utf8")).toBe("existing gallery");
}, 30000);

// Owner: snapshot publication orchestration, real Vite build and filesystem (no build mock).
// Invariant: only complete snapshots go live, failures preserve current, and one old version stays.
it("snapshot swaps retain the previous build and failed refresh keeps current live", async () => {
  const { root, project, options } = await fixture();
  const { readlink } = await import("node:fs/promises");
  const target = { kind: "prototype", slug: "example" } as const;
  const settings = { ...options, approvers: false, remote: "https://gallery.example.com" };
  const first = await buildAndSwap(project, target, settings);
  const current = join(shareDirectory(root), "current");
  const live = async () => {
    const bootstrap = bootstrapSchema.parse(
      JSON.parse(await readFile(join(current, "__proto/bootstrap.json"), "utf8"))
    );
    return bootstrap.snapshot;
  };
  expect(await live()).toBe(first.snapshot);
  const second = await buildAndSwap(project, target, settings);
  expect(await live()).toBe(second.snapshot);
  expect(existsSync(first.output)).toBe(true);
  const third = await buildAndSwap(project, target, settings);
  expect(await live()).toBe(third.snapshot);
  expect(existsSync(first.output)).toBe(false);
  expect(existsSync(second.output)).toBe(true);
  const previousLink = await readlink(current);
  await expect(
    buildAndSwap(project, { kind: "prototype", slug: "missing" }, settings)
  ).rejects.toMatchObject({ code: "share_target_not_found" });
  await writeFile(join(root, "src/view.tsx"), "export function View( {");
  await expect(buildAndSwap(project, target, settings)).rejects.toThrow();
  expect(await readlink(current)).toBe(previousLink);
  expect(await live()).toBe(third.snapshot);
  await cleanupSnapshots(root);
  expect(existsSync(shareDirectory(root))).toBe(false);
}, 120000);
// Owner: static build orchestration. Persisted private history is opt-in, including images.
it("UT-044 / UT-096: static output has relative bootstrap, registry, opt-in threads and images", async () => {
  const { root, project, options } = await fixture(true);
  const { image } = await seed(project);
  await buildProject(project, options);
  const output = join(root, "dist-proto");
  const bootstrap = bootstrapSchema.parse(
    JSON.parse(await readFile(join(output, "__proto/bootstrap.json"), "utf8"))
  );
  expect(bootstrap).toMatchObject({
    mode: "read-only",
    apiBase: null,
    eventsUrl: null,
    renderUrl: "__proto/render/index.html",
    reviewSnapshotBase: "__proto/review/",
    principal: null,
    signInUrl: null,
  });
  for (const value of [bootstrap.renderUrl, bootstrap.registryUrl, bootstrap.reviewSnapshotBase!])
    expect(value).not.toMatch(/^(\/|https?:)/);
  const snapshot = JSON.parse(await readFile(join(output, "__proto/review/example.json"), "utf8"));
  expect(snapshot.comments[0].thread[0].body).toBe("Existing thread");
  expect(snapshot.comments[0].thread[0].attachments[0].url).toBe(
    `__proto/review/example/attachments/${image.id}.png`
  );
  expect(
    new Uint8Array(await readFile(join(output, snapshot.comments[0].thread[0].attachments[0].url)))
  ).toEqual(png);
  expect(snapshot.review.status).toBe("in_review");
  project.config.build.includeReview = false;
  await buildProject(project, options);
  expect(existsSync(join(output, "__proto/review"))).toBe(false);
  expect(
    JSON.parse(await readFile(join(output, "__proto/bootstrap.json"), "utf8")).reviewSnapshotBase
  ).toBeNull();
  expect((await project.store().get("example-1")).thread[0]?.body).toBe("Existing thread");
}, 30000);
// Owner: build command and publication boundary; invalid registries and forbidden graphs leave no artifact.
it("IT-012: registry problems exit 1; guard failures remove even stale dist-proto", async () => {
  const { root, project, options } = await fixture();
  await mkdir(join(root, "dist-proto"));
  await writeFile(join(root, "dist-proto/old.txt"), "stale");
  await writeFile(join(root, "src/example.proto.tsx"), "export const meta = invalid();");
  const command = join(pkg, "src/cli/main.ts");
  const result = spawnSync("bun", [command, "build", "--json"], { cwd: root, encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("invalid_meta");
  expect(existsSync(join(root, "dist-proto"))).toBe(false);
  await writeFile(
    join(root, "src/example.proto.tsx"),
    `import {definePrototype} from '@compozy/proto'; import {View} from './view'; export const meta=definePrototype({title:'Example',states:[{id:'default',label:'Default'}]}); export default View;`
  );
  await writeFile(
    join(root, "src/view.tsx"),
    `import {value} from './data'; export function View(){return <button>{value}</button>}`
  );
  await writeFile(join(root, "src/data.ts"), `export const value='Forbidden';`);
  await expect(buildProject(project, options)).rejects.toThrow(/network_import/);
  expect(existsSync(join(root, "dist-proto"))).toBe(false);
}, 30000);
async function serve(output: string) {
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, "http://localhost").pathname;
      if (!path.startsWith("/gallery/")) {
        res.writeHead(404).end();
        return;
      }
      const file = join(output, path.slice("/gallery/".length) || "index.html");
      res.setHeader(
        "Content-Type",
        (
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
          } as Record<string, string>
        )[extname(file)] ?? "application/octet-stream"
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${(server.address() as { port: number }).port}/gallery/`,
    close: () => new Promise<void>(r => server.close(() => r())),
  };
}
it("E2E-010: static data, image and query-form render work under /gallery/ without rewrites", async () => {
  const { root, project, options } = await fixture(true);
  const { image } = await seed(project);
  await buildProject(project, options);
  const server = await serve(join(root, "dist-proto"));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(server.url);
    await page.evaluate(async () => {
      const bootstrap = await (await fetch("./__proto/bootstrap.json")).json();
      const frame = document.createElement("iframe");
      frame.src = `${bootstrap.renderUrl}?slug=example&state=default&chrome=0`;
      document.body.append(frame);
    });
    await page
      .frameLocator("iframe")
      .last()
      .getByRole("button", { name: "Static prototype" })
      .waitFor();
    const snapshot = await (
      await page.request.get(server.url + "__proto/review/example.json")
    ).json();
    expect(snapshot.comments[0].thread[0].body).toBe("Existing thread");
    await page.goto(server.url + `__proto/review/example/attachments/${image.id}.png`);
    expect(await page.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
    expect((await page.request.get(server.url + "__proto/render/example")).status()).toBe(404);
  } finally {
    await browser.close();
    await server.close();
  }
}, 30000);
it("E2E-010 shell UI: read-only hides mutations and default build explains absent review", async () => {
  const { root, project } = await fixture(true);
  // Shell behavior is asserted against the shell built from this checkout, never a fallback page.
  const options = { shellDir: await buildShell(join(root, "built-shell")) };
  await seed(project);
  await buildProject(project, options);
  const server = await serve(join(root, "dist-proto"));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(server.url + "?p=example");
    await page
      .frameLocator("iframe")
      .first()
      .getByRole("button", { name: "Static prototype" })
      .waitFor();
    expect(
      await page.getByRole("button", { name: /add comment|approve|credentials/i }).count()
    ).toBe(0);
    const commentsTab = page.getByRole("tab", { name: /comments/i });
    expect(
      await commentsTab.count(),
      "The integrated shell must provide the read-only Comments inspector"
    ).toBe(1);
    await commentsTab.click();
    await page.getByText("Existing thread", { exact: true }).waitFor();
    await page.locator('img[src*="attachments/"]').first().waitFor();
    expect(
      await page
        .locator('img[src*="attachments/"]')
        .first()
        .evaluate((img: HTMLImageElement) => img.naturalWidth)
    ).toBe(1);
    expect(await page.locator("iframe").first().getAttribute("src")).toContain("?slug=");
    project.config.build.includeReview = false;
    await buildProject(project, options);
    await page.reload();
    await page.getByRole("tab", { name: /comments/i }).click();
    await page.getByText(/not included/i).waitFor();
  } finally {
    await browser.close();
    await server.close();
  }
}, 120_000);

// Owner: build/CLI orchestration; a configured remote target must never change plain build mode.
it("UT-044: remote builds require an explicit boolean CLI flag or Node option", async () => {
  const { runCli } = await import("../../../src/cli/main.ts");
  const { root, project, options } = await fixture();
  project.config.review.remote = { url: "https://gallery.example.com/proto/" };
  vi.stubEnv("PROTO_REMOTE_URL", "");
  const mode = async () =>
    JSON.parse(await readFile(join(root, "dist-proto/__proto/bootstrap.json"), "utf8")).mode;
  expect((await runCli(["build"], { project, cwd: root })).exitCode).toBe(0);
  expect(await mode()).toBe("read-only");
  expect((await runCli(["build", "--remote"], { project, cwd: root })).exitCode).toBe(0);
  expect(await mode()).toBe("remote");
  delete project.config.review.remote;
  expect((await runCli(["build", "--remote"], { project, cwd: root })).data).toMatchObject({
    error: {
      code: "invalid_config",
      message: expect.stringContaining("review.remote.url or PROTO_REMOTE_URL"),
    },
  });
  vi.stubEnv("PROTO_REMOTE_URL", "https://environment.example.com/proto/");
  expect((await runCli(["build", "--remote"], { project, cwd: root })).exitCode).toBe(0);
  expect(await mode()).toBe("remote");
  await buildProject(project, { ...options, remote: "https://node.example.com" });
  expect(await mode()).toBe("remote");
  await buildProject(project, options);
  expect(await mode()).toBe("read-only");
}, 120000);

// Invariant: remote builds omit stories despite story problems and missing peers.
// Owner: static build orchestration; local stories belong to IT-020 below.
it("stories IT-027: remote builds keep omitting stories", async () => {
  const remote = "https://gallery.example.test";
  const { root, project, options } = await fixture();
  project.config.stories = {
    roots: [
      {
        id: "ui",
        title: "UI",
        dir: ".",
        stories: ["src/**/*.stories.tsx"],
        preview: "missing.ts",
        vite: "missing-vite.ts",
        static: [],
        themeGlobal: "theme",
        guards: { forbidRuntimeImports: [] },
      },
    ],
  };
  await writeFile(join(root, "src/broken.stories.tsx"), "export default {");
  expect(
    (await project.registry()).problems.some(problem => problem.code.startsWith("story_"))
  ).toBe(true);
  const result = await buildProject(project, { ...options, remote });
  expect(result.warnings).toContainEqual(expect.objectContaining({ code: "stories_not_built" }));
  const registry = JSON.parse(
    await readFile(join(root, "dist-proto/__proto/registry.json"), "utf8")
  );
  const bootstrap = JSON.parse(
    await readFile(join(root, "dist-proto/__proto/bootstrap.json"), "utf8")
  );
  expect(registry).not.toHaveProperty("stories");
  expect(registry).not.toHaveProperty("storyRoots");
  expect(bootstrap).not.toHaveProperty("storyRoots");
  expect(registry.problems).toEqual([]);
}, 30000);

// Invariant: local artifacts preserve isolated roots, lazy modules, review history and the real
// MSW → loader → render → play lifecycle under a subpath; workers cannot control the shell.
// Owner: canonical static build integration suite, using real Vite, Storybook, MSW and Chromium.
it("stories IT-020: local static roots run MSW and play with confined workers", async () => {
  const fixture = storiesFixture();
  roots.push(fixture.root);
  const fixtureShell = join(fixture.app, "fixture-shell");
  await mkdir(fixtureShell);
  await writeFile(join(fixtureShell, "index.html"), "<!doctype html><title>Static stories</title>");
  await writeFile(
    join(fixture.app, "src/lazy.stories.tsx"),
    `
    export default { title: 'UI/Lazy' };
    export const Default = { render: () => <span>Lazy story</span> };
  `
  );
  const project = await loadProject(fixture.app);
  project.config.build.includeReview = true;
  await project.store().add(
    "story--ui-button",
    {
      ...input,
      context: { ...input.context, state: "ui-button--network" },
      body: "Static story review",
    },
    reviewer
  );
  const result = await buildProject(project, { shellDir: fixtureShell });
  expect(result.warnings.some(warning => warning.code === "stories_not_built")).toBe(false);
  const bootstrap = bootstrapSchema.parse(
    JSON.parse(await readFile(join(result.output, "__proto/bootstrap.json"), "utf8"))
  );
  expect(bootstrap.mode).toBe("read-only");
  expect(bootstrap).not.toHaveProperty("projectId");
  expect(bootstrap.storyRoots).toEqual([
    { id: "app", renderUrl: "__stories/app/index.html" },
    { id: "ui", renderUrl: "__stories/ui/index.html" },
  ]);
  const snapshot = JSON.parse(
    await readFile(join(result.output, "__proto/review/story--ui-button.json"), "utf8")
  );
  expect(snapshot.comments[0].context.state).toBe("ui-button--network");
  expect(snapshot.comments[0].thread[0].body).toBe("Static story review");
  const server = await serve(result.output);
  const browser = await chromium.launch({
    headless: true,
    args: ["--host-resolver-rules=MAP insecure.test 127.0.0.1", "--no-proxy-server"],
  });
  try {
    const page = await browser.newPage();
    const requested: string[] = [];
    page.on("request", request => requested.push(request.url()));
    const href = (root: string, story: string) =>
      storyHref(
        new URL(bootstrap.storyRoots!.find(item => item.id === root)!.renderUrl, server.url).href,
        { kind: "story", root, slug: "ui-button", story, theme: "dark", play: true }
      );
    const outcome = async () => {
      await page.waitForFunction(() => {
        const result = document.documentElement.dataset.protoStory;
        return result && JSON.parse(result).status !== "running";
      });
      return JSON.parse(
        (await page.locator("html").getAttribute("data-proto-story"))!
      ) as StoryResult;
    };
    await page.goto(href("app", "ui-button--network"));
    expect(await outcome()).toMatchObject({ status: "passed", stage: "play", hasPlay: true });
    await page.getByRole("button", { name: "Mock response" }).waitFor();
    expect(requested.some(url => /lazy\.stories/.test(url))).toBe(false);
    expect(
      await page.evaluate(async () =>
        (await navigator.serviceWorker.getRegistrations()).map(
          worker => new URL(worker.scope).pathname
        )
      )
    ).toEqual(["/gallery/__stories/app/"]);
    await expect(
      page.evaluate(async () => {
        await navigator.serviceWorker.register("./mockServiceWorker.js", { scope: "/gallery/" });
      })
    ).rejects.toThrow();
    await page.goto(href("app", "ui-button--primary"));
    expect(await outcome()).toMatchObject({ status: "passed", stage: "play", hasPlay: true });
    await page.getByRole("button", { name: "Clicked" }).waitFor();
    await page.goto(href("app", "ui-lazy--default"));
    expect(await outcome()).toMatchObject({ status: "passed" });
    expect(requested.some(url => /lazy\.stories/.test(url))).toBe(true);
    await page.goto(href("ui", "ui-badge--default"));
    expect(await outcome()).toMatchObject({ status: "passed" });
    await page.locator('[data-root="ui"]').waitFor();
    for (const [root, expected] of [
      ["app", "app\n"],
      ["ui", "packages/ui\n"],
    ]) {
      expect(
        await (await page.request.get(server.url + `__stories/${root}/vendor/root.txt`)).text()
      ).toBe(expected);
    }
    await page.goto(server.url);
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
    const insecure = href("app", "ui-button--network").replace("127.0.0.1", "insecure.test");
    await page.goto(insecure);
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
    expect(await outcome()).toMatchObject({
      status: "failed",
      stage: "import",
      error: expect.stringMatching(/service workers need a secure context/i),
    });
  } finally {
    await browser.close();
    await server.close();
  }
}, 180000);

// Invariant: story index/peer/graph failures block local publication and identify the root.
// Owner: static build orchestration; failed builds must leave no stale or partial artifact.
it("stories IT-020: a failing local root prevents publication", async () => {
  const fixture = storiesFixture();
  roots.push(fixture.root);
  const fixtureShell = join(fixture.app, "fixture-shell");
  await mkdir(fixtureShell);
  await writeFile(join(fixtureShell, "index.html"), "<!doctype html><title>Fixture</title>");
  const project = await loadProject(fixture.app);
  const options = { shellDir: fixtureShell };
  await mkdir(join(fixture.app, "dist-proto"));
  await writeFile(join(fixture.app, "dist-proto/stale.txt"), "stale");
  await writeFile(
    join(fixture.root, "packages/ui/vite.config.ts"),
    `throw new Error('root pipeline failed');`
  );
  await expect(buildProject(project, options)).rejects.toThrow(
    /Story root ui failed to build.*root pipeline failed/s
  );
  expect(existsSync(join(fixture.app, "dist-proto"))).toBe(false);
  await writeFile(join(fixture.app, "src/broken.stories.tsx"), "export default {");
  await expect(buildProject(project, options)).rejects.toThrow(/story_parse/);
  expect(existsSync(join(fixture.app, "dist-proto"))).toBe(false);
}, 120000);

// Invariant: dependency failures retain the public error code/exit and name the failing root.
// Owner: static build integration; peer packages are filesystem inputs, never runtime mocks.
it.each([
  ["storybook_missing", { version: "10.6.2", exports: {} }],
  ["storybook_unsupported", { version: "10.7.0" }],
])(
  "stories IT-020: local builds reject %s",
  async (code, manifest) => {
    const fixture = storiesFixture();
    roots.push(fixture.root);
    const dir = join(fixture.root, "isolated");
    await mkdir(join(dir, "node_modules/storybook"), { recursive: true });
    await writeFile(join(dir, "node_modules/storybook/package.json"), JSON.stringify(manifest));
    await writeFile(join(dir, "package.json"), '{"type":"module"}');
    await writeFile(join(dir, "preview.ts"), "export {};");
    const project = await loadProject(fixture.app);
    project.config.stories!.roots[1]!.dir = "../isolated";
    project.config.stories!.roots[1]!.preview = "preview.ts";
    const shellDir = join(fixture.app, "fixture-shell");
    await mkdir(shellDir);
    await writeFile(join(shellDir, "index.html"), "<!doctype html><title>Fixture</title>");
    await expect(buildProject(project, { shellDir })).rejects.toMatchObject({
      code,
      message: expect.stringContaining("Story root ui failed to build"),
      exit: 3,
    });
    expect(existsSync(join(fixture.app, "dist-proto"))).toBe(false);
  },
  120000
);

// Invariant: no stories config needs no Storybook graph in dev, check or local builds.
// Owner: project integration; the existing static-build suite exercises the real shell.
it("stories IT-019: story-free dev, check and build remain usable", async () => {
  const { startDev } = await import("../../../src/node/dev.ts");
  const { checkProject } = await import("../../../src/node/check.ts");
  const { onFreePorts } = await import("../ports.ts");
  const { root, project } = await fixture();
  expect(existsSync(join(root, "node_modules/storybook"))).toBe(false);
  const shellDir = await buildShell(join(root, "built-shell"));
  const browser = await chromium.launch();
  const dev = await onFreePorts(port => startDev(project, { port, quiet: true, shellDir }));
  try {
    const bootstrap = await fetch(dev.origin + "/__proto/bootstrap.json").then(response =>
      response.json()
    );
    expect(bootstrap.storyRoots ?? []).toEqual([]);
    const page = await browser.newPage();
    await page.goto(dev.origin);
    await page.getByRole("button", { name: "Search", exact: false }).first().waitFor();
    expect(await page.getByRole("link", { name: "Components", exact: true }).count()).toBe(0);
    expect(await checkProject(project)).toMatchObject({ ok: true, problems: [] });
    await buildProject(project, { shellDir });
    const registry = JSON.parse(
      await readFile(join(root, "dist-proto/__proto/registry.json"), "utf8")
    );
    expect(registry.storyRoots ?? []).toEqual([]);
    expect(registry.stories ?? []).toEqual([]);
  } finally {
    await dev.close();
    await browser.close();
  }
}, 120000);
