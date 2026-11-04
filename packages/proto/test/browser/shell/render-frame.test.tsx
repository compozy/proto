/**
 * Shell side of the shell ⇄ render protocol (`_tests.md` UT-065, IT-018, IT-021; Safety
 * Invariants 2 and 7). This page plays the shell on http://127.0.0.1:<port>; the real render
 * host runs in a cross-origin iframe on http://localhost:<port> with the render suite's harness
 * prototypes (`test/browser/render/harness`). The shell accepts a message only from the iframe
 * it created, from its target's root origin (the render host, or a story root's server) and
 * with that frame's current nonce.
 */
import "../../../src/shell/theme.css";

import { act, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { RenderErrorCard } from "../../../src/shell/frames/frame-status.tsx";

import {
  protocolVersion,
  type RenderMessage,
  type StoryFrameTarget,
} from "../../../src/model/protocol.ts";
import { ScreenFrame } from "../../../src/shell/frames/screen-frame.tsx";
import { useRenderFrame, type FrameContext } from "../../../src/shell/frames/use-render-frame.ts";
import { LocaleProvider } from "../../../src/shell/lib/i18n.tsx";
import {
  acceptRenderMessage,
  initialStatus,
  nextStatus,
  type FrameStatus,
} from "../../../src/shell/lib/render-channel.ts";
import { ShellDataProvider, type ShellEnv } from "../../../src/shell/lib/shell-data.tsx";
import { ReviewProvider } from "../../../src/shell/review/data.tsx";
import { PlayStatus } from "../../../src/shell/pages/story-page.tsx";
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

function mount(node: ReactNode, shellEnv: ShellEnv = env) {
  const container = document.createElement("div");
  container.style.cssText = "position: fixed; inset: 0; display: flex;";
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <LocaleProvider locale="en">
        <ShellDataProvider env={shellEnv}>{node}</ShellDataProvider>
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
  test("copying a render error remains retryable after the clipboard denies access", async () => {
    // Invariant: no false success or unhandled rejection; retry copies the original diagnostic.
    // Owner: shell frame controls. Clipboard is the only mocked I/O boundary.
    const clipboard = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"))
      .mockResolvedValueOnce();
    try {
      const container = mount(
        <RenderErrorCard
          title="Broken"
          status={{ kind: "error", message: "Render failed", componentStack: null }}
          onReload={() => {}}
        />
      );
      const button = [...container.querySelectorAll("button")].find(item =>
        item.textContent?.includes("Copy error")
      )!;
      await act(async () => {
        button.click();
        await clipboard.mock.results[0]!.value.catch(() => {});
      });
      expect(clipboard).toHaveBeenCalledTimes(1);
      expect(button.textContent).toContain("Copy error");
      act(() => button.click());
      await vi.waitFor(() => expect(button.textContent).toContain("Copied"));
      expect(clipboard).toHaveBeenLastCalledWith("Render failed");
    } finally {
      clipboard.mockRestore();
    }
  });

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
    // Synthetic dispatch runs the shell's listener synchronously inside act(): nothing to wait for.
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
    // Synthetic dispatch runs the shell's listener synchronously inside act(): nothing to wait for.
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
    // Synthetic dispatch runs the shell's listener synchronously inside act(): nothing to wait for.
    expect(contexts.every(context => context.slug === "card")).toBe(true);
  });

  test("F4 / Safety Invariant 7: a forged auth:expired re-tickets at most twice per window, then S16", async () => {
    let tickets = 0;
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(String(input), window.location.href).pathname === "/api/render-ticket") {
        tickets += 1;
        return Response.json({ ticket: `ticket-${tickets}`, url: "", expiresAt: "" });
      }
      return real(input, init);
    });
    cleanups.push(() => vi.unstubAllGlobals());
    const remote: ShellEnv = {
      ...env,
      bootstrap: {
        ...env.bootstrap,
        mode: "remote",
        apiBase: "/api/",
        principal: {
          id: "usr_1",
          name: "Pedro Nauck",
          kind: "reviewer",
          scopes: ["review", "comment"],
          credentialId: null,
        },
      },
    };
    const container = mount(
      <ReviewProvider keys={["card"]}>
        <ScreenFrame
          target={{ slug: "card", state: "default", theme: "light", role: null }}
          width="fit"
          title="Card"
          slugs={slugs}
          className="flex-1"
        />
      </ReviewProvider>,
      remote
    );
    const expire = async (round: number) => {
      const iframe = await vi.waitFor(() => {
        const found = frameOf(container);
        if (!found.src.includes(`ticket=ticket-${round}`)) throw new Error("No ticketed load yet");
        return found;
      });
      act(() =>
        deliver(
          { proto: protocolVersion, frame: nonceOf(iframe), type: "auth:expired" },
          { source: iframe.contentWindow, origin: renderOrigin }
        )
      );
    };
    await expire(1);
    await expire(2);
    await expire(3);
    const alert = await vi.waitFor(() => {
      const found = container.querySelector('[role="alert"]');
      if (!found) throw new Error("No render failure yet");
      return found;
    });
    expect(alert.textContent).toContain("keeps rejecting");
    expect(tickets).toBe(3);
  });
});

describe("nextStatus", () => {
  const status = (
    stage: "import" | "load" | "render" | "play",
    result: "running" | "passed" | "failed",
    error: string | null = null
  ): RenderMessage => ({
    proto: protocolVersion,
    frame: "current",
    type: "story:status",
    story: "ui-button--primary",
    stage,
    status: result,
    hasPlay: true,
    error,
    durationMs: 12,
  });
  const ready: FrameStatus = { kind: "ready" };

  test("a terminal story failure before play is a frame error that frees the preview slot", () => {
    // Invariant: `import`, `load` and `render` failures end the frame with the host's message.
    // Owner: shell render channel (`_spec.md` § Core Interfaces, `story:status`).
    for (const stage of ["import", "load", "render"] as const) {
      expect(nextStatus(initialStatus, status(stage, "failed", `${stage} broke`))).toEqual({
        kind: "error",
        message: `${stage} broke`,
        componentStack: null,
      });
    }
    // A render failure after commit replaces the ready frame too.
    expect(nextStatus(ready, status("render", "failed", "boom"))).toMatchObject({ kind: "error" });
    // A failure without a message still names the stage it stopped at.
    expect(nextStatus(initialStatus, status("load", "failed"))).toMatchObject({ message: "load" });
  });

  test("a play failure, running and passed reports leave the frame as it is", () => {
    // Invariant: a story whose play failed stays visible; lifecycle progress never settles a frame.
    expect(nextStatus(ready, status("play", "failed", "expected disabled"))).toBe(ready);
    expect(nextStatus(ready, status("play", "passed"))).toBe(ready);
    expect(nextStatus(initialStatus, status("load", "running"))).toBe(initialStatus);
    expect(nextStatus(initialStatus, status("render", "passed"))).toBe(initialStatus);
  });

  test("an error stays final: a later story report never hides it", () => {
    const error: FrameStatus = { kind: "error", message: "first", componentStack: null };
    expect(nextStatus(error, status("render", "passed"))).toBe(error);
    expect(nextStatus(error, status("import", "failed", "second"))).toBe(error);
  });
});

describe("story frames", () => {
  // Two story roots on two origins: `web` on the render origin, `ui` on the shell's own origin.
  const webOrigin = renderOrigin;
  const uiOrigin = window.location.origin;
  const storyEnv: ShellEnv = {
    ...env,
    bootstrap: {
      ...env.bootstrap,
      storyRoots: [
        { id: "web", renderUrl: `${webOrigin}/test/browser/render/__proto/story/` },
        { id: "ui", renderUrl: `${uiOrigin}/test/browser/render/__proto/story/` },
      ],
    },
  };
  const target = (root: string): StoryFrameTarget => ({
    kind: "story",
    root,
    slug: "ui-button",
    story: "ui-button--primary",
    theme: "light",
    play: true,
  });
  const failed = (frame: string) => ({
    proto: protocolVersion,
    frame,
    type: "story:status",
    story: "ui-button--primary",
    stage: "render",
    status: "failed",
    hasPlay: false,
    error: "Forged failure",
    durationMs: 5,
  });

  /** A story frame whose status, result and Replay are readable from the DOM. */
  function StoryProbe({ target: probe }: { target: StoryFrameTarget }) {
    const iframe = useRef<HTMLIFrameElement>(null);
    const frame = useRenderFrame(iframe, probe, { slugs });
    return (
      <div
        data-root={probe.root}
        data-status={frame.status.kind}
        data-reason={frame.status.kind === "error" ? (frame.status.reason ?? "") : ""}
        data-result={frame.result?.status ?? ""}
      >
        <button type="button" onClick={frame.reload}>
          Replay
        </button>
        <iframe key={frame.nonce} ref={iframe} src={frame.src ?? undefined} title={probe.root} />
      </div>
    );
  }

  const probeOf = (container: HTMLElement, root: string) => {
    const probe = container.querySelector<HTMLElement>(`[data-root="${root}"]`);
    const iframe = probe?.querySelector("iframe");
    if (!probe || !iframe) throw new Error(`No ${root} story frame yet`);
    return { probe, iframe };
  };

  test("IT-021 a story frame loads from its root's server and never takes a render ticket", async () => {
    const container = mount(<StoryProbe target={target("ui")} />, storyEnv);
    const { iframe } = await vi.waitFor(() => probeOf(container, "ui"));
    const src = new URL(iframe.src);
    expect(src.origin).toBe(uiOrigin);
    expect(src.pathname).toBe("/test/browser/render/__proto/story/ui-button--primary");
    expect(src.searchParams.get("play")).toBe("1");
    expect(src.searchParams.get("frame")).toMatch(/^[0-9a-f]{32}$/);
    expect(src.searchParams.has("ticket")).toBe(false);
  });

  test("IT-021 each story frame accepts only its root origin, its own window and its nonce", async () => {
    // Invariant: Safety Invariant 2. Owner: shell frame channel (`useRenderFrame`).
    const container = mount(
      <>
        <StoryProbe target={target("web")} />
        <StoryProbe target={target("ui")} />
      </>,
      storyEnv
    );
    const web = await vi.waitFor(() => probeOf(container, "web"));
    const ui = await vi.waitFor(() => probeOf(container, "ui"));
    const sibling = document.createElement("iframe");
    sibling.src = `${webOrigin}/test/browser/render/__proto/story/ui-button--primary`;
    document.body.append(sibling);
    cleanups.push(() => sibling.remove());
    const webNonce = nonceOf(web.iframe);
    const uiNonce = nonceOf(ui.iframe);

    act(() => {
      // Another root's origin, a same-origin sibling window, the other frame's nonce.
      deliver(failed(webNonce), { source: web.iframe.contentWindow, origin: uiOrigin });
      deliver(failed(webNonce), { source: sibling.contentWindow, origin: webOrigin });
      deliver(failed(uiNonce), { source: web.iframe.contentWindow, origin: webOrigin });
      deliver(failed(uiNonce), { source: ui.iframe.contentWindow, origin: webOrigin });
    });
    // Synthetic dispatch runs the shell's listener synchronously inside act(): nothing to wait for.
    expect(web.probe.dataset.status).toBe("loading");
    expect(ui.probe.dataset.status).toBe("loading");

    act(() => deliver(failed(uiNonce), { source: ui.iframe.contentWindow, origin: uiOrigin }));
    expect(ui.probe.dataset.status).toBe("error");
    expect(ui.probe.dataset.result).toBe("failed");
    expect(web.probe.dataset.status).toBe("loading");

    act(() => deliver(failed(webNonce), { source: web.iframe.contentWindow, origin: webOrigin }));
    expect(web.probe.dataset.status).toBe("error");
  });

  test("IT-021 after Replay the replaced document's nonce is stale", async () => {
    const container = mount(<StoryProbe target={target("web")} />, storyEnv);
    const first = await vi.waitFor(() => probeOf(container, "web"));
    const stale = nonceOf(first.iframe);
    act(() => first.probe.querySelector("button")?.click());
    const next = await vi.waitFor(() => {
      const found = probeOf(container, "web");
      if (nonceOf(found.iframe) === stale) throw new Error("No replayed document yet");
      return found;
    });
    act(() => deliver(failed(stale), { source: next.iframe.contentWindow, origin: webOrigin }));
    expect(next.probe.dataset.status).toBe("loading");
    act(() =>
      deliver(failed(nonceOf(next.iframe)), {
        source: next.iframe.contentWindow,
        origin: webOrigin,
      })
    );
    expect(next.probe.dataset.status).toBe("error");
  });

  test("IT-021 ready counts only for the component and story the frame asked for", async () => {
    const container = mount(<StoryProbe target={target("web")} />, storyEnv);
    const { probe, iframe } = await vi.waitFor(() => probeOf(container, "web"));
    const ready = (slug: string, state: string) => ({
      proto: protocolVersion,
      frame: nonceOf(iframe),
      type: "ready",
      slug,
      state,
    });
    const from = { source: iframe.contentWindow, origin: webOrigin };
    act(() => deliver(ready("ui-button", "ui-button--disabled"), from));
    act(() => deliver(ready("other", "ui-button--primary"), from));
    expect(probe.dataset.status).toBe("loading");
    act(() => deliver(ready("ui-button", "ui-button--primary"), from));
    expect(probe.dataset.status).toBe("ready");
  });

  test("IT-024 a 390 viewport preset gives the story frame a 390-wide document", async () => {
    // Invariant: US-005.AC-3. Owner: `ScreenFrame` with a story target (the story page's frame).
    const container = mount(
      <ScreenFrame
        target={target("web")}
        width={390}
        title="UI/Button · Primary"
        slugs={slugs}
        className="flex-1"
      />,
      storyEnv
    );
    const iframe = await vi.waitFor(() => frameOf(container));
    expect(iframe.style.width).toBe("390px");
    expect(new URL(iframe.src).searchParams.get("w")).toBe("390");
  });

  /** A story frame with the story page's play status chip. */
  function StatusProbe({ target: probe }: { target: StoryFrameTarget }) {
    const iframe = useRef<HTMLIFrameElement>(null);
    const frame = useRenderFrame(iframe, probe, { slugs });
    return (
      <div data-root={probe.root}>
        <PlayStatus frame={frame} />
        <iframe key={frame.nonce} ref={iframe} src={frame.src ?? undefined} title={probe.root} />
      </div>
    );
  }
  const status = (frame: string, patch: Record<string, unknown>) => ({
    ...failed(frame),
    status: "passed",
    hasPlay: false,
    error: null,
    ...patch,
  });
  const chipOf = (probe: HTMLElement) =>
    probe.querySelector<HTMLElement>('[role="status"][aria-label="Play status"]');
  const replayOf = (probe: HTMLElement) =>
    [...probe.querySelectorAll("button")].find(button => button.textContent === "Replay");

  test("a story without play shows no status; a render failure names its stage, without Replay", async () => {
    // Invariant: truthful UI, the chip follows the host result, never the registry `play` flag.
    // Owner: `PlayStatus` on the story page.
    const container = mount(
      <>
        <StatusProbe target={target("web")} />
        <StatusProbe target={target("ui")} />
      </>,
      storyEnv
    );
    const web = await vi.waitFor(() => probeOf(container, "web"));
    const ui = await vi.waitFor(() => probeOf(container, "ui"));
    act(() =>
      deliver(status(nonceOf(web.iframe), {}), {
        source: web.iframe.contentWindow,
        origin: webOrigin,
      })
    );
    expect(chipOf(web.probe)).toBeNull();
    act(() =>
      deliver(status(nonceOf(ui.iframe), { status: "failed", error: "boom" }), {
        source: ui.iframe.contentWindow,
        origin: uiOrigin,
      })
    );
    expect(chipOf(ui.probe)?.textContent).toContain("Failed at render");
    expect(chipOf(ui.probe)?.textContent).toContain("boom");
    expect(replayOf(ui.probe)).toBeUndefined();
  });

  test("a story with play shows Running then Passed, and Replay loads a fresh document", async () => {
    // Invariant: US-006.AC-2 and AC-4. Owner: `PlayStatus` on the story page.
    const container = mount(<StatusProbe target={target("web")} />, storyEnv);
    const first = await vi.waitFor(() => probeOf(container, "web"));
    const nonce = nonceOf(first.iframe);
    const from = { source: first.iframe.contentWindow, origin: webOrigin };
    act(() => deliver(status(nonce, { stage: "play", status: "running", hasPlay: true }), from));
    expect(chipOf(first.probe)?.textContent).toContain("Running");
    act(() => deliver(status(nonce, { stage: "play", hasPlay: true }), from));
    expect(chipOf(first.probe)?.textContent).toContain("Passed");
    act(() => replayOf(first.probe)?.click());
    const next = await vi.waitFor(() => {
      const found = probeOf(container, "web");
      if (nonceOf(found.iframe) === nonce) throw new Error("No replayed document yet");
      return found;
    });
    expect(chipOf(next.probe)).toBeNull();
  });

  test("IT-021 a root without a story server shows its failure and loads nothing", async () => {
    const container = mount(<StoryProbe target={target("absent")} />, storyEnv);
    const { probe, iframe } = await vi.waitFor(() => probeOf(container, "absent"));
    expect(probe.dataset.status).toBe("error");
    expect(probe.dataset.reason).toBe("story_root");
    expect(iframe.getAttribute("src")).toBeNull();
  });
});
