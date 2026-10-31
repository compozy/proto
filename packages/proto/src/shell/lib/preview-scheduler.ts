/**
 * A live store around the preview queue (`preview-queue.ts`): previews register their source and
 * visibility, the scheduler re-plans and each preview mounts its iframe only while planned. One
 * scheduler per surface (the flow canvas) or the shared one for card grids (overview, spec page,
 * drafts), so the whole shell never loads more than 3 previews at once per surface.
 */
import { createContext, use, useEffect, useSyncExternalStore } from "react";

import { schedulePreviews, settlePreview, type PreviewPlan } from "./preview-queue";

type Registration = { src: string; visible: boolean; near: boolean; order: number };
export type PreviewSlot = "idle" | "loading" | "loaded";

export class PreviewScheduler {
  #entries = new Map<string, Registration>();
  #plan: PreviewPlan = [];
  #listeners = new Set<() => void>();
  #pending = false;

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  slot(id: string, src: string): PreviewSlot {
    const entry = this.#plan.find(item => item.id === id && item.src === src);
    return entry ? (entry.status === "loading" ? "loading" : "loaded") : "idle";
  }

  set(id: string, registration: Registration) {
    this.#entries.set(id, registration);
    this.#schedule();
  }

  remove(id: string) {
    this.#entries.delete(id);
    this.#schedule();
  }

  /** The preview reported ready or failed: its loading slot frees up. */
  settle(id: string, src: string) {
    this.#plan = settlePreview(this.#plan, id, src);
    this.#schedule();
  }

  /** Re-plans in a microtask, so a batch of registrations (a grid mounting) plans once. */
  #schedule() {
    if (this.#pending) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      const entries = [...this.#entries].sort(([, a], [, b]) => a.order - b.order);
      const sources = new Map(entries.map(([id, entry]) => [id, entry.src]));
      const view = {
        visible: entries.filter(([, entry]) => entry.visible).map(([id]) => id),
        near: new Set(entries.filter(([, entry]) => entry.near).map(([id]) => id)),
      };
      const plan = schedulePreviews(this.#plan, view, sources);
      const changed =
        plan.length !== this.#plan.length ||
        plan.some((entry, index) => entry !== this.#plan[index]);
      this.#plan = plan;
      if (changed) for (const listener of this.#listeners) listener();
    });
  }
}

const SchedulerContext = createContext(new PreviewScheduler());

export const PreviewSchedulerProvider = SchedulerContext.Provider;

export function usePreviewScheduler() {
  return use(SchedulerContext);
}

/** The slot of one preview; registers it while mounted. */
export function usePreviewSlot(id: string, registration: Registration): PreviewSlot {
  const scheduler = usePreviewScheduler();
  const { src, visible, near, order } = registration;
  useEffect(() => {
    scheduler.set(id, { src, visible, near, order });
  }, [scheduler, id, src, visible, near, order]);
  useEffect(() => () => scheduler.remove(id), [scheduler, id]);
  return useSyncExternalStore(scheduler.subscribe, () => scheduler.slot(id, src));
}
