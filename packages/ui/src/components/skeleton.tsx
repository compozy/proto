// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { cn } from "@proto/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("defaults:animate-pulse defaults:rounded-md defaults:bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
