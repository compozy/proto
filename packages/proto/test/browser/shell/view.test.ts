/**
 * URL and view model (`_tests.md` UT-022–UT-024, UT-008, UT-010, `_dx.md` § URLs): the shell view
 * lives in its URL, widths are clamped to 320–3840 with the URL rewritten, conflicting selections
 * resolve to one view (`flow` > `p` > `c` > `spec` > area parameters), and a component link
 * resolves through the component tree model.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { RegistryStoryFile } from "../../../src/model/registry.ts";
import { useLocation } from "../../../src/shell/lib/navigation.ts";
import {
  availableView,
  buildStoryTree,
  resolveStoryView,
  revealIds,
  visibleRows,
  type StoryTreeNode,
} from "../../../src/shell/lib/story-tree.ts";
import { parseView } from "../../../src/shell/lib/view.ts";
import { registry, storyRegistry } from "../../harness/fixtures.ts";

describe("parseView", () => {
  test("UT-022 a screen URL opens the screen view with its state, width and theme", () => {
    const parsed = parseView("?p=login-form&state=error&w=1440&theme=dark");
    expect(parsed.view).toEqual({
      area: "screen",
      slug: "login-form",
      state: "error",
      width: 1440,
      role: null,
      compare: false,
      comment: null,
    });
    expect(parsed.theme).toBe("dark");
    expect(parsed.canonical).toBe("?p=login-form&state=error&w=1440&theme=dark");
  });

  test("UT-023 widths outside 320–3840 are clamped and the canonical URL carries the clamp", () => {
    const narrow = parseView("?p=login-form&w=100");
    const wide = parseView("?p=login-form&w=9999");
    expect(narrow.view).toMatchObject({ width: 320 });
    expect(narrow.canonical).toBe("?p=login-form&w=320");
    expect(wide.view).toMatchObject({ width: 3840 });
    expect(wide.canonical).toBe("?p=login-form&w=3840");
  });

  test("UT-024 spec and flow together open the flow and drop spec", () => {
    const parsed = parseView("?spec=auth&flow=sign-in&node=error");
    expect(parsed.view).toEqual({ area: "flow", flow: "sign-in", node: "error", comment: null });
    expect(parsed.canonical).toBe("?flow=sign-in&node=error");
  });

  test("a story URL opens the component's story with its width and theme", () => {
    const parsed = parseView("?c=ui-button&story=ui-button--primary&theme=dark&w=390");
    expect(parsed.view).toEqual({
      area: "component",
      slug: "ui-button",
      story: "ui-button--primary",
      width: 390,
      compare: false,
      comment: null,
    });
    expect(parsed.theme).toBe("dark");
    expect(parsed.canonical).toBe("?c=ui-button&story=ui-button--primary&w=390&theme=dark");
    expect(parseView("?c=ui-button&story=ui-button--primary&compare=themes").view).toMatchObject({
      compare: true,
    });
    expect(parseView("?c=ui-button").view).toMatchObject({ area: "component", story: null });
    expect(parseView("?components")).toMatchObject({
      view: { area: "components" },
      canonical: "?components",
    });
  });

  test("c ranks after flow and p and before spec and the area parameters", () => {
    // Invariant: `flow` > `p` > `c` > `spec` > area params (`_dx.md` § URLs). Owner: view model.
    expect(parseView("?c=ui-button&flow=sign-in").canonical).toBe("?flow=sign-in");
    expect(parseView("?c=ui-button&story=ui-button--primary&p=login-form").canonical).toBe(
      "?p=login-form"
    );
    expect(parseView("?spec=auth&c=ui-button").canonical).toBe("?c=ui-button");
    expect(parseView("?components&c=ui-button").canonical).toBe("?c=ui-button");
    expect(parseView("?screens&components").canonical).toBe("?screens");
  });
});

describe("component tree", () => {
  const file = (slug: string, title: string, root = "ui"): RegistryStoryFile => ({
    slug,
    root,
    file: `src/${slug}.stories.tsx`,
    title,
    path: title.split("/"),
    description: null,
    stories: [
      { id: `${slug}--default`, exportName: "Default", name: "Default", play: false, tags: [] },
    ],
  });
  /** `[kind, label, children]` per node; stories as their label. */
  const shape = (nodes: readonly StoryTreeNode[]): unknown[] =>
    nodes.map(node =>
      node.kind === "story" ? node.label : [node.kind, node.label, shape(node.children)]
    );

  test("UT-008 titles nest by segment, with roots on top only when there are two or more", () => {
    // Invariant: the tree mirrors `/` segments (US-002.AC-1). Owner: `buildStoryTree`.
    const files = [file("d", "D"), file("a-c", "A/C"), file("a-b", "A/B")];
    expect(
      shape(buildStoryTree({ storyRoots: [{ id: "ui", title: "UI" }], stories: files }))
    ).toEqual([
      [
        "group",
        "A",
        [
          ["component", "B", ["Default"]],
          ["component", "C", ["Default"]],
        ],
      ],
      ["component", "D", ["Default"]],
    ]);
    const roots = [
      { id: "ui", title: "UI" },
      { id: "web", title: "Web" },
      { id: "empty", title: "Empty" },
    ];
    expect(
      shape(
        buildStoryTree({ storyRoots: roots, stories: [file("a-b", "A/B"), file("d", "D", "web")] })
      )
    ).toEqual([
      ["root", "UI", [["group", "A", [["component", "B", ["Default"]]]]]],
      ["root", "Web", [["component", "D", ["Default"]]]],
      ["root", "Empty", []],
    ]);
  });

  test("two files on one title each keep a component node, so no story is hidden", () => {
    // Invariant: every indexed story is reachable in the tree (OPUS-007, `_dx.md` title rule).
    // Owner: `buildStoryTree`.
    const tree = buildStoryTree({
      storyRoots: [{ id: "ui", title: "UI" }],
      stories: [file("a-b", "A/B"), file("a-b-copy", "A/B")],
    });
    expect(shape(tree)).toEqual([
      [
        "group",
        "A",
        [
          ["component", "B", ["Default"]],
          ["component", "B", ["Default"]],
        ],
      ],
    ]);
    const ids = tree[0].children.map(node => node.id);
    expect(new Set(ids).size).toBe(2);
    // Same-label siblings carry their file, so each row has its own accessible name.
    expect(tree[0].children.map(node => node.detail)).toEqual([
      "src/a-b.stories.tsx",
      "src/a-b-copy.stories.tsx",
    ]);
    expect(revealIds(tree, "a-b-copy")).toEqual([tree[0].id, ids[1]]);
  });

  test("a first segment repeating its root's title folds into the root node", () => {
    // Invariant: no `App › App` twin folder, so two rows never share a name (S2). Owner:
    // `buildStoryTree`. Folding needs root nodes (two or more roots) and keeps one-segment titles.
    const roots = [
      { id: "app", title: "App" },
      { id: "ui", title: "UI" },
    ];
    const tree = buildStoryTree({
      storyRoots: roots,
      stories: [
        file("app-login", "App/Login form", "app"),
        file("ui-actions-button", "ui/Actions/Button"),
        file("ui", "UI"),
      ],
    });
    expect(shape(tree)).toEqual([
      ["root", "App", [["component", "Login form", ["Default"]]]],
      [
        "root",
        "UI",
        [
          ["group", "Actions", [["component", "Button", ["Default"]]]],
          ["component", "UI", ["Default"]],
        ],
      ],
    ]);
    expect(revealIds(tree, "ui-actions-button")).toHaveLength(3);
    expect(tree.flatMap(node => node.children).every(node => node.detail === null)).toBe(true);
    // A single root has no root node: its first segment stays a folder.
    const single = buildStoryTree({
      storyRoots: [roots[0]],
      stories: [file("app-login", "App/Login form", "app")],
    });
    expect(shape(single)).toEqual([["group", "App", [["component", "Login form", ["Default"]]]]]);
  });

  test("a deep link expands the tree down to its story", () => {
    // Invariant: US-002.AC-3. Owner: the tree model (`revealIds`, `visibleRows`).
    const tree = buildStoryTree(storyRegistry);
    const rows = visibleRows(tree, new Set(revealIds(tree, "ui-button")));
    expect(rows.map(row => [row.level, row.node.label])).toEqual([
      [1, "Web"],
      [1, "UI kit"],
      [2, "UI"],
      [3, "Button"],
      [4, "Primary"],
      [4, "Render Fail"],
      [4, "Import Fail"],
      [3, "Card"],
    ]);
  });

  test("UT-010 an unknown story id stays in the URL and resolves to not found", () => {
    // Invariant: US-002.EC-2, never another story. Owner: `parseView` and `resolveStoryView`.
    const parsed = parseView("?c=ui-button&story=nope");
    expect(parsed.view).toMatchObject({ area: "component", slug: "ui-button", story: "nope" });
    expect(parsed.canonical).toBe("?c=ui-button&story=nope");
    expect(resolveStoryView(storyRegistry, "ui-button", "nope")).toMatchObject({
      kind: "missing-story",
      story: "nope",
    });
    expect(resolveStoryView(storyRegistry, "gone", null)).toEqual({
      kind: "missing-component",
      slug: "gone",
    });
    expect(resolveStoryView(storyRegistry, "ui-button", "ui-button--primary")).toMatchObject({
      kind: "component",
      story: { id: "ui-button--primary" },
    });
  });
});

describe("availableView", () => {
  test("a Components link in an app without story roots opens the overview; `?c=` stays not found", () => {
    // Invariant: no empty Components area without stories (US-012.AC-2, US-002.EC-2, OPUS-013).
    // Owner: `availableView` and `resolveStoryView`, which the shell's page selection applies.
    const components = parseView("?components").view;
    expect(components).toEqual({ area: "components" });
    expect(availableView(components, registry)).toEqual({ area: "overview" });
    expect(availableView(components, { storyRoots: [] })).toEqual({ area: "overview" });
    expect(availableView(components, storyRegistry)).toEqual({ area: "components" });

    const component = parseView("?c=ui-button").view;
    expect(availableView(component, registry)).toBe(component);
    expect(resolveStoryView(registry, "ui-button", null)).toEqual({
      kind: "missing-component",
      slug: "ui-button",
    });
  });
});

describe("useLocation", () => {
  const roots: (() => void)[] = [];
  afterEach(() => {
    for (const unmount of roots.splice(0)) unmount();
    window.history.replaceState(null, "", window.location.pathname);
  });

  test("UT-023 an out-of-range width in the address bar is rewritten in place", async () => {
    window.history.replaceState(null, "", `${window.location.pathname}?p=login-form&w=9999`);
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useLocation().view);
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    roots.push(() => root.unmount());
    root.render(createElement(Probe));
    await vi.waitFor(() => expect(window.location.search).toBe("?p=login-form&w=3840"));
    expect(seen.at(-1)).toMatchObject({ area: "screen", width: 3840 });
  });
});
