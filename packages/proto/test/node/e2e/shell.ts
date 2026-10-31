/**
 * Shared harness of the shell journeys (E2E): a shell built from source per suite, the real
 * `proto dev` on ports it binds itself (a busy pair is retried, never pre-checked), the review
 * store in a private temporary directory, the real CLI as a separate process, and the render
 * frame of a page. Each suite owns its work directory under `.tmp/`, removed afterwards.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Frame, Page } from "playwright";
import { build } from "vite";

import { onFreePorts } from "../ports.ts";
export { onFreePorts } from "../ports.ts";
import { startDev } from "../../../src/node/dev.ts";
import { loadProject, type ProtoProject } from "../../../src/node/project.ts";
import { sourceRoots } from "../../../src/model/source.ts";
import {
  createDevAuthorizer,
  createReviewRouter,
  ReviewEvents,
} from "../../../src/review/index.ts";
import { FileStore } from "../../../src/store/index.ts";

export const packageRoot = resolve(import.meta.dirname, "../../..");

/** A work directory inside the package (so fixture apps resolve the package's React). */
export function workDir(name: string) {
  const dir = join(packageRoot, ".tmp", `${name}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

export function writeApp(dir: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
}

/** The prebuilt shell from this checkout's sources (never a stale `dist/shell`). */
export async function buildShell(outDir: string) {
  await build({
    configFile: join(packageRoot, "vite.shell.config.ts"),
    logLevel: "error",
    build: { outDir, emptyOutDir: true },
  });
  return outDir;
}

/**
 * The real `proto dev` of `root` (shell `shellDir`) on free ports. Review writes go to the app's
 * own store, so suites that write use a fixture app under their work directory, never `apps/app`.
 */
export async function startProtoDev(root: string, shellDir: string) {
  const project = await loadProject(root);
  const server = await onFreePorts(port => startDev(project, { port, shellDir }));
  return { project, ...server, store: project.store() };
}

/**
 * `proto dev` of an isolated app fixture whose seeded review files must stay untouched: the review
 * router runs over a store in a temporary directory, wired to SSE as in `proto dev`.
 */
export async function devWithTempStore(root: string, shellDir: string) {
  const project = await loadProject(root);
  const directory = mkdtempSync(join(tmpdir(), "proto-shell-e2e-"));
  const store = new FileStore({
    root: project.root,
    directory,
    registry: () => project.registry(),
    roots: sourceRoots(project.config),
  });
  const events = new ReviewEvents();
  const server = await onFreePorts(port =>
    startDev(project, {
      port,
      shellDir,
      review: createReviewRouter({
        store,
        registry: () => project.registry(),
        events,
        authorize: createDevAuthorizer({ shellOrigin: `http://127.0.0.1:${port}` }),
        roots: sourceRoots(project.config),
        commit: () => null,
      }),
    })
  );
  const stopEvents = events.subscribe(event => {
    if (event.type !== "registry") server.publish(event.type, { key: event.key });
  });
  const stopWatch = await store.subscribe(event => events.publish(event));
  return {
    project,
    store,
    origin: server.origin,
    renderOrigin: server.renderOrigin,
    async close() {
      stopWatch();
      stopEvents();
      await server.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

/** A small consumer app: a spec'd component prototype with states, a draft and a flow. */
export const reviewFixture: Record<string, string> = {
  "proto.config.ts": `export default { title: "Review fixture", specs: { auth: "Authentication" } };\n`,
  "proto.canvas.tsx": `import type { ReactNode } from "react";
export function Canvas({ children }: { children: ReactNode }) {
  return <div data-testid="canvas">{children}</div>;
}
`,
  "src/components/login-form.tsx": `export function LoginForm({ error }: { error: string | null }) {
  return (
    <form style={{ padding: 40, width: 320 }}>
      <h1>Sign in</h1>
      {error ? <p data-testid="login-error">{error}</p> : null}
      <button type="submit">Continue</button>
    </form>
  );
}
`,
  "src/components/login-form.proto.tsx": `import { definePrototype, type PrototypeProps } from "@compozy/proto";
import { LoginForm } from "./login-form";

export const meta = definePrototype({
  title: "Sign in",
  spec: "auth",
  surface: "A1",
  route: "/login",
  standalone: true,
  states: [
    { id: "sign-in", label: "Sign in" },
    { id: "error", label: "Wrong password" },
  ],
});

export default function Prototype({ state }: PrototypeProps) {
  return <LoginForm error={state === "error" ? "Invalid email or password" : null} />;
}
`,
  "src/drafts/welcome/index.proto.tsx": `import { definePrototype } from "@compozy/proto";

export const meta = definePrototype({
  title: "Welcome home",
  surface: "D1",
  route: "/",
  states: [{ id: "default", label: "First steps" }],
});

export default function Welcome() {
  return <main data-testid="welcome">Welcome home</main>;
}
`,
  "flows/sign-in.flow.ts": `import { defineFlow } from "@compozy/proto/flow";

export const flow = defineFlow({
  title: "Sign in",
  spec: "auth",
  start: ["sign-in"],
  nodes: {
    "sign-in": { proto: "login-form", state: "sign-in" },
    error: { proto: "login-form", state: "error", end: true },
  },
  edges: [["sign-in", "error", { on: "Wrong password", kind: "overlay" }]],
});
`,
};

/** The real `proto` CLI in its own process. */
export function runCli(args: string[], cwd = packageRoot) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, fail) => {
    const runtime = process.versions.bun ? process.execPath : "bun";
    const child = spawn(runtime, [join(packageRoot, "src/cli/main.ts"), ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => (stdout += chunk));
    child.stderr.on("data", chunk => (stderr += chunk));
    child.once("error", fail);
    child.once("close", code => done({ code, stdout, stderr }));
  });
}

/** The page's render frame once its prototype rendered `selector`. */
export async function renderFrame(page: Page, renderOrigin: string, selector: string) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    for (const frame of page.frames()) {
      if (!frame.url().startsWith(renderOrigin)) continue;
      if (await frame.$(selector).catch(() => null)) return frame;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`No render frame showed ${selector}`);
}

export type { Frame, ProtoProject };
