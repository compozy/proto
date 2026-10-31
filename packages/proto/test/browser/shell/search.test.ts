/** ⌘K ranking (`_tests.md` UT-025): exact slug > title > state label > comment text. */
import { expect, test } from "vitest";

import { registryItems, searchItems, type SearchItem } from "../../../src/shell/lib/search.ts";
import { screenView } from "../../../src/shell/lib/view.ts";
import { registry } from "../../harness/fixtures.ts";

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
