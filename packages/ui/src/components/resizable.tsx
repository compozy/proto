// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { cn } from "@proto/ui/lib/utils";
import * as ResizablePrimitive from "react-resizable-panels";

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "defaults:flex defaults:h-full defaults:w-full defaults:aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "defaults:relative defaults:flex defaults:w-px defaults:items-center defaults:justify-center defaults:bg-border defaults:ring-offset-background defaults:after:absolute defaults:after:inset-y-0 defaults:after:left-1/2 defaults:after:w-1 defaults:after:-translate-x-1/2 defaults:focus-visible:ring-1 defaults:focus-visible:ring-ring defaults:focus-visible:outline-hidden defaults:aria-[orientation=horizontal]:h-px defaults:aria-[orientation=horizontal]:w-full defaults:aria-[orientation=horizontal]:after:left-0 defaults:aria-[orientation=horizontal]:after:h-1 defaults:aria-[orientation=horizontal]:after:w-full defaults:aria-[orientation=horizontal]:after:translate-x-0 defaults:aria-[orientation=horizontal]:after:-translate-y-1/2 defaults:[&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="defaults:z-10 defaults:flex defaults:h-6 defaults:w-1 defaults:shrink-0 defaults:rounded-lg defaults:bg-border" />
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
