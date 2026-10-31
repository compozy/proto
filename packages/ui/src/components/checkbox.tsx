// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "@proto/ui/lib/utils";
import { CheckIcon } from "@proto/ui/lib/icons";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer defaults:relative defaults:flex defaults:size-4 defaults:shrink-0 defaults:items-center defaults:justify-center defaults:rounded-[4px] defaults:border defaults:border-input defaults:transition-colors defaults:outline-none defaults:group-has-disabled/field:opacity-50 defaults:group-has-[:focus-visible]/field-label:ring-0 defaults:group-has-[:focus-visible]/field-label:not-data-checked:border-input defaults:after:absolute defaults:after:-inset-x-3 defaults:after:-inset-y-2 defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:disabled:cursor-not-allowed defaults:disabled:opacity-50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:aria-invalid:aria-checked:border-primary defaults:dark:bg-input/30 defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40 defaults:data-checked:border-primary defaults:data-checked:bg-primary defaults:data-checked:text-primary-foreground defaults:group-has-[:focus-visible]/field-label:data-checked:border-primary defaults:dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="defaults:grid defaults:place-content-center defaults:text-current defaults:transition-none defaults:[&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
