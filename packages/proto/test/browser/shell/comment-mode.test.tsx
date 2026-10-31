/**
 * Comment mode, shell side (S8; `_tests.md` IT-027 shell half, E2E-014 shell half, US-016,
 * US-017; Safety Invariant 7). This page plays the shell on http://127.0.0.1:<port>: the real
 * `ScreenFrame` with the comment-mode slots, the real render host in a cross-origin iframe on
 * http://localhost:<port> (render harness prototypes `card` and the hostile `forge`), and the real
 * review router over an in-memory store answering `/__proto/api/` (`review-harness.ts`).
 */
import "../../../src/shell/theme.css";

import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import type { ReviewComment } from "../../../src/model/review.ts";
import type { ReviewTarget } from "../../../src/shell/app/slots.tsx";
import { ScreenFrame } from "../../../src/shell/frames/screen-frame.tsx";
import { LocaleProvider } from "../../../src/shell/lib/i18n.tsx";
import { ShellDataProvider, useShellData } from "../../../src/shell/lib/shell-data.tsx";
import {
  commentModeSlots,
  CommentModeProvider,
  Composer,
  useCommentMode,
} from "../../../src/shell/review/comment-mode/index.ts";
import { ReviewProvider } from "../../../src/shell/review/data.tsx";
import { env, registry, slugs } from "./comment-fixtures.ts";
import { installBackend, type Backend } from "./review-harness.ts";

let backend: Backend;
const cleanups: (() => void)[] = [];
beforeEach(() => {
  backend = installBackend();
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  backend.restore();
});

function Ready({ children }: { children: ReactNode }) {
  const { registry: state } = useShellData();
  return state.status === "ready" ? children : null;
}

function mount(node: ReactNode) {
  const container = document.createElement("div");
  container.style.cssText = "position: fixed; inset: 0; display: flex; flex-direction: column;";
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <LocaleProvider locale="en">
        <ShellDataProvider env={env}>
          <Ready>
            <ReviewProvider keys={registry.prototypes.map(item => item.slug)}>
              <CommentModeProvider>{node}</CommentModeProvider>
            </ReviewProvider>
          </Ready>
        </ShellDataProvider>
      </LocaleProvider>
    )
  );
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

/** The screen view's wiring of the slots: tools, frame messages and overlay; it follows `context`. */
function Screen({ slug }: { slug: string }) {
  const [state, setState] = useState("default");
  const [role, setRole] = useState<string | null>("admin");
  const target = { kind: "prototype", key: slug, slug, state } as const;
  const frame = commentModeSlots.screenFrame!(target);
  return (
    <>
      <div className="flex items-center gap-2 p-2">
        <output data-testid="state">{state}</output>
        <Focused />
        {commentModeSlots.canvasTools!(target)}
      </div>
      <ScreenFrame
        target={{ slug, state, theme: "light", role }}
        width={600}
        title={slug}
        slugs={slugs}
        className="flex-1"
        onContext={context => {
          if (context.state) setState(context.state);
          if (context.role) setRole(context.role);
        }}
        onMessage={frame.onMessage}
        overlay={frame.overlay}
      />
    </>
  );
}

function Focused() {
  const mode = useCommentMode();
  return <output data-testid="focused">{mode.focused ?? ""}</output>;
}

/** Playwright's handle on the render frame of this shell (by its nonce). */
async function renderFrame(container: HTMLElement) {
  const iframe = await vi.waitFor(() => {
    const found = container.querySelector("iframe");
    if (!found) throw new Error("no frame yet");
    return found;
  });
  const match = `frame=${new URL(iframe.src).searchParams.get("frame")}`;
  return {
    iframe,
    eval: <T,>(expression: string) => commands.renderFrameEval(match, expression) as Promise<T>,
    click: (x: number, y: number) => commands.renderFrameClick(match, { x, y }),
    keys: (keys: string[]) => commands.renderFrameKeys(match, keys),
    picker: () =>
      commands.renderFrameEval(
        match,
        `document.querySelector('[data-testid="proto-picker"]')?.dataset.mode ?? null`
      ) as Promise<string | null>,
  };
}

const stored = () => backend.comments.at(-1)!;

function seeded(id: string, selector: string, rect: { x: number; y: number }): ReviewComment {
  const at = "2026-10-30T22:41:03.000Z";
  return {
    id,
    slug: "card",
    status: "open",
    createdAt: at,
    updatedAt: at,
    resolvedAt: null,
    context: {
      commit: null,
      state: "default",
      theme: "light",
      role: null,
      viewport: { width: 600, height: 400 },
    },
    target: {
      kind: "element",
      selector,
      testId: null,
      tag: "div",
      text: "",
      source: null,
      sourceChain: [],
      rect: { ...rect, width: 100, height: 40 },
      rectNormalized: { x: rect.x / 600, y: rect.y / 400, width: 1 / 6, height: 0.1 },
      offset: null,
    },
    thread: [
      {
        id: crypto.randomUUID(),
        at,
        editedAt: null,
        body: "Seeded",
        author: "reviewer",
        attachments: [],
      },
    ],
  };
}

describe("IT-027: comment mode drives the render host's picker", () => {
  test("the comment tool picks an element; the comment records target and context and gets a pin", async () => {
    const container = mount(<Screen slug="card" />);
    const frame = await renderFrame(container);
    await userEvent.click(page.getByTestId("comment-tool"));
    await vi.waitFor(() =>
      expect(page.getByTestId("comment-hint").element().textContent).toContain(
        "Click an element or drag a region"
      )
    );
    await vi.waitFor(async () => expect(await frame.picker()).toBe("element"));

    await frame.click(44, 44);
    await expect
      .element(page.getByTestId("composer-source"))
      .toHaveTextContent("src/components/card.tsx:3:5");
    await vi.waitFor(async () => expect(await frame.picker()).toBeNull());
    expect(page.getByTestId("comment-hint").query()).toBeNull();

    await userEvent.fill(page.getByRole("textbox"), "Primary button reads as disabled.");
    await userEvent.click(page.getByRole("button", { name: "Comment", exact: true }));

    await vi.waitFor(() => expect(backend.comments).toHaveLength(1));
    expect(stored()).toMatchObject({
      id: "card-1",
      target: {
        kind: "element",
        selector: '[data-testid="save"]',
        testId: "save",
        source: "src/components/card.tsx:3:5",
        rect: { x: 40, y: 40, width: 120, height: 32 },
      },
      context: { state: "default", theme: "light", viewport: { width: 600 } },
      thread: [{ body: "Primary button reads as disabled.", author: "reviewer" }],
    });
    const pin = page.getByTestId("comment-pin");
    await expect.element(pin).toHaveTextContent("1");
    await expect.element(pin).toHaveAttribute("aria-pressed", "true");
    await expect.element(page.getByTestId("focused")).toHaveTextContent("card-1");
    expect(pin.element().hasAttribute("data-moved")).toBe(false);
  });

  test("C starts a keyboard pick in the focused frame; arrows and Enter pick; Esc cancels the composer", async () => {
    const container = mount(<Screen slug="card" />);
    const frame = await renderFrame(container);
    await vi.waitFor(async () =>
      expect(await frame.eval("Boolean(document.querySelector('[data-testid=card]'))")).toBe(true)
    );
    await userEvent.keyboard("c");
    await vi.waitFor(async () => expect(await frame.picker()).toBe("keyboard"));
    await vi.waitFor(() =>
      expect(page.getByTestId("comment-hint").element().textContent).toContain("Enter picks")
    );
    expect(document.activeElement).toBe(frame.iframe);

    // The crosshair starts at the viewport center (300, y); large steps up reach the long text.
    const height = await frame.eval<number>("window.innerHeight");
    const steps = Math.round((Math.round(height / 2) - 50) / 40);
    await frame.keys([...Array.from({ length: steps }, () => "Shift+ArrowUp"), "Enter"]);
    await expect
      .element(page.getByTestId("composer-source"))
      .toHaveTextContent("src/components/card.tsx:12:7");

    await userEvent.keyboard("{Escape}");
    expect(page.getByTestId("comment-composer").query()).toBeNull();
    expect(backend.writes).toEqual([]);
  });

  test("Esc while picking cancels the pick on both sides", async () => {
    const container = mount(<Screen slug="card" />);
    const frame = await renderFrame(container);
    await userEvent.click(page.getByTestId("comment-tool"));
    await vi.waitFor(async () => expect(await frame.picker()).toBe("element"));
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(async () => expect(await frame.picker()).toBeNull());
    expect(page.getByTestId("comment-hint").query()).toBeNull();
  });

  test("US-016.EC-5: a state change while picking keeps the pick and the comment records the new state", async () => {
    const container = mount(<Screen slug="card" />);
    const frame = await renderFrame(container);
    await vi.waitFor(async () =>
      expect(await frame.eval("Boolean(document.querySelector('[data-testid=later]'))")).toBe(true)
    );
    await frame.click(180, 376); // setParam("state", "b") after 300 ms
    await userEvent.click(page.getByTestId("comment-tool"));
    await expect.element(page.getByTestId("state")).toHaveTextContent("b");
    expect(await frame.picker()).toBe("element");

    await frame.click(44, 44);
    await userEvent.fill(page.getByRole("textbox"), "In state B.");
    await userEvent.click(page.getByRole("button", { name: "Comment", exact: true }));
    await vi.waitFor(() => expect(backend.comments).toHaveLength(1));
    expect(stored().context.state).toBe("b");
  });

  test("pins follow anchors: a missing anchor shows the moved marker; focusing a comment scrolls to it", async () => {
    backend.seed(seeded("card-1", '[data-testid="gone"]', { x: 60, y: 200 }));
    backend.seed(seeded("card-2", '[data-testid="far"]', { x: 40, y: 1500 }));
    const container = mount(<Screen slug="card" />);
    await renderFrame(container);
    const moved = page.getByRole("button", { name: "Comment 1, its element moved" });
    await expect.element(moved).toHaveAttribute("data-moved", "true");
    const far = page.getByRole("button", { name: "Comment 2" });
    await expect.element(far).toBeInTheDocument();
    const before = far.element().getBoundingClientRect().top;

    await userEvent.click(far);
    await expect.element(page.getByTestId("focused")).toHaveTextContent("card-2");
    await vi.waitFor(() =>
      expect(far.element().getBoundingClientRect().top).toBeLessThan(before - 20)
    );
  });
});

describe("E2E-014 (shell half): render messages are untrusted", () => {
  test("a forged pick:result outside a pick is ignored; during a pick a ../ source is refused and nothing is written", async () => {
    const container = mount(<Screen slug="forge" />);
    const frame = await renderFrame(container);
    await vi.waitFor(async () =>
      expect(await frame.eval("Boolean(document.querySelector('[data-testid=forge-now]'))")).toBe(
        true
      )
    );

    await frame.click(100, 56); // posts a pick:result with a valid source, no pick running
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(page.getByTestId("comment-composer").query()).toBeNull();

    await frame.click(260, 56); // posts a pick:result with ../../.github/… in 1.5 s
    await userEvent.click(page.getByTestId("comment-tool"));
    await vi.waitFor(async () => expect(await frame.picker()).toBe("element"));
    await expect.element(page.getByTestId("comment-refused")).toBeVisible();
    expect(page.getByTestId("comment-composer").query()).toBeNull();
    await vi.waitFor(async () => expect(await frame.picker()).toBeNull());
    expect(backend.writes).toEqual([]);
    expect(backend.comments).toEqual([]);
  });

  test("the router refuses a forged source from any client with invalid_source", async () => {
    const response = await fetch("/__proto/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: "card",
        body: "Forged",
        context: {
          state: "default",
          theme: "light",
          role: null,
          viewport: { width: 600, height: 400 },
        },
        target: {
          ...seeded("x-1", "main", { x: 0, y: 0 }).target,
          source: "../../.github/workflows/ci.yml:1:1",
        },
      }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_source" } });
    expect(backend.comments).toEqual([]);
  });
});

describe("Composer", () => {
  const png = (name: string, bytes = 64) =>
    new File([new Uint8Array(bytes)], name, { type: "image/png" });

  test("uploads images as pending attachments, claims them on send and discards them on cancel", async () => {
    const sent: { body: string; attachments: string[] }[] = [];
    let cancelled = false;
    function Harness() {
      const [open, setOpen] = useState(true);
      return open ? (
        <Composer
          reviewKey="card"
          submitLabel="Send"
          onSubmit={async input => {
            sent.push(input);
          }}
          onCancel={() => {
            cancelled = true;
            setOpen(false);
          }}
        />
      ) : null;
    }
    mount(<Harness />);
    const send = page.getByRole("button", { name: "Send" });
    await expect.element(send).toBeDisabled();

    await userEvent.upload(page.getByTestId("composer-file"), [png("shot.png"), png("other.png")]);
    await vi.waitFor(() => expect(backend.pending.size).toBe(2));
    await expect.element(page.getByText("2 / 6")).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Remove other.png" }));
    await vi.waitFor(() => expect(backend.pending.size).toBe(1));

    await userEvent.upload(page.getByTestId("composer-file"), [
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "brief.png", { type: "image/png" }),
    ]);
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("brief.png is 5.0 MB · images are limited to 5 MB");
    await userEvent.upload(page.getByTestId("composer-file"), [
      new File(["x"], "notes.txt", { type: "text/plain" }),
    ]);
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("notes.txt: only PNG, JPEG, WebP or GIF images.");

    await userEvent.fill(page.getByRole("textbox"), "With a screenshot");
    await userEvent.click(send);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      body: "With a screenshot",
      attachments: [...backend.pending.keys()],
    });
    expect(cancelled).toBe(false);
  });

  test("cancel discards pending uploads", async () => {
    let open = true;
    function Harness() {
      const [shown, setShown] = useState(true);
      open = shown;
      return shown ? (
        <Composer
          reviewKey="card"
          submitLabel="Send"
          onSubmit={async () => {}}
          onCancel={() => setShown(false)}
        />
      ) : null;
    }
    mount(<Harness />);
    await userEvent.upload(page.getByTestId("composer-file"), [png("shot.png")]);
    await vi.waitFor(() => expect(backend.pending.size).toBe(1));
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(backend.pending.size).toBe(0));
    expect(open).toBe(false);
  });
});

describe("E2E-004 (comment on a step): flow comments", () => {
  test("the flow comment tool comments the selected step, or the whole flow without a selection", async () => {
    const step: ReviewTarget = {
      kind: "flow",
      key: "flow-sign-in",
      flow: "sign-in",
      node: "sign-up",
    };
    const whole: ReviewTarget = { ...step, node: null };
    function Flow() {
      const [target, setTarget] = useState(step);
      return (
        <div className="flex items-start gap-2 p-2">
          <button type="button" onClick={() => setTarget(whole)}>
            Deselect
          </button>
          {commentModeSlots.canvasTools!(target)}
        </div>
      );
    }
    mount(<Flow />);
    await userEvent.click(page.getByTestId("comment-tool"));
    await expect
      .element(page.getByRole("dialog", { name: "Comment on step 3 · Create account" }))
      .toBeVisible();
    await userEvent.fill(page.getByRole("textbox"), "Step copy is off.");
    await userEvent.click(page.getByRole("button", { name: "Comment", exact: true }));
    await vi.waitFor(() => expect(backend.comments).toHaveLength(1));
    expect(stored()).toMatchObject({
      id: "flow-sign-in-1",
      target: { kind: "node", node: "sign-up", label: "Create account" },
      context: { state: "sign-up" },
    });

    await userEvent.click(page.getByRole("button", { name: "Deselect" }));
    await userEvent.click(page.getByTestId("comment-tool"));
    await expect.element(page.getByRole("dialog", { name: "Comment on this flow" })).toBeVisible();
    await userEvent.fill(page.getByRole("textbox"), "The journey is too long.");
    await userEvent.click(page.getByRole("button", { name: "Comment", exact: true }));
    await vi.waitFor(() => expect(backend.comments).toHaveLength(2));
    expect(stored()).toMatchObject({
      target: { kind: "node", node: null, label: "" },
      context: { state: "" },
    });
  });
});
