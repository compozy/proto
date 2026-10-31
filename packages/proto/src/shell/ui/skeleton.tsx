// Vendored from @proto/ui (packages/ui/src/components/skeleton.tsx @ 5e799db) for the prebuilt shell
// (ADR-002): imports point at ./utils and ./icons; never import @proto/ui from the shell.
// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { cn } from "./utils";

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
