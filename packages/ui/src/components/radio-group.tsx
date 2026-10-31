// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "@proto/ui/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("defaults:grid defaults:w-full defaults:gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "group/radio-group-item peer defaults:relative defaults:flex defaults:aspect-square defaults:size-4 defaults:shrink-0 defaults:rounded-full defaults:border defaults:border-input defaults:outline-none defaults:group-has-[:focus-visible]/field-label:ring-0 defaults:group-has-[:focus-visible]/field-label:not-data-checked:border-input defaults:after:absolute defaults:after:-inset-x-3 defaults:after:-inset-y-2 defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:disabled:cursor-not-allowed defaults:disabled:opacity-50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:aria-invalid:aria-checked:border-primary defaults:dark:bg-input/30 defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40 defaults:data-checked:border-primary defaults:data-checked:bg-primary defaults:data-checked:text-primary-foreground defaults:group-has-[:focus-visible]/field-label:data-checked:border-primary defaults:dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="defaults:flex defaults:size-4 defaults:items-center defaults:justify-center"
      >
        <span className="defaults:absolute defaults:top-1/2 defaults:left-1/2 defaults:size-2 defaults:-translate-x-1/2 defaults:-translate-y-1/2 defaults:rounded-full defaults:bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
