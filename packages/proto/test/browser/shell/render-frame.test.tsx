/**
 * Shell side of the shell ⇄ render protocol (`_tests.md` UT-065, IT-018; Safety Invariant 7).
 * This page plays the shell on http://127.0.0.1:<port>; the real render host runs in a
 * cross-origin iframe on http://localhost:<port> with the render suite's harness prototypes
 * (`test/browser/render/harness`). The shell accepts a message only from the iframe it created,
 * from the render origin and with that frame's current nonce.
 */
import "../../../src/shell/theme.css";

import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";

import { protocolVersion } from "../../../src/model/protocol.ts";
import { ScreenFrame } from "../../../src/shell/frames/screen-frame.tsx";
import type { FrameContext } from "../../../src/shell/frames/use-render-frame.ts";
import { LocaleProvider } from "../../../src/shell/lib/i18n.tsx";
import { acceptRenderMessage } from "../../../src/shell/lib/render-channel.ts";
import { ShellDataProvider, type ShellEnv } from "../../../src/shell/lib/shell-data.tsx";
import { bootstrapFor, registry } from "../../harness/fixtures.ts";

const renderOrigin = window.location.origin.replace("127.0.0.1", "localhost");
const renderUrl = `${renderOrigin}/test/browser/render/__proto/render/index.html`;
const slugs = new Set(["card", "standalone-card", "welcome", "broken", "missing"]);

const env: ShellEnv = {
  bootstrap: bootstrapFor({
    renderUrl,
    eventsUrl: null,
    registryUrl: `data:application/json,${encodeURIComponent(JSON.stringify(registry))}`,
  }),
  renderUrl,
  renderOrigin,
};

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function mount(node: ReactNode) {
  const container = document.createElement("div");
  container.style.cssText = "position: fixed; inset: 0; display: flex;";
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <LocaleProvider locale="en">
        <ShellDataProvider env={env}>{node}</ShellDataProvider>
      </LocaleProvider>
    )
  );
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

function frameOf(container: HTMLElement) {
  const iframe = container.querySelector("iframe");
  if (!iframe) throw new Error("No render frame yet");
  return iframe;
}

const nonceOf = (iframe: HTMLIFrameElement) => new URL(iframe.src).searchParams.get("frame") ?? "";

/** A render → shell message as the shell's window receives it. */
function deliver(data: unknown, from: { source: Window | null; origin: string }) {
  window.dispatchEvent(
    new MessageEvent("message", { data, origin: from.origin, source: from.source })
  );
}

const errorMessage = (frame: string) => ({
  proto: protocolVersion,
  frame,
  type: "error",
  message: "Forged failure",
  componentStack: null,
});

describe("acceptRenderMessage", () => {
  test("UT-065 only the shell's own iframe, the render origin and the current nonce count", () => {
    const own = document.createElement("iframe");
    const other = document.createElement("iframe");
    document.body.append(own, other);
    cleanups.push(() => {
      own.remove();
      other.remove();
    });
    const expected = { source: own.contentWindow, origin: renderOrigin, nonce: "current" };
    const ready = {
      proto: protocolVersion,
      frame: "current",
      type: "ready",
      slug: "card",
      state: "default",
    };
    const event = (data: unknown, source: Window | null, origin = renderOrigin) => ({
      data,
      source,
      origin,
    });

    expect(acceptRenderMessage(event(ready, own.contentWindow), expected)).toMatchObject({
      type: "ready",
    });
    expect(acceptRenderMessage(event(ready, other.contentWindow), expected)).toBeNull();
    expect(acceptRenderMessage(event(ready, window), expected)).toBeNull();
    expect(
      acceptRenderMessage(event(ready, own.contentWindow, "http://evil.test"), expected)
    ).toBeNull();
    expect(
      acceptRenderMessage(event({ ...ready, frame: "stale" }, own.contentWindow), expected)
    ).toBeNull();
    expect(
      acceptRenderMessage(event({ ...ready, proto: 2 }, own.contentWindow), expected)
    ).toBeNull();
    expect(
      acceptRenderMessage(event({ ...ready, slug: 7 }, own.contentWindow), expected)
    ).toBeNull();
  });
});

describe("ScreenFrame", () => {
  test("UT-065 messages from another window, another origin or a stale nonce never reach the frame", async () => {
    const container = mount(
      <ScreenFrame
        target={{ slug: "card", state: "default", theme: "light", role: null }}
        width="fit"
        title="Card"
        slugs={slugs}
        className="flex-1"
      />
    );
    await vi.waitFor(() => frameOf(container));
    await vi.waitFor(() => expect(container.querySelector('[role="status"]')).toBeNull(), {
      timeout: 10_000,
    });
    const iframe = frameOf(container);
    const nonce = nonceOf(iframe);
    const foreign = document.createElement("iframe");
    document.body.append(foreign);
    cleanups.push(() => foreign.remove());

    act(() => {
      deliver(errorMessage(nonce), { source: foreign.contentWindow, origin: renderOrigin });
      deliver(errorMessage(nonce), { source: iframe.contentWindow, origin: "http://evil.test" });
      deliver(errorMessage(nonce), {
        source: iframe.contentWindow,
        origin: window.location.origin,
      });
      deliver(errorMessage("stale-nonce"), { source: iframe.contentWindow, origin: renderOrigin });
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(frameOf(container)).toBe(iframe);

    // The same message from the right window, origin and nonce is accepted.
    act(() => deliver(errorMessage(nonce), { source: iframe.contentWindow, origin: renderOrigin }));
    await vi.waitFor(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain("Forged failure")
    );
  });

  test("UT-065 a new target loads a new nonce; the old one is stale", async () => {
    let render!: (state: string) => void;
    function Switcher() {
      const [state, setState] = useState("default");
      render = setState;
      return (
        <ScreenFrame
          target={{ slug: "card", state, theme: "light", role: null }}
          width="fit"
          title="Card"
          slugs={slugs}
          className="flex-1"
        />
      );
    }
    const container = mount(<Switcher />);
    await vi.waitFor(() => frameOf(container));
    const first = nonceOf(frameOf(container));
    act(() => render("b"));
    await vi.waitFor(() => expect(nonceOf(frameOf(container))).not.toBe(first));
    const iframe = frameOf(container);
    act(() => deliver(errorMessage(first), { source: iframe.contentWindow, origin: renderOrigin }));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  test("IT-018 a prototype that throws shows the S16 render-failure card with reload", async () => {
    const container = mount(
      <ScreenFrame
        target={{ slug: "broken", state: "default", theme: "light", role: null }}
        width="fit"
        title="Broken · Default"
        slugs={slugs}
        className="flex-1"
      />
    );
    const alert = await vi.waitFor(
      () => {
        const found = container.querySelector('[role="alert"]');
        if (!found) throw new Error("No render failure yet");
        return found;
      },
      { timeout: 10_000 }
    );
    expect(alert.textContent).toContain("Broken · Default failed to render");
    expect(alert.textContent).toContain("Broken on purpose");
    const reload = [...alert.querySelectorAll("button")].find(button =>
      button.textContent?.includes("Reload state")
    );
    expect(reload).toBeDefined();
    // Reload loads the state again in a fresh frame with a new nonce; it fails again.
    act(() => reload?.click());
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).toBeNull());
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull(), {
      timeout: 10_000,
    });
  });

  test("UT-065 context from the prototype is applied only for known slugs", async () => {
    const contexts: FrameContext[] = [];
    const container = mount(
      <ScreenFrame
        target={{ slug: "card", state: "default", theme: "light", role: null }}
        width="fit"
        title="Card"
        slugs={slugs}
        className="flex-1"
        onContext={context => contexts.push(context)}
      />
    );
    await vi.waitFor(() => frameOf(container));
    await vi.waitFor(() => expect(container.querySelector('[role="status"]')).toBeNull(), {
      timeout: 10_000,
    });
    const iframe = frameOf(container);
    await commands.renderFrameClick(`frame=${nonceOf(iframe)}`, { x: 180, y: 376 });
    await vi.waitFor(() => expect(contexts.at(-1)).toMatchObject({ slug: "card", state: "b" }), {
      timeout: 5000,
    });
    // A context naming an unknown slug is ignored.
    act(() =>
      deliver(
        {
          proto: protocolVersion,
          frame: nonceOf(iframe),
          type: "context",
          state: "x",
          theme: "light",
          role: null,
          url: "/__proto/render/not-a-prototype?state=x",
        },
        { source: iframe.contentWindow, origin: renderOrigin }
      )
    );
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(contexts.every(context => context.slug === "card")).toBe(true);
  });
});
