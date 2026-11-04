import { useEffect, useEffectEvent } from "react";
import type { Anchor, PickMode, ShellMessage } from "../model/protocol.ts";
import type { Bridge } from "./bridge.ts";
import { queryElement } from "./dom.ts";

/** The shell side drives picking, anchors and scrolling; everything else stays local. */
export function useShellMessages(
  bridge: Bridge,
  handlers: {
    pick: (mode: PickMode | null) => void;
    anchors: (anchors: Anchor[]) => void;
  }
) {
  const onMessage = useEffectEvent((message: ShellMessage) => {
    if (message.type === "pick:start") handlers.pick(message.mode);
    else if (message.type === "pick:cancel") handlers.pick(null);
    else if (message.type === "anchors:watch") handlers.anchors(message.anchors);
    else if (message.type === "scroll:to") {
      queryElement(document, message.selector)?.scrollIntoView({ block: "center" });
    }
  });
  useEffect(() => {
    const stop = bridge.listen(onMessage);
    return () => stop();
  }, [bridge]);
}
