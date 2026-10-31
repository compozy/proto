/**
 * Slots for the review slice (comment mode, threads, approval, inbox — S8–S11): the browsing
 * shell renders whatever a slot returns and nothing when it is unset, so no control is ever
 * rendered without behavior behind it.
 */
import { createContext, use, type ReactNode } from "react";

/** The reviewable item on screen: a prototype state or a flow (key `flow-<id>`). */
export type ReviewTarget =
  | { kind: "prototype"; key: string; slug: string; state: string }
  | { kind: "flow"; key: string; flow: string; node: string | null };

export type InspectorTab = { id: string; label: string; count?: number; content: ReactNode };

export type ShellSlots = {
  /** Top bar, after the problems badge: open count and Approve. */
  reviewActions?: (target: ReviewTarget | null) => ReactNode;
  /** Sub-header status pill of the open item. */
  reviewStatus?: (target: ReviewTarget) => ReactNode;
  /** Inspector tabs appended after the browsing tabs (Comments). */
  inspectorTabs?: (target: ReviewTarget) => InspectorTab[];
  /** Tools appended to the canvas toolbars (comment mode). */
  canvasTools?: (target: ReviewTarget) => ReactNode;
};

const SlotsContext = createContext<ShellSlots>({});

export const ShellSlotsProvider = SlotsContext.Provider;

export function useSlots() {
  return use(SlotsContext);
}
