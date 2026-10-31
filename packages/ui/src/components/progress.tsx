// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@proto/ui/lib/utils";

function Progress({ className, children, value, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn(
        "defaults:relative defaults:flex defaults:h-1 defaults:w-full defaults:items-center defaults:overflow-x-hidden defaults:rounded-full defaults:bg-muted",
        className
      )}
      {...props}
    >
      {children}
      <ProgressTrack className="h-full rounded-[inherit] bg-transparent">
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "defaults:relative defaults:flex defaults:h-1 defaults:w-full defaults:items-center defaults:overflow-x-hidden defaults:rounded-full defaults:bg-muted",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn("defaults:h-full defaults:bg-primary defaults:transition-all", className)}
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("defaults:text-sm defaults:font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "defaults:ml-auto defaults:text-sm defaults:text-muted-foreground defaults:tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    />
  );
}

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue };
