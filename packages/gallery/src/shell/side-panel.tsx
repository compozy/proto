/**
 * The main area beside an optional right panel (comments, flow inspector). From 768 px the two sit
 * in a `ResizablePanelGroup`: drag (or arrow keys on) the handle to resize the panel, and the
 * width is remembered per view kind. Below that the panel stacks under the main area.
 */
import type { ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@proto/ui/components/resizable";
import { useIsMobile } from "@proto/ui/hooks/use-mobile";

function savedWidth(key: string) {
  const width = Number(localStorage.getItem(key));
  return Number.isFinite(width) && width > 0 ? `${width}px` : "340px";
}

export function WithSidePanel({
  id,
  label,
  side,
  children,
}: {
  /** Layout key: one remembered width per kind of panel. */
  id: string;
  /** Accessible name of the resize handle. */
  label: string;
  side: ReactNode | null;
  children: ReactNode;
}) {
  const mobile = useIsMobile();
  const key = `gallery-panel-width:${id}`;
  if (mobile) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {children}
        {side ? <div className="flex max-h-[45dvh] min-h-60 shrink-0">{side}</div> : null}
      </div>
    );
  }
  // The main panel keeps its place whether or not the side panel shows, so the canvas (and its
  // iframe) is never remounted by opening the panel.
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
      <ResizablePanel id="main" minSize="40%" className="flex h-full min-w-0">
        {children}
      </ResizablePanel>
      {side ? (
        <>
          <ResizableHandle
            withHandle
            aria-label={label}
            className="mx-1 w-1.5 rounded-full bg-transparent hover:bg-border focus-visible:bg-border"
            data-testid="side-panel-handle"
          />
          <ResizablePanel
            id="side"
            defaultSize={savedWidth(key)}
            onResize={size => localStorage.setItem(key, String(size.inPixels))}
            minSize="280px"
            maxSize="50%"
            groupResizeBehavior="preserve-pixel-size"
            className="flex h-full min-w-0"
          >
            {side}
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}
