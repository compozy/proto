/**
 * ⌘K ranking (`_tests.md` UT-025, UT-009): exact slug > title > state label > comment text;
 * components and their stories are results with their own kinds.
 */
import { expect, test } from "vitest";

import { registryItems, searchItems, type SearchItem } from "../../../src/shell/lib/search.ts";
import { componentView, screenView } from "../../../src/shell/lib/view.ts";
import { registry, storyRegistry } from "../../harness/fixtures.ts";

const comment = (text: string): SearchItem => ({
  id: `c:${text}`,
  group: "comments",
  label: text,
  text,
  target: { view: screenView("login-form") },
});

test("UT-025 search ranks exact slug, then title, then state label, then comment text", () => {
  const items: SearchItem[] = [
    comment("The invoice total wraps"),
    ...registryItems(registry),
    {
      id: "x:title",
      group: "screens",
      label: "Invoice history",
      title: "Invoice history",
      target: { view: screenView("invoice-history") },
    },
    {
      id: "x:state",
      group: "states",
      label: "Billing · Invoice sent",
      stateLabel: "Invoice sent",
      target: { view: screenView("billing", "sent") },
    },
  ];
  const ranked = searchItems(items, "invoice").map(item => item.id);
  expect(ranked[0]).toBe("p:invoice");
  expect(ranked.indexOf("x:title")).toBeLessThan(ranked.indexOf("x:state"));
  expect(ranked.indexOf("x:state")).toBeLessThan(ranked.indexOf("c:The invoice total wraps"));
  expect(ranked.at(-1)).toBe("c:The invoice total wraps");
});

test("UT-025 a state label matches by its label and opens that state", () => {
  const [first] = searchItems(registryItems(registry), "wrong");
  expect(first).toMatchObject({ group: "states", label: "Sign in · Wrong password" });
  expect(first?.target).toEqual({ view: screenView("login-form", "error") });
});

test("UT-025 no match returns nothing", () => {
  expect(searchItems(registryItems(registry), "zzz-nothing")).toEqual([]);
});

test("UT-009 a query returns the component and its stories, each with its kind", () => {
  // Invariant: US-002.AC-2. Owner: `registryItems` + `searchItems`.
  const results = searchItems(registryItems(storyRegistry), "button");
  expect(results.map(item => [item.group, item.label])).toEqual([
    ["components", "UI/Button"],
    ["stories", "UI/Button · Primary"],
    ["stories", "UI/Button · Render Fail"],
    ["stories", "UI/Button · Import Fail"],
  ]);
  expect(results[0]?.target).toEqual({ view: componentView("ui-button") });
  expect(results[1]?.target).toEqual({ view: componentView("ui-button", "ui-button--primary") });
  expect(searchItems(registryItems(storyRegistry), "primary")[0]).toMatchObject({
    group: "stories",
    label: "UI/Button · Primary",
  });
});
