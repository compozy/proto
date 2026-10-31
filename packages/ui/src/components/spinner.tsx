// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { cn } from "@proto/ui/lib/utils";
import { Loader2Icon } from "@proto/ui/lib/icons";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("defaults:size-4 defaults:animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
