/**
 * Slots for the review slice (comment mode, threads, approval, inbox — S8–S11): the browsing
 * shell renders whatever a slot returns and nothing when it is unset, so no control is ever
 * rendered without behavior behind it.
 */
import { createContext, use, type ComponentType, type ReactNode } from "react";

import type { RenderMessage } from "../../model/protocol";
import type { FrameGeometry } from "../frames/screen-frame";
import type { RenderFrameHandle } from "../frames/use-render-frame";

/** The reviewable item on screen: a prototype state or a flow (key `flow-<id>`). */
export type ReviewTarget =
  | { kind: "prototype"; key: string; slug: string; state: string }
  | { kind: "flow"; key: string; flow: string; node: string | null };

/** `count` is a number (rendered as a pill) or a node that renders its own pill. */
export type InspectorTab = {
  id: string;
  label: string;
  count?: number | ReactNode;
  content: ReactNode;
};

export type ShellSlots = {
  /** Top bar, after the problems badge: open count and Approve. */
  reviewActions?: (target: ReviewTarget | null) => ReactNode;
  /** Sub-header status pill of the open item. */
  reviewStatus?: (target: ReviewTarget) => ReactNode;
  /** Sub-header More menu of the open item (Reopen). */
  reviewMenu?: (target: ReviewTarget) => ReactNode;
  /** Inspector tabs appended after the browsing tabs (Comments). */
  inspectorTabs?: (target: ReviewTarget) => InspectorTab[];
  /** Tools appended to the canvas toolbars (comment mode). */
  canvasTools?: (target: ReviewTarget) => ReactNode;
  /** Protocol messages and the in-frame overlay (picking, pins) of the screen view's frame. */
  screenFrame?: (target: Extract<ReviewTarget, { kind: "prototype" }>) => {
    onMessage?: (message: RenderMessage) => void;
    overlay?: (frame: RenderFrameHandle, geometry: FrameGeometry) => ReactNode;
  };
  /** The message composer with image attachments (comment mode); replies reuse it. */
  composer?: ComponentType<ComposerProps>;
};

/**
 * The thread focused through comment mode (pin clicks) and the setter threads call when a thread
 * is focused (comment mode scrolls to its anchor and highlights the pin). Comment mode provides
 * it; without it the threads keep their own focus.
 */
export type CommentFocus = { focused: string | null; focusComment: (id: string | null) => void };

const CommentFocusContext = createContext<CommentFocus | null>(null);

export const CommentFocusProvider = CommentFocusContext.Provider;

export function useCommentFocus() {
  return use(CommentFocusContext);
}

/** Props of the shared composer (`review/comment-mode/composer.tsx`). */
export type ComposerProps = {
  /** Pending uploads go to `POST attachments?key=<reviewKey>`. */
  reviewKey: string;
  submitLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Persist the unsent text under this scope (`review/drafts.ts`, S18). */
  draftScope?: string;
  /** Throw a `ReviewApiError` to show it inline; the draft is kept. */
  onSubmit: (input: { body: string; attachments: string[] }) => Promise<void>;
  /** Pending uploads are discarded on cancel and unmount. */
  onCancel?: () => void;
  className?: string;
};

const SlotsContext = createContext<ShellSlots>({});

export const ShellSlotsProvider = SlotsContext.Provider;

export function useSlots() {
  return use(SlotsContext);
}
