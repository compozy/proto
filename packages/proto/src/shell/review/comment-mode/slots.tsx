/**
 * Comment mode in the shell's slots: the canvas tools (comment tool, `C`; flow comments) and the
 * screen frame's protocol messages and overlay (picking, composer, pins).
 */
import type { ShellSlots } from "../../app/slots";
import { ScreenCommentLayer } from "./screen-layer";
import { routeMessage } from "./state";
import { CommentTools } from "./tools";

export const commentModeSlots: Pick<ShellSlots, "canvasTools" | "screenFrame"> = {
  canvasTools: target => <CommentTools target={target} />,
  screenFrame: target => ({
    onMessage: routeMessage,
    overlay: (frame, geometry) => (
      <ScreenCommentLayer target={target} frame={frame} geometry={geometry} />
    ),
  }),
};
