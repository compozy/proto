/**
 * The Components area (`_tests.md` IT-003, IT-004, IT-025; `_uiux.md` S2–S4). No other suite owns it:
 * the tree is windowed whatever its size, and the component page's thumbnails load from a
 * story root on another origin (`test/browser/render/__proto/story`, a protocol harness host),
 * never run `play`, and fail one by one.
 */
import "../../../src/shell/theme.css";

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";

import { LocaleProvider } from "../../../src/shell/lib/i18n.tsx";
import {
  ShellDataProvider,
  useShellData,
  type ShellEnv,
} from "../../../src/shell/lib/shell-data.tsx";
import { componentView, type View } from "../../../src/shell/lib/view.ts";
import { ComponentPage } from "../../../src/shell/pages/components.tsx";
import { StoryPage } from "../../../src/shell/pages/story-page.tsx";
import { VirtualTree, type VirtualTreeItem } from "../../../src/shell/ui/virtual-tree.tsx";
import { bootstrapFor, storyRegistry } from "../../harness/fixtures.ts";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function mount(node: ReactNode) {
  const container = document.createElement("div");
  container.style.cssText = "position: fixed; inset: 0; display: flex; flex-direction: column;";
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(node));
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

describe("VirtualTree", () => {
  const items: VirtualTreeItem[] = Array.from({ length: 2000 }, (_, index) => ({
    id: `row-${index}`,
    level: 1,
    expanded: null,
    parent: null,
    position: index + 1,
    size: 2000,
  }));

  test("IT-003 a 2,000-row tree renders fewer than 100 rows, and scrolling brings the last one in", async () => {
    // Invariant: US-002.EC-1, only visible rows render. Owner: `VirtualTree` windowing.
    const opened: string[] = [];
    const container = mount(
      <VirtualTree
        label="Components"
        items={items}
        selected={null}
        onToggle={() => {}}
        onOpen={item => opened.push(item.id)}
        renderRow={item => <span>{item.id}</span>}
        className="flex-1"
      />
    );
    const tree = container.querySelector<HTMLElement>('[role="tree"]');
    if (!tree) throw new Error("No tree");
    const rows = () => [...tree.querySelectorAll('[role="treeitem"]')];
    await vi.waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(rows().length).toBeLessThan(100);
    expect(tree.scrollHeight).toBeGreaterThanOrEqual(2000 * 28);

    tree.scrollTop = tree.scrollHeight;
    await vi.waitFor(() => expect(rows().some(row => row.textContent === "row-1999")).toBe(true));
    expect(rows().length).toBeLessThan(100);
    expect(rows().some(row => row.textContent === "row-0")).toBe(false);
  });

  test("the keyboard moves through the rows and Enter opens the focused one", async () => {
    // Invariant: the tree is keyboard navigable (`_uiux.md` Design constraints). Owner: `VirtualTree`.
    const opened: string[] = [];
    const container = mount(
      <VirtualTree
        label="Components"
        items={items}
        selected={null}
        onToggle={() => {}}
        onOpen={item => opened.push(item.id)}
        renderRow={item => <span>{item.id}</span>}
        className="flex-1"
      />
    );
    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    const press = (key: string) =>
      act(() => {
        tree.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      });
    tree.focus();
    press("ArrowDown");
    press("Enter");
    expect(opened).toEqual(["row-1"]);
    press("End");
    await vi.waitFor(() =>
      expect(
        document.getElementById(tree.getAttribute("aria-activedescendant") ?? "")?.textContent
      ).toBe("row-1999")
    );
    press("Enter");
    expect(opened.at(-1)).toBe("row-1999");
  });
});

describe("component page", () => {
  const storyOrigin = window.location.origin.replace("127.0.0.1", "localhost");
  const storyUrl = `${storyOrigin}/test/browser/render/__proto/story/index.html`;
  const renderUrl = `${storyOrigin}/test/browser/render/__proto/render/index.html`;
  const env: ShellEnv = {
    bootstrap: {
      ...bootstrapFor({
        renderUrl,
        eventsUrl: null,
        registryUrl: `data:application/json,${encodeURIComponent(JSON.stringify(storyRegistry))}`,
      }),
      storyRoots: [
        { id: "web", renderUrl: storyUrl },
        { id: "ui", renderUrl: storyUrl },
      ],
    },
    renderUrl,
    renderOrigin: storyOrigin,
  };

  /** Renders once the registry is loaded, as the app's ready branch does. */
  function Ready({ children }: { children: ReactNode }) {
    const { registry } = useShellData();
    return registry.status === "ready" ? children : null;
  }

  test("IT-004 thumbnails never run play, and stories failing at render or import fail alone at once", async () => {
    // Invariant: US-003.AC-3, AC-4 and EC-2. Owner: the component page's `Preview` thumbnails.
    const file = storyRegistry.stories?.find(item => item.slug === "ui-button");
    if (!file) throw new Error("No ui-button fixture");
    const container = mount(
      <LocaleProvider locale="en">
        <ShellDataProvider env={env}>
          <Ready>
            <ComponentPage file={file} theme="light" />
          </Ready>
        </ShellDataProvider>
      </LocaleProvider>
    );
    const card = (name: string) =>
      [...container.querySelectorAll("li")].find(
        item => item.querySelector("h2")?.textContent === name
      );
    await vi.waitFor(() => expect(card("Primary")).toBeDefined());
    expect(container.textContent).toContain("Buttons trigger actions.");
    expect(container.textContent).toContain("src/button.stories.tsx");

    for (const name of ["Render Fail", "Import Fail"]) {
      card(name)?.scrollIntoView();
      // Settles at once: well before the 10 s "still loading" notice.
      await vi.waitFor(() => expect(card(name)?.textContent).toContain("Failed to render"), {
        timeout: 5000,
      });
    }

    card("Primary")?.scrollIntoView();
    const primary = await vi.waitFor(() => {
      const iframe = card("Primary")?.querySelector("iframe");
      if (!iframe?.src) throw new Error("No Primary thumbnail yet");
      return iframe;
    });
    expect(new URL(primary.src).searchParams.get("play")).toBe("0");
    await vi.waitFor(() => expect(card("Primary")?.querySelector('[role="status"]')).toBeNull(), {
      timeout: 5000,
    });
    expect(card("Primary")?.textContent).not.toContain("Failed to render");
    expect(
      await commands.renderFrameEval(
        "story=ui-button--primary",
        "document.documentElement.dataset.playCalls"
      )
    ).toBe("0");
  });

  test("IT-025 a story file with module mocks shows the notice on its story page; others do not", async () => {
    // Invariant: US-007.EC-1, the page says mocks are inert instead of rendering silently.
    // Owner: the story page (`StoryPage` reading the indexer's `story_mock_unsupported`).
    const page = (slug: string) => {
      const file = storyRegistry.stories?.find(item => item.slug === slug);
      if (!file) throw new Error(`No ${slug} fixture`);
      const story = file.stories[0];
      const view = componentView(file.slug, story.id) as Extract<View, { area: "component" }>;
      return mount(
        <LocaleProvider locale="en">
          <ShellDataProvider env={env}>
            <Ready>
              <StoryPage view={view} theme="light" file={file} story={story} />
            </Ready>
          </ShellDataProvider>
        </LocaleProvider>
      );
    };
    const notice = (container: HTMLElement) => container.querySelector('[role="note"]');

    const mocked = page("ui-button");
    await vi.waitFor(() => expect(notice(mocked)).not.toBeNull());
    expect(notice(mocked)?.textContent).toContain("Module mocks are not applied");
    expect(notice(mocked)?.textContent).toContain("sb.mock or mocked");

    const plain = page("ui-card");
    await vi.waitFor(() => expect(plain.querySelector("iframe")).not.toBeNull());
    expect(notice(plain)).toBeNull();
  });
});
