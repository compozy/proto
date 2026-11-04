/**
 * Comment mode state (S8): the active canvas tool, whether picking started from the keyboard,
 * with URL-owned focus shared with the threads (S9).
 */
import { createContext, use, type ReactNode } from "react";
import { createStoreLogic, useSelector, useStore } from "@xstate/store-react";
import { go, useLocation } from "../../lib/navigation";

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

const commentLogic = createStoreLogic({
  context: { tool: "select" as CommentTool, keyboard: false },
  on: {
    toolChanged: (context, event: { tool: CommentTool; keyboard?: boolean }) => {
      const keyboard = event.keyboard ?? false;
      return context.tool === event.tool && context.keyboard === keyboard
        ? context
        : { tool: event.tool, keyboard };
    },
  },
});

const CommentModeContext = createContext<ReturnType<typeof commentLogic.createStore> | null>(null);

export function CommentModeProvider({ children }: { children: ReactNode }) {
  const store = useStore(commentLogic);
  return <CommentModeContext value={store}>{children}</CommentModeContext>;
}

/** Read the comment-tool store and reject use outside the owning provider. */
function useCommentStore() {
  const store = use(CommentModeContext);
  if (!store) throw new Error("Comment mode requires its provider");
  return store;
}

/** Tool controls do not subscribe to thread focus or frame messages. */
export function useCommentTool() {
  const store = useCommentStore();
  return {
    ...useSelector(store, state => state.context),
    setTool: (tool: CommentTool, options?: { keyboard?: boolean }) =>
      store.trigger.toolChanged({ tool, ...options }),
  };
}

/** Read and replace comment focus in the screen, flow or story URL: links and history share it. */
export function useCommentFocusState() {
  const { view } = useLocation();
  const reviewable = view.area === "screen" || view.area === "flow" || view.area === "component";
  return {
    focused: reviewable ? (view.comment ?? null) : null,
    focusComment: (id: string | null) => {
      if (reviewable) go({ ...view, comment: id }, { replace: true });
    },
  };
}

export function useCommentMode(): CommentModeValue {
  return { ...useCommentTool(), ...useCommentFocusState() };
}
