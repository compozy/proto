/**
 * Comment mode end to end against a real `proto dev` (`_tests.md` E2E-007, E2E-014, E2E-004's
 * comment-on-step part; IT-027/IT-028 shell halves): the shell built from source, the render
 * origin compiling a fixture app on port + 1, the dev review router over the file store, SSE —
 * driven by Playwright Chromium. The fixture app is written under `.tmp/` (inside the package, so
 * React resolves) and removed afterwards.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { chromium, type Browser, type Frame, type Page } from "playwright";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startDev } from "../../../src/node/dev.ts";
import { loadProject, type ProtoProject } from "../../../src/node/project.ts";
import { onFreePorts, runCli } from "../e2e/shell.ts";

const packageRoot = resolve(import.meta.dirname, "../../..");
const work = join(packageRoot, ".tmp", `comment-review-${process.pid}`);
const app = join(work, "app");
const shellDir = join(work, "shell");

/** A 1×1 PNG. */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const files: Record<string, string> = {
  "proto.config.ts": `export default { title: "Comment fixture", specs: { auth: "Authentication" } };\n`,
  "proto.canvas.tsx": `import type { ReactNode } from "react";
export function Canvas({ children }: { children: ReactNode }) {
  return <div style={{ font: "16px sans-serif" }}>{children}</div>;
}
`,
  "src/components/login-form.tsx": `export function LoginForm({ error }: { error: string | null }) {
  return (
    <form style={{ padding: 40, width: 320 }}>
      <h1 data-testid="login-title">Sign in</h1>
      <input aria-label="Email" />
      {error ? (
        <p data-testid="login-error" style={{ color: "crimson" }}>
          {error}
        </p>
      ) : null}
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
  // E2E-014: prototype code shares the render host's realm. It tries to write to the review API
  // and forges render → shell messages: a pick result outside any pick, and repeatedly one whose
  // source escapes the app.
  "src/drafts/hostile/index.proto.tsx": `import { definePrototype } from "@compozy/proto";
import { useEffect, useState } from "react";

export const meta = definePrototype({
  title: "Hostile",
  surface: "H1",
  route: "/",
  states: [{ id: "default", label: "Default" }],
});

const target = (source: string) => ({
  kind: "element",
  selector: "main",
  testId: null,
  tag: "main",
  text: "Hostile",
  source,
  sourceChain: [source],
  rect: { x: 0, y: 0, width: 100, height: 40 },
  rectNormalized: { x: 0, y: 0, width: 0.1, height: 0.1 },
  offset: null,
});

export default function Hostile() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    const add = (entry: string) => setLog(current => [...current, entry]);
    const shell = "http://127.0.0.1:" + (Number(window.location.port) - 1);
    const frame = new URLSearchParams(window.location.search).get("frame");
    const comment = JSON.stringify({
      key: "hostile",
      body: "Written by the prototype",
      context: { state: "default", theme: null, role: null, viewport: { width: 1, height: 1 } },
      target: target("src/drafts/hostile/index.proto.tsx:1:1"),
    });
    fetch(shell + "/__proto/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Proto-Request": "1" },
      body: comment,
    }).then(response => add("json:" + response.status), () => add("json:blocked"));
    fetch(shell + "/__proto/api/comments", { method: "POST", mode: "no-cors", body: comment }).then(
      () => add("simple:sent"),
      () => add("simple:blocked")
    );
    let forged = 0;
    const post = (source: string) => {
      window.parent.postMessage({ proto: 1, frame, type: "pick:result", target: target(source) }, "*");
      forged += 1;
      add("forged:" + forged);
    };
    post("src/drafts/hostile/index.proto.tsx:1:1");
    const timer = setInterval(() => post("../../.github/workflows/ci.yml:1:1"), 300);
    return () => clearInterval(timer);
  }, []);
  return <main data-testid="hostile" style={{ padding: 40 }}>{log.join(" ")}</main>;
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

let project: ProtoProject;
let server: Awaited<ReturnType<typeof startDev>>;
let browser: Browser;

beforeAll(async () => {
  rmSync(work, { recursive: true, force: true });
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(app, file)), { recursive: true });
    writeFileSync(join(app, file), content);
  }
  await build({
    configFile: join(packageRoot, "vite.shell.config.ts"),
    logLevel: "error",
    build: { outDir: shellDir, emptyOutDir: true },
  });
  project = await loadProject(app);
  // The bind is the check: a pair taken meanwhile is retried, never raced.
  server = await onFreePorts(port => startDev(project, { port, shellDir }));
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  rmSync(work, { recursive: true, force: true });
}, 60000);

async function open(path: string) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${server.origin}${path}`);
  return page;
}

/** The render frame of the screen view, once its prototype rendered `selector`. */
async function renderFrame(page: Page, selector: string): Promise<Frame> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const frame = page.frames().find(item => item.url().startsWith(server.renderOrigin));
    if (frame && (await frame.$(selector).catch(() => null))) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`The render frame never showed ${selector}`);
}

/** Clicks the center of an element inside the frame, through the render host's picker. */
async function clickIn(page: Page, frame: Frame, selector: string) {
  const element = await frame.$(selector);
  const box = await element!.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

const pickerActive = (frame: Frame) =>
  frame.evaluate(() => Boolean(document.querySelector('[data-testid="proto-picker"]')));

describe("comment mode against proto dev", () => {
  it("E2E-007: C, click the error text, attach a PNG, send → pinned comment with source; an agent reply arrives over SSE; resolve moves it to Resolved", async () => {
    const page = await open("/?p=login-form&state=error");
    const frame = await renderFrame(page, '[data-testid="login-error"]');
    await page.locator("body").press("c");
    await page.getByTestId("comment-hint").waitFor();
    await expect.poll(() => pickerActive(frame)).toBe(true);

    await clickIn(page, frame, '[data-testid="login-error"]');
    const composer = page.getByTestId("comment-composer");
    await composer.waitFor();
    expect(await page.getByTestId("composer-source").textContent()).toMatch(
      /^src\/components\/login-form\.tsx:\d+:\d+$/
    );
    await page
      .getByTestId("composer-file")
      .setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: png });
    await page.getByText("1 / 6").waitFor();
    await composer.getByRole("textbox").fill("The error should sit under the password field.");
    await composer.getByRole("button", { name: "Comment", exact: true }).click();

    const pin = page.getByTestId("comment-pin");
    await pin.waitFor();
    expect(await pin.textContent()).toBe("1");

    const store = project.store();
    const [comment] = await store.list({ key: "login-form" });
    expect(comment).toMatchObject({
      id: "login-form-1",
      context: {
        state: "error",
        theme: expect.any(String),
        viewport: { width: expect.any(Number) },
      },
      target: {
        kind: "element",
        testId: "login-error",
        tag: "p",
        text: "Invalid email or password",
        source: expect.stringMatching(/^src\/components\/login-form\.tsx:\d+:\d+$/),
      },
      thread: [{ author: "reviewer", body: "The error should sit under the password field." }],
    });
    expect(comment!.thread[0]!.attachments).toHaveLength(1);
    expect(
      comment!.context.commit === null || /^[a-f0-9]{40}$/.test(comment!.context.commit!)
    ).toBe(true);
    const chain = comment!.target.kind === "element" ? comment!.target.sourceChain : [];
    expect(chain.some(source => source.startsWith("src/components/login-form.proto.tsx:"))).toBe(
      true
    );

    // The thread of the new comment (inspector Comments tab, focused), with its source chip.
    await page.getByRole("tab", { name: /Comments/ }).click();
    const thread = page.getByRole("article", { name: "Comment #1" });
    await thread.waitFor();
    expect(await thread.textContent()).toContain("login-form.tsx");

    // An agent answers from its own process (the real CLI): the reply arrives over SSE.
    const reply = await runCli([
      "comments",
      "reply",
      comment!.id,
      "--note",
      "Moved it under the password field.",
      "--app",
      app,
      "--json",
    ]);
    expect(reply.code, reply.stderr).toBe(0);
    expect((await store.get(comment!.id)).thread.at(-1)).toMatchObject({ author: "agent" });
    await thread.getByText("Moved it under the password field.").waitFor({ timeout: 10_000 });

    // Resolving moves the thread to Resolved and removes the open pin.
    await thread.getByRole("button", { name: "Resolve", exact: true }).click();
    await page.getByRole("tab", { name: /Resolved · 1/ }).waitFor();
    await pin.waitFor({ state: "detached", timeout: 10_000 });
    expect((await store.get(comment!.id)).status).toBe("resolved");
    await page.close();
  }, 60_000);

  it("E2E-014 / IT-028: a hostile prototype writes nothing; forged picks are ignored or refused", async () => {
    const before = (await project.store().list({ status: "all" })).length;
    const page = await open("/?p=hostile");
    const frame = await renderFrame(page, '[data-testid="hostile"]');
    await expect
      .poll(
        () => frame.evaluate(() => document.querySelector('[data-testid="hostile"]')!.textContent),
        {
          timeout: 10_000,
        }
      )
      .toMatch(/json:blocked.*simple:sent|simple:sent.*json:blocked/);
    // The forged result outside a pick and the repeated ones before comment mode change nothing:
    // wait until the prototype reports several forgeries after the frame was ready (its frame
    // listener is attached by then), then assert their absence.
    await expect
      .poll(
        () =>
          frame.evaluate(() =>
            Number(
              /forged:(\d+)(?!.*forged:)/.exec(
                document.querySelector('[data-testid="hostile"]')!.textContent ?? ""
              )?.[1] ?? 0
            )
          ),
        { timeout: 10_000 }
      )
      .toBeGreaterThanOrEqual(4);
    expect(await page.getByTestId("comment-composer").count()).toBe(0);

    await page.getByTestId("comment-tool").click();
    await page.getByTestId("comment-refused").waitFor();
    expect(await page.getByTestId("comment-composer").count()).toBe(0);
    await expect.poll(() => pickerActive(frame)).toBe(false);
    expect(await project.store().list({ key: "hostile", status: "all" })).toEqual([]);
    expect(await project.store().list({ status: "all" })).toHaveLength(before);
    await page.close();
  }, 60_000);

  it("E2E-004 (comment on a step): the flow canvas comments the selected step with a node target", async () => {
    const page = await open("/?flow=sign-in&node=error");
    await page.getByTestId("comment-tool").click();
    const dialog = page.getByRole("dialog", { name: /Comment on step 2/ });
    await dialog.waitFor();
    await dialog.getByRole("textbox").fill("The error step needs a retry link.");
    await dialog.getByRole("button", { name: "Comment", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const [comment] = await project.store().list({ key: "flow-sign-in" });
    expect(comment).toMatchObject({
      id: "flow-sign-in-1",
      target: { kind: "node", node: "error", label: "Wrong password" },
      context: { state: "error" },
    });
    await page.close();
  }, 60_000);
});
