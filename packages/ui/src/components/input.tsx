// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@proto/ui/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "defaults:h-8 defaults:w-full defaults:min-w-0 defaults:rounded-lg defaults:border defaults:border-input defaults:bg-transparent defaults:px-2.5 defaults:py-1 defaults:text-base defaults:transition-colors defaults:outline-none defaults:file:inline-flex defaults:file:h-6 defaults:file:border-0 defaults:file:bg-transparent defaults:file:text-sm defaults:file:font-medium defaults:file:text-foreground defaults:placeholder:text-muted-foreground defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:disabled:pointer-events-none defaults:disabled:cursor-not-allowed defaults:disabled:bg-input/50 defaults:disabled:opacity-50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:md:text-sm defaults:dark:bg-input/30 defaults:dark:disabled:bg-input/80 defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

export { Input };
