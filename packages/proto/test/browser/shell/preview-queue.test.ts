/**
 * Preview queue (`_tests.md` UT-021, ADR-002 risk): flow and card previews mount at most 3 at a
 * time and keep at most 12, evicting the least recently seen.
 */
import { expect, test } from "vitest";
import { previewLogic } from "../../../src/shell/lib/preview-scheduler.ts";

import {
  maxKeptPreviews,
  maxLoadingPreviews,
  schedulePreviews,
  settlePreview,
  type PreviewPlan,
} from "../../../src/shell/lib/preview-queue.ts";

const ids = (count: number, from = 0) =>
  Array.from({ length: count }, (_, index) => `n${from + index}`);
const sources = new Map(ids(40).map(id => [id, `/render/${id}`]));
const view = (visible: string[], near: string[] = visible) => ({ visible, near: new Set(near) });
const settleAll = (plan: PreviewPlan) =>
  plan.reduce((current, entry) => settlePreview(current, entry.id, entry.src), plan);

test("UT-021 at most 3 previews load at once", () => {
  const plan = schedulePreviews([], view(ids(10)), sources);
  expect(plan.filter(entry => entry.status === "loading")).toHaveLength(maxLoadingPreviews);
  expect(plan.map(entry => entry.id)).toEqual(["n0", "n1", "n2"]);
  // A settled preview frees its slot for the next visible one.
  const next = schedulePreviews(settlePreview(plan, "n0", "/render/n0"), view(ids(10)), sources);
  expect(next.filter(entry => entry.status === "loading").map(entry => entry.id)).toEqual([
    "n1",
    "n2",
    "n3",
  ]);
});

test("UT-021 at most 12 previews stay mounted, evicting the least recently seen", () => {
  let plan: PreviewPlan = [];
  const all = ids(20);
  // Pan across 20 nodes three at a time, keeping every one of them near.
  for (let start = 0; start < all.length; start += 3) {
    plan = settleAll(schedulePreviews(plan, view(all.slice(start, start + 3), all), sources));
  }
  expect(plan.length).toBeLessThanOrEqual(maxKeptPreviews);
  expect(plan).toHaveLength(maxKeptPreviews);
  const mounted = plan.map(entry => entry.id);
  // The first nodes seen were evicted; the latest ones are kept.
  expect(mounted).not.toContain("n0");
  expect(mounted).toContain("n19");
  expect(mounted).toContain("n8");
});

test("UT-021 ready previews survive leaving the viewport until there is eviction pressure", () => {
  // Owner: preview admission queue. Off-screen reuse stays bounded by the same LRU budget.
  const loaded = settleAll(schedulePreviews([], view(ids(3)), sources));
  const away = schedulePreviews(loaded, view(ids(3, 3)), sources);
  expect(away.filter(entry => entry.status === "loaded")).toEqual(loaded);
  const changed = new Map(sources).set("n0", "/render/n0?theme=dark");
  expect(schedulePreviews(loaded, view(["n0"]), changed).find(entry => entry.id === "n0")).toEqual({
    id: "n0",
    src: "/render/n0?theme=dark",
    status: "loading",
  });
});

test("preview subscribers observe settlement even when no queued frame needs the slot", async () => {
  // Owner: scheduler store. A late ready message cannot settle a replacement source.
  const store = previewLogic.createStore();
  const seen: string[] = [];
  const subscription = store
    .select(context => context.plan[0]?.status ?? "idle")
    .subscribe(status => seen.push(status));
  const registration = { src: "/one", visible: true, near: true, order: 0 };
  store.trigger.registered({ id: "one", registration });
  await Promise.resolve();
  store.trigger.settled({ id: "one", src: "/one" });
  await Promise.resolve();
  expect(seen).toEqual(["loading", "loaded"]);
  store.trigger.registered({ id: "one", registration: { ...registration, src: "/two" } });
  await Promise.resolve();
  store.trigger.settled({ id: "one", src: "/one" });
  await Promise.resolve();
  expect(store.getSnapshot().context.plan).toEqual([{ id: "one", src: "/two", status: "loading" }]);
  store.trigger.removed({ id: "one" });
  await Promise.resolve();
  expect(store.getSnapshot().context.plan).toEqual([]);
  subscription.unsubscribe();
});
