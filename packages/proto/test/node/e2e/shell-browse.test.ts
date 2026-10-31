/**
 * Browsing journeys of the shell (`_tests.md` E2E-002 to E2E-006, E2E-013) against the real
 * `proto dev`: an isolated copy of `apps/app` (with a temporary review store) and a small fixture
 * with roles, a framed component, a draft, a flow problem and a prototype that throws. The shell
 * is built from source; Playwright Chromium drives it. Assertions own the journeys.
 */
import { appFixture, appFiles } from "../app-fixture.ts";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  specs: { billing: "Billing" },
  roles: { member: "Member", admin: "Admin" },
};
`,
  "proto.canvas.tsx": `import type { ReactNode } from "react";
export function Canvas({ children }: { children: ReactNode }) {
  return <div data-testid="canvas">{children}</div>;
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
  await page.goto(`${origin}${path}`);
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

    await page.goto(`${app.origin}/?p=welcome`);
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
    await dialog.getByRole("button", { name: "Comment", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
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
  it("E2E-002: component prototypes render inside Frame with the role; drafts without Frame", async () => {
    const page = await open(local.origin, "/?p=invoice&state=paid&role=admin");
    const frame = await renderFrame(page, local.renderOrigin, '[data-testid="invoice"]');
    expect(
      await frame.$eval('[data-testid="app-frame"]', node => node.getAttribute("data-role"))
    ).toBe("admin");
    expect(
      await frame.$('[data-testid="canvas"] [data-testid="app-frame"] [data-testid="invoice"]')
    ).not.toBeNull();

    await page.goto(`${local.origin}/?p=sketch`);
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
    await page.reload();
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

    await page.goto(`${local.origin}/?p=broken`);
    const card = page.getByRole("alert").filter({ hasText: "failed to render" });
    await card.getByText("Broken on purpose").waitFor({ timeout: 20_000 });
    await card.getByRole("button", { name: "Reload state" }).waitFor();
    await page.close();
  }, 90_000);
});
