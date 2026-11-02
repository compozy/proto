/** One event-driven preview queue per surface; each frame subscribes only to its own slot. */
import { createStoreLogic } from "@xstate/store";
import { useSelector } from "@xstate/store-react";
import { createContext, use, useEffect } from "react";

import { schedulePreviews, settlePreview, type PreviewPlan } from "./preview-queue";

type Registration = { src: string; visible: boolean; near: boolean; order: number };
export type PreviewSlot = "idle" | "loading" | "loaded";

type PreviewContext = { entries: Map<string, Registration>; plan: PreviewPlan; pending: boolean };
type PreviewEvents = {
  registered: { id: string; registration: Registration };
  removed: { id: string };
  settled: { id: string; src: string };
  planned: Record<never, never>;
};

export const previewLogic = createStoreLogic<PreviewContext, PreviewEvents>({
  context: {
    entries: new Map<string, Registration>(),
    plan: [] as PreviewPlan,
    pending: false,
  },
  on: {
    registered: (context, event: { id: string; registration: Registration }, enqueue) => {
      const previous = context.entries.get(event.id);
      const next = event.registration;
      if (
        previous?.src === next.src &&
        previous.visible === next.visible &&
        previous.near === next.near &&
        previous.order === next.order
      )
        return context;
      if (!context.pending)
        enqueue.effect(({ trigger }) => queueMicrotask(() => trigger.planned()));
      return { ...context, entries: new Map(context.entries).set(event.id, next), pending: true };
    },
    removed: (context, event: { id: string }, enqueue) => {
      if (!context.entries.has(event.id)) return context;
      const entries = new Map(context.entries);
      entries.delete(event.id);
      if (!context.pending)
        enqueue.effect(({ trigger }) => queueMicrotask(() => trigger.planned()));
      return { ...context, entries, pending: true };
    },
    settled: (context, event: { id: string; src: string }, enqueue) => {
      if (!context.pending)
        enqueue.effect(({ trigger }) => queueMicrotask(() => trigger.planned()));
      return { ...context, plan: settlePreview(context.plan, event.id, event.src), pending: true };
    },
    planned: context => {
      const entries = [...context.entries].sort(([, a], [, b]) => a.order - b.order);
      const sources = new Map(entries.map(([id, entry]) => [id, entry.src]));
      const view = {
        visible: entries.filter(([, entry]) => entry.visible).map(([id]) => id),
        near: new Set(entries.filter(([, entry]) => entry.near).map(([id]) => id)),
      };
      return { ...context, plan: schedulePreviews(context.plan, view, sources), pending: false };
    },
  },
});

const SchedulerContext = createContext<ReturnType<typeof previewLogic.createStore> | null>(null);
export const PreviewSchedulerProvider = SchedulerContext.Provider;
export function usePreviewScheduler() {
  const scheduler = use(SchedulerContext);
  if (!scheduler) throw new Error("usePreviewScheduler outside its provider");
  return scheduler;
}

/** Registers while mounted; unrelated slots never rerender this preview. */
export function usePreviewSlot(id: string, registration: Registration): PreviewSlot {
  const scheduler = usePreviewScheduler();
  const { src, visible, near, order } = registration;
  useEffect(() => {
    scheduler.trigger.registered({ id, registration: { src, visible, near, order } });
  }, [scheduler, id, src, visible, near, order]);
  useEffect(() => () => scheduler.trigger.removed({ id }), [scheduler, id]);
  return useSelector(scheduler, snapshot => {
    const entry = snapshot.context.plan.find(item => item.id === id && item.src === src);
    return entry?.status ?? "idle";
  });
}
