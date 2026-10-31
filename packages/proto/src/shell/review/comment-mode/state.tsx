/**
 * Comment mode state (S8): the active canvas tool, whether picking started from the keyboard,
 * and the focused comment shared with the threads (S9).
 */
import { createContext, use, useState, type ReactNode } from "react";

import type { RenderMessage } from "../../../model/protocol";

export type CommentTool = "select" | "comment";

export type CommentModeValue = {
  tool: CommentTool;
  /** Picking started from the keyboard (`C`): the frame gets focus and a crosshair. */
  keyboard: boolean;
  setTool: (tool: CommentTool, options?: { keyboard?: boolean }) => void;
  /** The comment whose thread is open; its pin is highlighted and scrolled into view. */
  focused: string | null;
  focusComment: (id: string | null) => void;
};

const CommentModeContext = createContext<CommentModeValue | null>(null);

export function CommentModeProvider({ children }: { children: ReactNode }) {
  const [tool, setToolState] = useState<{ tool: CommentTool; keyboard: boolean }>({
    tool: "select",
    keyboard: false,
  });
  const [focused, setFocused] = useState<string | null>(null);
  const value: CommentModeValue = {
    tool: tool.tool,
    keyboard: tool.keyboard,
    setTool: (next, options) => setToolState({ tool: next, keyboard: options?.keyboard ?? false }),
    focused,
    focusComment: setFocused,
  };
  return <CommentModeContext value={value}>{children}</CommentModeContext>;
}

/** Comment mode state; outside a `CommentModeProvider` the tool stays "select". */
export function useCommentMode(): CommentModeValue {
  return (
    use(CommentModeContext) ?? {
      tool: "select",
      keyboard: false,
      setTool: () => {},
      focused: null,
      focusComment: () => {},
    }
  );
}

/**
 * Validated render messages of the screen frame, fanned out to the mounted comment layers; each
 * layer keeps only the messages of its own frame nonce. One stable function, so the frame's
 * listener is not re-registered on every render.
 */
const frameListeners = new Set<(message: RenderMessage) => void>();

export function onFrameMessage(listener: (message: RenderMessage) => void) {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
}

export const routeMessage = (message: RenderMessage) => {
  for (const listener of frameListeners) listener(message);
};
