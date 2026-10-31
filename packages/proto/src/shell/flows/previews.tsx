/**
 * The canvas's preview queue (`preview-queue.ts`) as a small store. Prototype nodes register
 * their preview source and read whether their preview is mounted; external nodes never register,
 * so they never become iframes. The plan changes only once a pan or zoom has settled for
 * `settleDelayMs`, never mid-gesture or in a brief pause between drags, and a preview that
 * reports ready or fails lets the next queued one start.
 */
import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useOnViewportChange, useStoreApi } from "@xyflow/react";

import {
  previewView,
  schedulePreviews,
  settlePreview,
  type PreviewPlan,
  type PreviewView,
} from "./preview-queue";

const settleDelayMs = 200;

function createPreviewQueue() {
  let plan: PreviewPlan = [];
  // Nothing starts before the viewport first settles on the laid-out flow.
  let view: PreviewView | null = null;
  let moving = true;
  let settling: number | undefined;
  const sources = new Map<string, string>();
  const listeners = new Set<() => void>();

  const commit = (next: PreviewPlan) => {
    plan = next;
    for (const listener of listeners) listener();
  };
  const replan = () => {
    if (view && !moving) commit(schedulePreviews(plan, view, sources));
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mounted(id: string, src: string) {
      return plan.some(entry => entry.id === id && entry.src === src);
    },
    register(id: string, src: string) {
      sources.set(id, src);
      replan();
      return () => {
        if (sources.get(id) === src) sources.delete(id);
        replan();
      };
    },
    moveStart() {
      moving = true;
      window.clearTimeout(settling);
    },
    settle(next: PreviewView) {
      view = next;
      window.clearTimeout(settling);
      settling = window.setTimeout(() => {
        moving = false;
        replan();
      }, settleDelayMs);
    },
    settled(id: string, src: string) {
      commit(settlePreview(plan, id, src));
      replan();
    },
  };
}

type PreviewQueueStore = ReturnType<typeof createPreviewQueue>;

const PreviewQueueContext = createContext<PreviewQueueStore | null>(null);

/** Plans the previews of the canvas inside it; `ready` once the layout has placed the nodes. */
export function PreviewQueue({ ready, children }: { ready: boolean; children: ReactNode }) {
  const flowStore = useStoreApi();
  const [queue] = useState(createPreviewQueue);

  const settle = () => {
    if (!ready) return;
    const { transform, width, height, nodeLookup } = flowStore.getState();
    const nodes = [...nodeLookup.values()].map(node => ({
      id: node.id,
      x: node.internals.positionAbsolute.x,
      y: node.internals.positionAbsolute.y,
      width: node.measured.width ?? 0,
      height: node.measured.height ?? 0,
    }));
    const [x, y, zoom] = transform;
    queue.settle(previewView(nodes, { x, y, zoom, width, height }));
  };
  useOnViewportChange({ onStart: () => queue.moveStart(), onEnd: settle });

  return <PreviewQueueContext value={queue}>{children}</PreviewQueueContext>;
}

/** Whether this node's preview is mounted, and how it reports that it finished loading. */
export function usePreview(id: string, src: string) {
  const queue = use(PreviewQueueContext);
  if (!queue) throw new Error("usePreview needs a PreviewQueue");
  useEffect(() => queue.register(id, src), [queue, id, src]);
  const mounted = useSyncExternalStore(queue.subscribe, () => queue.mounted(id, src));
  return { mounted, onSettle: () => queue.settled(id, src) };
}
