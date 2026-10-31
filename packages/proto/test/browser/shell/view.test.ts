/**
 * URL and view model (`_tests.md` UT-022–UT-024): the shell view lives in its URL, widths are
 * clamped to 320–3840 with the URL rewritten, and conflicting selections resolve to one view.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useLocation } from "../../../src/shell/lib/navigation.ts";
import { parseView } from "../../../src/shell/lib/view.ts";

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
