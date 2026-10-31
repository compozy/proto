// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { cn } from "@proto/ui/lib/utils";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@proto/ui/components/collapsible";
import { ChevronRightIcon } from "@proto/ui/lib/icons";

function Trace({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="trace"
      className={cn(
        "defaults:flex defaults:w-full defaults:min-w-0 defaults:flex-col defaults:gap-2 defaults:*:has-[>[data-slot=trace-line]]:flex defaults:*:has-[>[data-slot=trace-line]]:w-fit defaults:*:has-[>[data-slot=trace-line]]:max-w-full defaults:*:has-[>[data-slot=trace-line]]:min-w-0 defaults:*:has-[>[data-slot=trace-line]]:rounded-md defaults:*:has-[>[data-slot=trace-line]]:text-left defaults:*:has-[>[data-slot=trace-line]]:outline-none defaults:*:has-[>[data-slot=trace-line]]:focus-visible:ring-3 defaults:*:has-[>[data-slot=trace-line]]:focus-visible:ring-ring/50",
        className
      )}
      {...props}
    />
  );
}

function TraceLine({
  className,
  status,
  ...props
}: React.ComponentProps<"span"> & {
  status?: "running" | "error" | "pending";
}) {
  return (
    <span
      data-slot="trace-line"
      data-status={status}
      className={cn(
        "defaults:flex defaults:w-fit defaults:max-w-full defaults:min-w-0 defaults:items-center defaults:gap-2 defaults:text-sm defaults:text-muted-foreground defaults:transition-colors defaults:in-[a,button]:cursor-pointer defaults:in-[a:hover,button:hover]:text-foreground defaults:data-[status=error]:text-destructive defaults:data-[status=error]:in-[a:hover,button:hover]:text-destructive defaults:data-[status=pending]:opacity-60 defaults:data-[status=running]:*:data-[slot=trace-title]:shimmer",
        className
      )}
      {...props}
    />
  );
}

function TraceIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="trace-icon"
      aria-hidden="true"
      className={cn(
        "defaults:flex defaults:size-4 defaults:shrink-0 defaults:items-center defaults:justify-center defaults:[&_svg]:pointer-events-none defaults:[&_svg:not([class*='size-'])]:size-4 defaults:[[data-slot=trace-title]~&]:-ml-1",
        className
      )}
      {...props}
    />
  );
}

function TraceTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="trace-title"
      className={cn(
        "defaults:min-w-0 defaults:truncate defaults:motion-reduce:shimmer-none",
        className
      )}
      {...props}
    />
  );
}

function TraceDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="trace-description"
      className={cn(
        "defaults:shrink-0 defaults:text-muted-foreground/70 defaults:tabular-nums",
        className
      )}
      {...props}
    />
  );
}

function TraceCollapsible({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Collapsible>, "open"> &
  (
    | { open?: undefined }
    | {
        open: boolean;
        onOpenChange: NonNullable<React.ComponentProps<typeof Collapsible>["onOpenChange"]>;
      }
  )) {
  return (
    <Collapsible
      data-slot="trace-collapsible"
      className={cn("defaults:flex defaults:w-full defaults:min-w-0 defaults:flex-col", className)}
      {...props}
    />
  );
}

function TraceCollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      data-slot="trace-collapsible-trigger"
      className={cn(
        "group/trace-collapsible-trigger defaults:flex defaults:w-fit defaults:max-w-full defaults:min-w-0 defaults:cursor-pointer defaults:items-center defaults:gap-1 defaults:rounded-md defaults:text-left defaults:text-muted-foreground defaults:transition-colors defaults:outline-none defaults:hover:text-foreground defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:has-[[data-status=error]]:text-destructive",
        className
      )}
      {...props}
    >
      {children}
      <TraceIcon className="defaults:transition-transform defaults:group-aria-expanded/trace-collapsible-trigger:rotate-90">
        <ChevronRightIcon />
      </TraceIcon>
    </CollapsibleTrigger>
  );
}

function TraceCollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="trace-collapsible-content"
      className="defaults:h-(--collapsible-panel-height) defaults:min-w-0 defaults:overflow-hidden defaults:transition-[height] defaults:duration-200 defaults:data-ending-style:h-0 defaults:data-starting-style:h-0"
      {...props}
    >
      <div
        data-slot="trace-collapsible-content-inner"
        className={cn(
          "defaults:mt-2 defaults:mb-1 defaults:ml-[calc(--spacing(2)-1px)] defaults:min-w-0 defaults:border-l defaults:pr-1 defaults:pl-4 defaults:leading-relaxed defaults:wrap-break-word defaults:text-muted-foreground",
          className
        )}
      >
        {children}
      </div>
    </CollapsibleContent>
  );
}

export {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceDescription,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
};
