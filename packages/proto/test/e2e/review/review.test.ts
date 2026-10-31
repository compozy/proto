/**
 * Review journeys of the shell (`_tests.md` E2E-008, E2E-009 and the shell half of IT-029)
 * against the real `proto dev` of `apps/app`: the prebuilt shell, the render server and the
 * review router over a FileStore in a temporary directory. Agents write through the store, as
 * the CLI does; the shell sees their writes over SSE.
 */
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { NewComment } from "../../../src/model/review.ts";
import { startReviewDev } from "./server.ts";

let server: Awaited<ReturnType<typeof startReviewDev>>;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await startReviewDev();
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  return () => page.close();
});

function comment(state: string, body: string): NewComment {
  return {
    body,
    context: { state, theme: "light", role: null, viewport: { width: 1440, height: 900 } },
    target: {
      kind: "element",
      selector: "main",
      testId: null,
      tag: "main",
      text: "",
      source: "src/components/login-form.tsx:12:5",
      sourceChain: ["src/components/login-form.tsx:12:5"],
      rect: { x: 100, y: 100, width: 200, height: 40 },
      rectNormalized: { x: 0.1, y: 0.2, width: 0.2, height: 0.05 },
      offset: null,
    },
  };
}

const reviewer = { kind: "reviewer" } as const;
const agent = { kind: "agent" } as const;

describe("review journeys", () => {
  test("E2E-008 approving with an open comment asks for confirmation; a new comment reopens", async () => {
    await server.store.add("login-form", comment("error", "Spacing too tight"), reviewer);
    await page.goto(`${server.origin}/?p=login-form&state=error`);
    const banner = page.getByRole("banner");
    await expect.poll(() => banner.getByText("1 open").isVisible()).toBe(true);

    await banner.getByRole("button", { name: "Approve" }).click();
    const dialog = page.getByRole("dialog", { name: "Approve Sign in?" });
    await dialog.getByText("1 comment is still open.").waitFor();
    await dialog.getByRole("button", { name: "Approve anyway" }).click();
    await banner.getByText("Approved", { exact: true }).waitFor();
    const approved = await server.store.review("login-form");
    expect(approved).toMatchObject({ status: "approved", open: 1 });
    expect(approved.events.at(-1)).toMatchObject({ type: "approved", openCount: 1 });

    // A new comment (here written by an agent, as the CLI does) moves it back to review.
    await server.store.add("login-form", comment("error", "Still too tight"), agent);
    await banner.getByRole("button", { name: "Approve" }).waitFor({ timeout: 10_000 });
    await expect.poll(() => banner.getByText("2 open").isVisible()).toBe(true);
    const reopened = await server.store.review("login-form");
    expect(reopened.status).toBe("in_review");
    expect(reopened.events.at(-1)).toMatchObject({ type: "auto_reopened" });
  });

  test("E2E-009 the inbox lists the agent-replied thread under Waiting and opens it in context", async () => {
    const added = await server.store.add(
      "welcome",
      comment("default", "Steps need icons"),
      reviewer
    );
    await page.goto(`${server.origin}/?comments=waiting`);
    const list = page.getByRole("tab", { name: /Waiting · 0/ });
    await list.waitFor();

    await server.store.reply(added.id, { body: "Added an icon per step." }, agent);
    const item = page.getByRole("button", { name: /Steps need icons/ });
    await item.waitFor({ timeout: 10_000 });
    await expect
      .poll(() => item.getByText("Agent replied · waiting for you").isVisible())
      .toBe(true);

    await item.click();
    await page.getByRole("link", { name: "Open in context" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("comment")).toBe(added.id);
    expect(new URL(page.url()).searchParams.get("p")).toBe("welcome");
    const thread = page.getByRole("article", { name: `Comment #${added.id.split("-").at(-1)}` });
    await expect.poll(() => thread.getAttribute("aria-current")).toBe("true");
    await expect
      .poll(() => page.getByRole("tab", { name: /Comments/ }).getAttribute("aria-selected"))
      .toBe("true");
  });

  test("IT-029 an expired session keeps the unsent reply and offers to sign in again", async () => {
    const added = await server.store.add(
      "login-form",
      comment("sign-in", "Button too wide"),
      reviewer
    );
    await page.route("**/__proto/api/comments/*/replies", route =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "auth_required", message: "Sign in to review.", signInUrl: "/sign-in" },
        }),
      })
    );
    await page.goto(`${server.origin}/?p=login-form&state=sign-in&comment=${added.id}`);
    const reply = page.getByRole("textbox", { name: "Reply…" });
    await reply.fill("Narrowed it to the form width.");
    await page.getByRole("button", { name: "Reply", exact: true }).click();

    const expired = page.getByRole("alert").filter({ hasText: "Your session expired." });
    await expired.waitFor();
    expect(await expired.getByRole("link", { name: "Sign in again" }).getAttribute("href")).toMatch(
      /^\/sign-in\?returnTo=/
    );
    expect(await reply.inputValue()).toBe("Narrowed it to the form width.");

    // The draft survives the round trip through sign-in (a reload of the same URL).
    await page.unroute("**/__proto/api/comments/*/replies");
    await page.reload();
    await expect
      .poll(() => page.getByRole("textbox", { name: "Reply…" }).inputValue())
      .toBe("Narrowed it to the form width.");
    expect((await server.store.get(added.id)).thread).toHaveLength(1);
  });
});
