// Vendored from @proto/ui (packages/ui/src/components/textarea.tsx @ 5e799db) for the prebuilt shell
// (ADR-002): imports point at ./utils and ./icons; never import @proto/ui from the shell.
// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "defaults:flex defaults:field-sizing-content defaults:min-h-16 defaults:w-full defaults:rounded-lg defaults:border defaults:border-input defaults:bg-transparent defaults:px-2.5 defaults:py-2 defaults:text-base defaults:transition-colors defaults:outline-none defaults:placeholder:text-muted-foreground defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:disabled:cursor-not-allowed defaults:disabled:bg-input/50 defaults:disabled:opacity-50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:md:text-sm defaults:dark:bg-input/30 defaults:dark:disabled:bg-input/80 defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
