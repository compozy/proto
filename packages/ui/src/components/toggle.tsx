// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

const toggleVariants = cva(
  "group/toggle defaults:inline-flex defaults:items-center defaults:justify-center defaults:gap-1 defaults:rounded-lg defaults:text-sm defaults:font-medium defaults:whitespace-nowrap defaults:transition-all defaults:outline-none defaults:hover:bg-muted defaults:hover:text-foreground defaults:focus-visible:border-ring defaults:focus-visible:ring-[3px] defaults:focus-visible:ring-ring/50 defaults:disabled:pointer-events-none defaults:disabled:opacity-50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-destructive/20 defaults:aria-pressed:bg-muted defaults:data-pressed:bg-muted defaults:dark:aria-invalid:ring-destructive/40 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "defaults:bg-transparent",
        outline:
          "defaults:border defaults:border-input defaults:bg-transparent defaults:hover:bg-muted",
      },
      size: {
        default:
          "defaults:h-8 defaults:min-w-8 defaults:px-2.5 defaults:has-data-[icon=inline-end]:pr-2 defaults:has-data-[icon=inline-start]:pl-2",
        sm: "defaults:h-7 defaults:min-w-7 defaults:rounded-[min(var(--radius-md),12px)] defaults:px-2.5 defaults:text-[0.8rem] defaults:has-data-[icon=inline-end]:pr-1.5 defaults:has-data-[icon=inline-start]:pl-1.5 defaults:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "defaults:h-9 defaults:min-w-9 defaults:px-2.5 defaults:has-data-[icon=inline-end]:pr-2 defaults:has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
