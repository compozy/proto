// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { cn } from "@proto/ui/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "defaults:pointer-events-none defaults:inline-flex defaults:h-5 defaults:w-fit defaults:min-w-5 defaults:items-center defaults:justify-center defaults:gap-1 defaults:rounded-sm defaults:bg-muted defaults:px-1 defaults:font-sans defaults:text-xs defaults:font-medium defaults:text-muted-foreground defaults:select-none defaults:in-data-[slot=tooltip-content]:bg-background/20 defaults:in-data-[slot=tooltip-content]:text-background defaults:dark:in-data-[slot=tooltip-content]:bg-background/10 defaults:[&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("defaults:inline-flex defaults:items-center defaults:gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
