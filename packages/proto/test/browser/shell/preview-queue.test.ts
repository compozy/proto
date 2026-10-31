/**
 * Preview queue (`_tests.md` UT-021, ADR-002 risk): flow and card previews mount at most 3 at a
 * time and keep at most 12, evicting the least recently seen.
 */
import { expect, test } from "vitest";

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
