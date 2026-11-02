import type { ComponentProps, MouseEvent } from "react";

import { go, hrefOf } from "../lib/navigation";
import { preloadView } from "../lib/preload";
import { usePrefetchReview } from "../review/data";
import { parseView, type View } from "../lib/view";

/** A real link to a shell view: plain clicks navigate in place, modified clicks open a tab. */
export function Link({
  to,
  onClick,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: { to: View } & ComponentProps<"a">) {
  const prefetchReview = usePrefetchReview();
  const preload = () => {
    preloadView(to);
    if (to.area === "screen") prefetchReview(to.slug);
    else if (to.area === "flow") prefetchReview(`flow-${to.flow}`);
  };
  const href = hrefOf({ view: to, theme: parseView(window.location.search).theme });
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(to);
  };
  return (
    <a
      {...props}
      href={href}
      onClick={click}
      onMouseEnter={event => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented) preload();
      }}
      onFocus={event => {
        onFocus?.(event);
        if (!event.defaultPrevented) preload();
      }}
      onTouchStart={event => {
        onTouchStart?.(event);
        if (!event.defaultPrevented) preload();
      }}
    />
  );
}
