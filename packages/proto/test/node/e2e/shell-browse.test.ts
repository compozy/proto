/**
 * Browsing journeys of the shell (`_tests.md` E2E-002 to E2E-006, E2E-013) against the real
 * `proto dev`: an isolated copy of `apps/app` (with a temporary review store) and a small fixture
 * with roles, a framed component, a draft, a flow problem and a prototype that throws. The shell
 * is built from source; Playwright Chromium drives it. Assertions own the journeys.
 */
import { appFixture, appFiles } from "../app-fixture.ts";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDev } from "../../../src/node/dev.ts";

import {
  buildShell,
  devWithTempStore,
  renderFrame,
  startProtoDev,
  workDir,
  writeApp,
} from "./shell.ts";

const fixture: Record<string, string> = {
  "proto.config.ts": `export default {
  title: "Browse fixture",
  dev: { poll: true },
  specs: { billing: "Billing" },
  roles: { member: "Member", admin: "Admin" },
};
`,
  "proto.canvas.tsx": `import { useState, type ReactNode } from "react";
export function Canvas({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  return <div data-testid="canvas">{children}
    <button data-testid="canvas-count" onClick={() => setCount(value => value + 1)}>{count}</button></div>;
}
export function Frame({ children, role }: { children: ReactNode; role: string | null }) {
  return <section data-testid="app-frame" data-role={role ?? ""}>{children}</section>;
}
`,
  "src/billing/invoice.tsx": `export function Invoice({ paid, role }: { paid: boolean; role: string | null }) {
  return <p data-testid="invoice">{paid ? "Paid" : "Open"} invoice for {role ?? "nobody"}</p>;
}
`,
  "src/billing/invoice.proto.tsx": `import { definePrototype, type PrototypeProps } from "@compozy/proto";
import { Invoice } from "./invoice";

export const meta = definePrototype({
  title: "Invoice",
  spec: "billing",
  surface: "B1",
  route: "/billing",
  roles: ["member", "admin"],
  states: [
    { id: "open", label: "Open" },
    { id: "paid", label: "Paid" },
  ],
});

export default function Prototype({ state, role }: PrototypeProps) {
  return <Invoice paid={state === "paid"} role={role} />;
}
`,
  "src/billing/broken.tsx": `export function Broken(): never {
  throw new Error("Broken on purpose");
}
`,
  "src/billing/broken.proto.tsx": `import { definePrototype } from "@compozy/proto";
import { Broken } from "./broken";

export const meta = definePrototype({
  title: "Broken",
  spec: "billing",
  standalone: true,
  states: [{ id: "default", label: "Default" }],
});

export default function Prototype() {
  return <Broken />;
}
`,
  "src/drafts/sketch/index.proto.tsx": `import { definePrototype } from "@compozy/proto";

export const meta = definePrototype({
  title: "Sketch",
  states: [{ id: "default", label: "Default" }],
});

export default function Sketch() {
  return <main data-testid="sketch">Sketch</main>;
}
`,
  "flows/pay.flow.ts": `import { defineFlow } from "@compozy/proto/flow";

export const flow = defineFlow({
  title: "Pay",
  spec: "billing",
  start: ["open"],
  nodes: {
    open: { proto: "invoice", state: "open" },
    done: { proto: "invoice", state: "refunded", end: true },
  },
  edges: [["open", "done", { on: "Pay" }]],
});
`,
  "flows/preview.flow.ts": `import { defineFlow } from "@compozy/proto/flow";
export const flow = defineFlow({
  title: "Preview", start: ["open"],
  nodes: { open: { proto: "invoice", state: "open" }, done: { proto: "invoice", state: "paid", end: true } },
  edges: [["open", "done", { on: "Pay" }]],
});`,
};

const work = workDir("shell-browse");
let appCopy: string;
let app: Awaited<ReturnType<typeof devWithTempStore>>;
let local: Awaited<ReturnType<typeof startProtoDev>>;
let browser: Browser;

beforeAll(async () => {
  const shellDir = await buildShell(join(work.dir, "shell"));
  writeApp(join(work.dir, "fixture"), fixture);
  appCopy = appFixture("proto-browse-app-", appFiles);
  app = await devWithTempStore(appCopy, shellDir);
  local = await startProtoDev(join(work.dir, "fixture"), shellDir);
  browser = await chromium.launch();
}, 240_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
  await local?.close();
  work.remove();
  if (appCopy) rmSync(appCopy, { recursive: true, force: true });
});

async function open(origin: string, path: string) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  return page;
}

const search = (page: Page) => new URL(page.url()).searchParams;

describe("browsing apps/app", () => {
  it("E2E-002: login-form states render inside the app's Canvas; the draft renders too", async () => {
    const page = await open(app.origin, "/?p=login-form&state=error");
    let frame = await renderFrame(page, app.renderOrigin, "text=Invalid email or password");
    expect(await frame.$('[data-slot="toast-viewport"]')).not.toBeNull();

    await page.getByRole("combobox", { name: "State" }).click();
    await page.getByRole("option", { name: /Create account/ }).click();
    await expect.poll(() => search(page).get("state")).toBe("sign-up");
    frame = await renderFrame(page, app.renderOrigin, "text=Have an account? Sign in");
    expect(await frame.$('[data-slot="toast-viewport"]')).not.toBeNull();

    await page.goto(`${app.origin}/?p=welcome`, { waitUntil: "domcontentloaded", timeout: 60000 });
    frame = await renderFrame(page, app.renderOrigin, "text=Hello, Ada");
    expect(await frame.$('[data-slot="toast-viewport"]')).not.toBeNull();
    await page.close();
  }, 90_000);

  it("E2E-004: the sign-in flow selects error, shows arrives-from / leads-to and comments the step", async () => {
    const page = await open(app.origin, "/?flow=sign-in");
    await page.locator('.react-flow__node[data-id="error"]').click();
    await expect.poll(() => search(page).get("node")).toBe("error");
    const inspector = page.getByRole("region", { name: "Inspector" });
    await inspector.getByRole("heading", { name: "Wrong password" }).waitFor();
    const arrives = inspector.locator("section", { hasText: "Arrives from" });
    await arrives.getByRole("link", { name: /Submitting\s*Wrong password/ }).waitFor();
    const leads = inspector.locator("section", { hasText: "Leads to" });
    await leads.getByRole("link", { name: /Submit again\s*Submitting/ }).waitFor();

    await page.getByTestId("comment-tool").click();
    const dialog = page.getByRole("dialog", { name: /Comment on step 5/ });
    await dialog.getByRole("textbox").fill("The error step needs a retry link.");
    // Invariant: an offline event cannot pause a reachable loopback mutation. Owner: shell query client.
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    try {
      await dialog.getByRole("button", { name: "Comment", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    }
    const [comment] = await app.store.list({ key: "flow-sign-in" });
    expect(comment).toMatchObject({ target: { kind: "node", node: "error" } });
    await page.getByRole("tab", { name: /Comments/ }).click();
    await page.getByText("The error step needs a retry link.").waitFor();
    await page.close();
  }, 90_000);

  it("E2E-005 / US-010: overview (Needs review, Updated) → spec page → screen", async () => {
    await app.store.add(
      "login-form",
      {
        body: "Title should stay Sign in",
        context: {
          state: "error",
          theme: null,
          role: null,
          viewport: { width: 1440, height: 900 },
        },
        target: { kind: "node", node: null, label: "Sign in" },
      },
      { kind: "reviewer" }
    );
    const page = await open(app.origin, "/");
    const needs = page.getByRole("complementary", { name: "Needs review" });
    await needs.getByText("Title should stay Sign in").waitFor({ timeout: 20_000 });
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("link", { name: "Authentication" }) });
    await card.getByText(/^Updated /).waitFor();

    await card.getByRole("link", { name: "Authentication" }).click();
    await expect.poll(() => search(page).get("spec")).toBe("auth");
    await page.getByRole("heading", { level: 1, name: "Authentication" }).waitFor();
    const screen = page.getByRole("article").filter({ hasText: "/login · login-form" });
    await screen.getByRole("heading", { name: "Sign in" }).getByRole("link").click();
    await expect.poll(() => search(page).get("p")).toBe("login-form");
    await renderFrame(page, app.renderOrigin, "text=Sign in");
    await page.close();
  }, 90_000);

  it("E2E-006 / US-015: ⌘K 'wrong' + Enter opens login-form at error; ? shows the shortcuts", async () => {
    const page = await open(app.origin, "/");
    await page.getByRole("banner").waitFor();
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Search" });
    await palette.getByRole("combobox").fill("wrong");
    await palette
      .getByRole("option", { name: /Wrong password/ })
      .first()
      .waitFor();
    await page.keyboard.press("Enter");
    await expect.poll(() => search(page).get("p")).toBe("login-form");
    expect(search(page).get("state")).toBe("error");

    await page.locator("body").click({ position: { x: 5, y: 600 } });
    await page.keyboard.press("Shift+Slash");
    await page.getByRole("dialog", { name: "Keyboard shortcuts" }).waitFor();
    await page.close();
  }, 90_000);
});

describe("browsing a fixture", () => {
  it("reconnecting the event stream reconciles edits missed while the server was offline", async () => {
    // Invariant: an infinite-stale-time registry must reconcile lost events after reconnect.
    // Owner: shell event/cache lifecycle; actual EventSource, Chromium network and dev watcher.
    const page = await browser.newPage();
    const root = join(work.dir, "reconnect");
    writeApp(root, fixture);
    let server = await startProtoDev(root, join(work.dir, "shell"));
    const flowPath = join(root, "flows/preview.flow.ts");
    try {
      const connected = page.waitForResponse(response =>
        response.url().endsWith("/__proto/api/events")
      );
      await page.goto(server.origin + "/?flow=preview");
      await connected;
      await page.getByRole("heading", { level: 1, name: "Preview journey", exact: true }).waitFor();
      await server.close();
      writeFileSync(
        flowPath,
        fixture["flows/preview.flow.ts"]!.replace('title: "Preview"', 'title: "Offline edit"')
      );
      const restarted = await startDev(server.project, {
        port: Number(new URL(server.origin).port),
        shellDir: join(work.dir, "shell"),
        quiet: true,
      });
      server = { ...server, ...restarted };
      await page
        .getByRole("heading", { level: 1, name: "Offline edit journey", exact: true })
        .waitFor({ timeout: 15_000 });
    } finally {
      await page.close();
      await server.close();
    }
  }, 90_000);

  it("a failed lazy page offers a retry that loads the page after the network recovers", async () => {
    // Invariant: a rejected dynamic import never blanks the gallery and retry starts a fresh module load.
    // Owner: shell page boundary; canonical browsing suite, only chunk transport is interrupted.
    const page = await browser.newPage();
    const chunk = "**/assets/flow-page-*.js";
    await page.route(chunk, route => route.abort("failed"));
    try {
      await page.goto(local.origin + "/?flow=preview");
      await page.getByRole("alert").filter({ hasText: "This page could not load" }).waitFor();
      await page.unroute(chunk);
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await page.getByRole("heading", { level: 1, name: "Preview journey", exact: true }).waitFor();
    } finally {
      await page.close();
    }
  }, 90_000);

  it("creating and removing the canvas updates its virtual module without a server restart", async () => {
    // Invariant: canvas existence is an independent render dependency. Owner: Vite virtual canvas.
    const root = join(work.dir, "canvas-lifecycle");
    const { ["proto.canvas.tsx"]: canvas, ...withoutCanvas } = fixture;
    writeApp(root, withoutCanvas);
    const server = await startProtoDev(root, join(work.dir, "shell"));
    const page = await open(server.origin, "/?p=invoice");
    const path = join(root, "proto.canvas.tsx");
    try {
      const initial = await renderFrame(page, server.renderOrigin, '[data-testid="invoice"]');
      expect(await initial.locator('[data-testid="canvas"]').count()).toBe(0);
      writeFileSync(path, canvas!);
      await expect
        .poll(
          async () => {
            const current = page
              .frames()
              .find(frame => frame.url().startsWith(server.renderOrigin));
            return current?.locator('[data-testid="canvas"] [data-testid="invoice"]').count();
          },
          { timeout: 20_000 }
        )
        .toBe(1);
      rmSync(path);
      await expect
        .poll(
          async () => {
            const current = page
              .frames()
              .find(frame => frame.url().startsWith(server.renderOrigin));
            return current?.evaluate(
              () =>
                Boolean(document.querySelector('[data-testid="invoice"]')) &&
                !document.querySelector('[data-testid="canvas"]')
            );
          },
          { timeout: 20_000 }
        )
        .toBe(true);
    } finally {
      await page.close();
      await server.close();
    }
  }, 90_000);

  it("flow and prototype edits update live previews without reloading their documents", async () => {
    // Invariant: authored updates preserve iframe documents; owner: Vite render HMR.
    const page = await open(local.origin, "/?flow=preview");
    const flowPath = join(work.dir, "fixture/flows/preview.flow.ts");
    const prototypePath = join(work.dir, "fixture/src/billing/invoice.proto.tsx");
    try {
      const frame = await renderFrame(page, local.renderOrigin, '[data-testid="invoice"]');
      const timeOrigin = await frame.evaluate(() => performance.timeOrigin);
      // Invariant: unchanged Canvas state survives prototype replacement; owner: render host boundary.
      await frame
        .getByTestId("canvas-count")
        .evaluate(button => (button as HTMLButtonElement).click());
      await expect.poll(() => frame.getByTestId("canvas-count").textContent()).toBe("1");
      const address = frame.url();
      let loads = 0;
      page.on("request", request => {
        if (request.isNavigationRequest() && request.url().startsWith(local.renderOrigin)) loads++;
      });
      writeFileSync(
        flowPath,
        fixture["flows/preview.flow.ts"]!.replace('title: "Preview"', 'title: "Preview updated"')
      );
      await page
        .getByRole("heading", { level: 1, name: "Preview updated journey", exact: true })
        .waitFor();
      const registryRefresh = page.waitForResponse(response =>
        response.url().endsWith("/__proto/api/registry")
      );
      writeFileSync(
        prototypePath,
        fixture["src/billing/invoice.proto.tsx"]!.replace('paid={state === "paid"}', "paid={true}")
      );
      await registryRefresh;
      await frame.getByText("Paid invoice for member", { exact: true }).waitFor();
      writeFileSync(
        prototypePath,
        fixture["src/billing/invoice.proto.tsx"]!.replace(
          'paid={state === "paid"}',
          "paid={true}"
        ).replace('title: "Invoice"', 'title: "Invoice updated"')
      );
      await expect.poll(() => frame.title()).toBe("Invoice updated");
      await expect.poll(() => frame.getByTestId("canvas-count").textContent()).toBe("1");
      expect(frame.url()).toBe(address);
      expect(await frame.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
      expect(loads).toBe(0);
    } finally {
      writeFileSync(flowPath, fixture["flows/preview.flow.ts"]!);
      writeFileSync(prototypePath, fixture["src/billing/invoice.proto.tsx"]!);
      await page.close();
    }
  }, 90_000);

  it("an interactive prototype cannot navigate the surrounding gallery", async () => {
    // Invariant: user activation inside the render origin cannot navigate the shell's top window.
    // Owner: iframe sandbox policy; canonical Chromium browsing suite with an actual frame click.
    const page = await open(local.origin, "/?p=invoice");
    try {
      const frame = await renderFrame(page, local.renderOrigin, '[data-testid="invoice"]');
      const address = page.url();
      await frame.evaluate(destination => {
        const button = document.createElement("button");
        button.textContent = "Attempt top navigation";
        button.onclick = () => {
          try {
            window.top!.location.href = destination;
          } catch (error) {
            button.dataset.result = (error as Error).name;
          }
        };
        document.body.append(button);
      }, `${address}&escaped=1`);
      const button = frame.getByRole("button", { name: "Attempt top navigation" });
      await button.click();
      await expect.poll(() => button.getAttribute("data-result")).toBe("SecurityError");
      expect(page.url()).toBe(address);
    } finally {
      await page.close();
    }
  }, 90_000);

  it("ready flow previews survive zooming out and back without loading another document", async () => {
    // Invariant: zoom changes presentation, not the lifetime of an already loaded preview.
    // Owner: flow canvas / preview scheduler; canonical real-browser browsing journey.
    const page = await open(local.origin, "/?flow=preview");
    const preview = page.locator('.react-flow__node[data-id="open"] iframe');
    const zoomOut = page.getByRole("button", { name: "Zoom out", exact: true });
    const zoomIn = page.getByRole("button", { name: "Zoom in", exact: true });
    const zoom = async () => {
      const text = await zoomOut.locator("..").textContent();
      return Number(text?.match(/(\d+)%/)?.[1]);
    };
    while ((await zoom()) < 70) {
      const before = await zoom();
      await zoomIn.click();
      await expect.poll(zoom).toBeGreaterThan(before);
    }
    await renderFrame(page, local.renderOrigin, '[data-testid="invoice"]');
    const source = await preview.getAttribute("src");
    let loads = 0;
    page.on("request", request => {
      if (request.isNavigationRequest() && request.url().startsWith(local.renderOrigin)) loads++;
    });
    while ((await zoom()) >= 60) {
      const before = await zoom();
      await zoomOut.click();
      await expect.poll(zoom).toBeLessThan(before);
    }
    expect(await preview.count()).toBe(1);
    while ((await zoom()) < 70) {
      const before = await zoom();
      await zoomIn.click();
      await expect.poll(zoom).toBeGreaterThan(before);
    }
    await renderFrame(page, local.renderOrigin, '[data-testid="invoice"]');
    expect(await preview.getAttribute("src")).toBe(source);
    expect(loads).toBe(0);
    await page.close();
  }, 90_000);

  it("E2E-002: component prototypes render inside Frame with the role; drafts without Frame", async () => {
    const page = await open(local.origin, "/?p=invoice&state=paid&role=admin");
    const frame = await renderFrame(page, local.renderOrigin, '[data-testid="invoice"]');
    expect(
      await frame.$eval('[data-testid="app-frame"]', node => node.getAttribute("data-role"))
    ).toBe("admin");
    expect(
      await frame.$('[data-testid="canvas"] [data-testid="app-frame"] [data-testid="invoice"]')
    ).not.toBeNull();

    await page.goto(`${local.origin}/?p=sketch`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const draft = await renderFrame(page, local.renderOrigin, '[data-testid="sketch"]');
    expect(await draft.$('[data-testid="canvas"] [data-testid="sketch"]')).not.toBeNull();
    expect(await draft.$('[data-testid="app-frame"]')).toBeNull();
    await page.close();
  }, 90_000);

  it("E2E-003 / US-013, US-014: state, width, theme and role live in the URL; reload reproduces; compare shows both themes", async () => {
    const page = await open(local.origin, "/?p=invoice");
    await renderFrame(page, local.renderOrigin, '[data-testid="invoice"]');
    await page.getByRole("combobox", { name: "State" }).click();
    await page.getByRole("option", { name: /Paid/ }).click();
    await page.getByRole("button", { name: "Tablet, 834 px" }).click();
    await page.getByRole("button", { name: /Dark theme/ }).click();
    await page.getByLabel("Role").selectOption("admin");
    await expect
      .poll(() => search(page).toString())
      .toBe("p=invoice&state=paid&w=834&role=admin&theme=dark");

    const view = page.url();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    expect(page.url()).toBe(view);
    const frame = await renderFrame(page, local.renderOrigin, "text=Paid invoice for admin");
    const src = new URL(frame.url());
    expect(
      Object.fromEntries(
        ["state", "theme", "role", "w"].map(key => [key, src.searchParams.get(key)])
      )
    ).toEqual({
      state: "paid",
      theme: "dark",
      role: "admin",
      w: "834",
    });
    expect(await page.getByRole("combobox", { name: "State" }).textContent()).toContain("Paid");
    expect(
      await page
        .locator("iframe")
        .first()
        .evaluate(node => (node as HTMLIFrameElement).style.width)
    ).toBe("834px");

    await page.getByRole("tab", { name: "Compare" }).click();
    await expect.poll(() => search(page).get("compare")).toBe("themes");
    await expect
      .poll(() =>
        page
          .frames()
          .filter(item => item.url().startsWith(local.renderOrigin))
          .map(item => new URL(item.url()).searchParams.get("theme"))
          .sort()
      )
      .toEqual(["dark", "light"]);
    await page.close();
  }, 90_000);

  it("E2E-013 / US-032, US-033: a problem shows the badge and Health; a throwing prototype shows the error card", async () => {
    const page = await open(local.origin, "/");
    const badge = page.getByRole("link", { name: "1 problem: open Health" });
    await badge.click();
    await page.getByRole("heading", { level: 1, name: "Health" }).waitFor();
    await page.getByText("unknown_state").waitFor();
    await page.getByText("flows/pay.flow.ts").waitFor();

    await page.goto(`${local.origin}/?p=broken`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const card = page.getByRole("alert").filter({ hasText: "failed to render" });
    await card.getByText("Broken on purpose").waitFor({ timeout: 20_000 });
    await card.getByRole("button", { name: "Reload state" }).waitFor();
    await page.close();
  }, 90_000);
});
