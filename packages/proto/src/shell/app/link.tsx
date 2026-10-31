import type { ComponentProps, MouseEvent } from "react";

import { go, hrefOf } from "../lib/navigation";
import { parseView, type View } from "../lib/view";

/** A real link to a shell view: plain clicks navigate in place, modified clicks open a tab. */
export function Link({ to, onClick, ...props }: { to: View } & ComponentProps<"a">) {
  const href = hrefOf({ view: to, theme: parseView(window.location.search).theme });
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(to);
  };
  return <a href={href} onClick={click} {...props} />;
}
