/**
 * Render side of the shell ⇄ render protocol (`_spec.md` § Shell ⇄ render protocol, ADR-008,
 * Safety Invariant 7). This page plays the shell on http://127.0.0.1:<port>; the render host
 * runs in a real cross-origin iframe on http://localhost:<port> (`__proto/render/index.html`,
 * the static query form) with the harness modules behind the three virtual module ids. The
 * frame's DOM and input are reached through Playwright (`harness/commands.ts`).
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";

import {
  protocolVersion,
  readContextUrl,
  renderMessageSchema,
  type ElementTarget,
  type RenderMessage,
  type ShellMessage,
} from "../../../src/model/protocol.ts";
import { resolveSlug } from "../../../src/render/host.tsx";

const renderOrigin = window.location.origin.replace("127.0.0.1", "localhost");
const renderPath = "/test/browser/render/__proto/render/index.html";
const slugs = new Set(["card", "standalone-card", "welcome", "broken", "missing"]);

type Outgoing = ShellMessage extends infer M
  ? M extends ShellMessage
    ? Omit<M, "proto" | "frame">
    : never
  : never;
type Of<T extends RenderMessage["type"]> = Extract<RenderMessage, { type: T }>;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

let count = 0;

function mount(params: Record<string, string>, size = { width: 600, height: 500 }) {
  count += 1;
  const frame = `nonce-${count}`;
  const query = new URLSearchParams({ n: String(count), chrome: "0", ...params, frame });
  const iframe = document.createElement("iframe");
  iframe.src = `${renderOrigin}${renderPath}?${query}`;
  iframe.style.cssText = `position: fixed; left: 0; top: 0; border: 0; width: ${size.width}px; height: ${size.height}px`;
  const messages: RenderMessage[] = [];
  const invalid: unknown[] = [];
  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow || event.origin !== renderOrigin) return;
    const parsed = renderMessageSchema.safeParse(event.data);
    if (parsed.success) messages.push(parsed.data);
    else invalid.push(event.data);
  };
  window.addEventListener("message", onMessage);
  document.body.append(iframe);
  cleanups.push(() => {
    window.removeEventListener("message", onMessage);
    iframe.remove();
  });
  const match = `?n=${count}&`;
  const send = (message: Outgoing, nonce = frame) =>
    iframe.contentWindow?.postMessage(
      { ...message, proto: protocolVersion, frame: nonce },
      renderOrigin
    );
  const waitFor = <T extends RenderMessage["type"]>(
    type: T,
    predicate: (message: Of<T>) => boolean = () => true
  ) =>
    vi.waitFor(
      () => {
        const found = messages.find(
          (message): message is Of<T> => message.type === type && predicate(message as Of<T>)
        );
        if (!found) throw new Error(`No ${type} message yet`);
        return found;
      },
      { timeout: 8000, interval: 50 }
    );
  const evaluate = <T>(expression: string) =>
    commands.renderFrameEval(match, expression) as Promise<T>;
  return {
    iframe,
    frame,
    messages,
    invalid,
    send,
    waitFor,
    evaluate,
    click: (x: number, y: number) => commands.renderFrameClick(match, { x, y }),
    drag: (from: [number, number], to: [number, number]) =>
      commands.renderFrameDrag(match, { x: from[0], y: from[1] }, { x: to[0], y: to[1] }),
    keys: (keys: string[]) => commands.renderFrameKeys(match, keys),
    pickerShown: () =>
      evaluate<boolean>(`Boolean(document.querySelector('[data-testid="proto-picker"]'))`),
  };
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function expectConfined(target: ElementTarget) {
  for (const source of target.sourceChain) {
    expect(source).toMatch(/^src\/[^:]+:\d+:\d+$/);
    expect(source).not.toContain("..");
  }
}

describe("render host", () => {
  test("the slug comes from the path (dev, remote) or from ?slug= (static build)", () => {
    const at = (pathname: string, search = "") => ({ pathname, search });
    expect(resolveSlug(at("/__proto/render/login-form"), "path")).toBe("login-form");
    expect(resolveSlug(at("/proto/__proto/render/login-form/"), "path")).toBe("login-form");
    expect(resolveSlug(at("/__proto/render/"), "path")).toBeNull();
    expect(resolveSlug(at("/__proto/render/a/b"), "path")).toBeNull();
    expect(resolveSlug(at("/__proto/render/index.html", "?slug=card"), "query")).toBe("card");
  });

  test("IT-013: component prototypes render in Frame inside Canvas; drafts and standalone do not", async () => {
    const component = mount({ slug: "card", role: "member", theme: "dark" });
    await component.waitFor("ready", message => message.slug === "card");
    expect(
      await component.evaluate(`(() => {
        const frame = document.querySelector('[data-testid="canvas"] > [data-testid="frame"]');
        return frame && {
          route: frame.dataset.route, role: frame.dataset.role, state: frame.dataset.state,
          theme: document.querySelector('[data-testid="canvas"]').dataset.theme,
          inside: Boolean(frame.querySelector('[data-testid="card"]')),
        };
      })()`)
    ).toEqual({ route: "/cards", role: "member", state: "default", theme: "dark", inside: true });

    for (const slug of ["standalone-card", "welcome"]) {
      const bare = mount({ slug });
      await bare.waitFor("ready", message => message.slug === slug);
      expect(
        await bare.evaluate(`({
          frame: Boolean(document.querySelector('[data-testid="frame"]')),
          inCanvas: Boolean(document.querySelector('[data-testid="canvas"] > [data-testid="plain"]')),
        })`)
      ).toEqual({ frame: false, inCanvas: true });
    }
  });

  test("an unknown state renders the first state and an undeclared role the first declared role", async () => {
    const host = mount({ slug: "card", state: "nope", role: "intruder" });
    const ready = await host.waitFor("ready");
    expect(ready).toMatchObject({ slug: "card", state: "default" });
    expect(await host.evaluate(`document.querySelector('[data-testid="card"]').dataset.role`)).toBe(
      "admin"
    );
  });

  test("IT-018: a throwing prototype posts error with its component stack and never ready", async () => {
    const broken = mount({ slug: "broken" });
    const error = await broken.waitFor("error");
    expect(error.message).toContain("Broken on purpose");
    expect(error.componentStack).toContain("Broken");
    expect(broken.messages.some(message => message.type === "ready")).toBe(false);

    const missing = mount({ slug: "missing" });
    const failed = await missing.waitFor("error");
    expect(failed).toMatchObject({ message: "Error: Chunk failed", componentStack: null });
  });
});

describe("protocol trust", () => {
  test("UT-065: messages from another window, with a stale nonce or an invalid payload are ignored", async () => {
    const host = mount({ slug: "card" });
    await host.waitFor("ready");

    const sibling = document.createElement("iframe");
    document.body.append(sibling);
    cleanups.push(() => sibling.remove());
    const siblingWindow = sibling.contentWindow as Window & { Function: FunctionConstructor };
    const postFromSibling = siblingWindow.Function(
      "target",
      "message",
      "origin",
      "target.postMessage(message, origin)"
    );
    postFromSibling(
      host.iframe.contentWindow,
      { proto: 1, frame: host.frame, type: "pick:start", mode: "element" },
      renderOrigin
    );
    host.send({ type: "pick:start", mode: "element" }, "stale-nonce");
    host.iframe.contentWindow?.postMessage(
      { proto: 1, frame: host.frame, type: "pick:start", mode: "lasso" },
      renderOrigin
    );
    await wait(500);
    expect(await host.pickerShown()).toBe(false);

    host.send({ type: "pick:start", mode: "element" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(true));
  });

  test("UT-091: the host ignores a parent whose origin is not its configured shell origin, even when the URL names it", async () => {
    const foreign = document.createElement("iframe");
    foreign.src = `${renderOrigin}/test/browser/render/harness/foreign.html`;
    foreign.style.cssText =
      "position: fixed; left: 0; top: 0; width: 600px; height: 500px; border: 0";
    document.body.append(foreign);
    cleanups.push(() => foreign.remove());

    const match = "foreign=1";
    await vi.waitFor(
      async () =>
        expect(
          await commands.renderFrameEval(
            match,
            `Boolean(document.querySelector('[data-testid="card"]'))`
          )
        ).toBe(true),
      { timeout: 8000 }
    );
    await wait(1500);
    expect(
      await commands.renderFrameEval(
        match,
        `Boolean(document.querySelector('[data-testid="proto-picker"]'))`
      )
    ).toBe(false);
    expect(await commands.renderFrameEval("harness/foreign.html", "window.received.length")).toBe(
      0
    );
  });
});

describe("picking", () => {
  test("UT-070: pick:result carries selector, testId, tag, text ≤ 120, confined sources ≤ 8 and rects", async () => {
    const host = mount({ slug: "card" });
    await host.waitFor("ready");

    host.send({ type: "pick:start", mode: "element" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(true));
    await host.click(44, 44);
    const button = (await host.waitFor("pick:result")).target;
    expect(button).toMatchObject({
      kind: "element",
      selector: '[data-testid="save"]',
      testId: "save",
      tag: "button",
      text: "Save changes",
      source: "src/components/card.tsx:3:5",
      sourceChain: ["src/components/card.tsx:3:5"],
      rect: { x: 40, y: 40, width: 120, height: 32 },
      rectNormalized: { x: 40 / 600, y: 40 / 500, width: 120 / 600, height: 32 / 500 },
      offset: null,
    });
    expect(await host.pickerShown()).toBe(false);

    host.messages.length = 0;
    host.send({ type: "pick:start", mode: "element" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(true));
    await host.click(100, 56);
    const label = (await host.waitFor("pick:result")).target;
    expect(label).toMatchObject({
      selector: '[data-testid="save"] > span',
      testId: "save",
      tag: "span",
      source: "src/components/card.tsx:9:9",
      sourceChain: ["src/components/card.tsx:9:9", "src/components/card.tsx:3:5"],
    });

    host.messages.length = 0;
    host.send({ type: "pick:start", mode: "element" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(true));
    await host.click(210, 50);
    const long = (await host.waitFor("pick:result")).target;
    expect(long.testId).toBe("long");
    expect(long.text.length).toBe(120);
    expect(long.text.endsWith("…")).toBe(true);

    host.messages.length = 0;
    host.send({ type: "pick:start", mode: "element" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(true));
    await host.click(405, 125);
    const deep = (await host.waitFor("pick:result")).target;
    expect(deep.sourceChain).toHaveLength(8);
    expect(deep.source).toBe(deep.sourceChain[0]);
    for (const target of [button, label, long, deep]) expectConfined(target);
  });
});

describe("IT-027: render half of the protocol", () => {
  test("a region drag picks the containing element with the region and its offset", async () => {
    const host = mount({ slug: "card" });
    await host.waitFor("ready");
    host.send({ type: "pick:start", mode: "region" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(true));
    await host.drag([70, 140], [190, 240]);
    const region = (await host.waitFor("pick:result")).target;
    expect(region).toMatchObject({
      kind: "region",
      selector: '[data-testid="panel"]',
      testId: "panel",
      rect: { x: 70, y: 140, width: 120, height: 100 },
      offset: { x: 30 / 300, y: 20 / 200, width: 120 / 300, height: 100 / 200 },
    });
    expect(region.sourceChain).toContain("src/components/panel.tsx:2:3");
    expectConfined(region);
  });

  test("keyboard mode moves a crosshair with the arrows and picks with Enter; Escape cancels", async () => {
    const host = mount({ slug: "card" });
    await host.waitFor("ready");
    host.iframe.focus();
    host.send({ type: "pick:start", mode: "keyboard" });
    await vi.waitFor(async () =>
      expect(await host.evaluate(`document.activeElement?.dataset.testid`)).toBe("proto-picker")
    );
    // The crosshair starts at the viewport center (300, 250); five large steps up reach y = 50.
    await host.keys([
      "Shift+ArrowUp",
      "Shift+ArrowUp",
      "Shift+ArrowUp",
      "Shift+ArrowUp",
      "Shift+ArrowUp",
      "Enter",
    ]);
    const picked = (await host.waitFor("pick:result")).target;
    expect(picked).toMatchObject({ kind: "element", testId: "long" });

    host.iframe.focus();
    host.send({ type: "pick:start", mode: "keyboard" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(true));
    await host.keys(["Escape"]);
    await host.waitFor("pick:cancel");
    expect(await host.pickerShown()).toBe(false);
  });

  test("pick:cancel from the shell ends the pick", async () => {
    const host = mount({ slug: "card" });
    await host.waitFor("ready");
    host.send({ type: "pick:start", mode: "element" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(true));
    host.send({ type: "pick:cancel" });
    await vi.waitFor(async () => expect(await host.pickerShown()).toBe(false));
  });

  test("anchors:watch reports rects, then again on resize and scroll; a missing anchor is null", async () => {
    const host = mount({ slug: "card" });
    await host.waitFor("ready");
    host.send({
      type: "anchors:watch",
      anchors: [
        { id: "save", selector: '[data-testid="save"]', testId: "save", offset: null },
        {
          id: "panel",
          selector: '[data-testid="panel"]',
          testId: "panel",
          offset: { x: 0.5, y: 0, width: 0.5, height: 0.5 },
        },
        { id: "gone", selector: '[data-testid="gone"]', testId: null, offset: null },
        { id: "by-test-id", selector: "main > nav", testId: "save", offset: null },
      ],
    });
    const first = await host.waitFor("anchors");
    expect(first.rects).toEqual([
      { id: "save", rect: { x: 40, y: 40, width: 120, height: 32 } },
      { id: "panel", rect: { x: 190, y: 120, width: 150, height: 100 } },
      { id: "gone", rect: null },
      { id: "by-test-id", rect: { x: 40, y: 40, width: 120, height: 32 } },
    ]);

    host.iframe.style.width = "400px";
    const resized = await host.waitFor("anchors", message => message.rects[1]?.rect?.width === 100);
    expect(resized.rects[1]?.rect).toEqual({ x: 140, y: 120, width: 100, height: 100 });

    host.send({ type: "scroll:to", selector: '[data-testid="far"]' });
    const scrolled = await host.waitFor(
      "anchors",
      message => (message.rects[0]?.rect?.y ?? 40) < 0
    );
    expect(scrolled.rects[0]?.rect?.x).toBe(40);
  });

  test("setParam posts context with the new URL; a state change while picking keeps the pick", async () => {
    const host = mount({ slug: "card", role: "member" });
    await host.waitFor("ready");
    await host.click(80, 376);
    const context = await host.waitFor("context");
    expect(context).toMatchObject({ state: "default", theme: "light", role: "member" });
    expect(new URL(context.url, renderOrigin).searchParams.get("tab")).toBe("2");
    expect(readContextUrl(context.url, slugs)).toMatchObject({ slug: "card", role: "member" });

    host.messages.length = 0;
    await host.click(180, 376);
    host.send({ type: "pick:start", mode: "element" });
    const changed = await host.waitFor("context", message => message.state === "b");
    expect(readContextUrl(changed.url, slugs)).toMatchObject({ slug: "card", state: "b" });
    await host.waitFor("ready", message => message.state === "b");
    expect(await host.pickerShown()).toBe(true);
    await host.click(44, 44);
    expect((await host.waitFor("pick:result")).target.testId).toBe("save");
  });
});
