// Vendored from @proto/ui (packages/ui/src/components/button.tsx @ 5e799db) for the prebuilt shell
// (ADR-002): imports point at ./utils and ./icons; never import @proto/ui from the shell.
// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const buttonVariants = cva(
  "group/button defaults:inline-flex defaults:shrink-0 defaults:items-center defaults:justify-center defaults:rounded-lg defaults:border defaults:border-transparent defaults:bg-clip-padding defaults:text-sm defaults:font-medium defaults:whitespace-nowrap defaults:transition-all defaults:outline-none defaults:select-none defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:active:not-aria-[haspopup]:translate-y-px defaults:disabled:pointer-events-none defaults:disabled:opacity-50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "defaults:bg-primary defaults:text-primary-foreground defaults:hover:bg-primary/80",
        outline:
          "defaults:border-border defaults:bg-background defaults:hover:bg-muted defaults:hover:text-foreground defaults:aria-expanded:bg-muted defaults:aria-expanded:text-foreground defaults:dark:border-input defaults:dark:bg-input/30 defaults:dark:hover:bg-input/50",
        secondary:
          "defaults:bg-secondary defaults:text-secondary-foreground defaults:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] defaults:aria-expanded:bg-secondary defaults:aria-expanded:text-secondary-foreground",
        ghost:
          "defaults:hover:bg-muted defaults:hover:text-foreground defaults:aria-expanded:bg-muted defaults:aria-expanded:text-foreground defaults:dark:hover:bg-muted/50",
        destructive:
          "defaults:bg-destructive/10 defaults:text-destructive defaults:hover:bg-destructive/20 defaults:focus-visible:border-destructive/40 defaults:focus-visible:ring-destructive/20 defaults:dark:bg-destructive/20 defaults:dark:hover:bg-destructive/30 defaults:dark:focus-visible:ring-destructive/40",
        link: "defaults:text-primary defaults:underline-offset-4 defaults:hover:underline",
      },
      size: {
        default:
          "defaults:h-8 defaults:gap-1.5 defaults:px-2.5 defaults:has-data-[icon=inline-end]:pr-2 defaults:has-data-[icon=inline-start]:pl-2",
        xs: "defaults:h-6 defaults:gap-1 defaults:rounded-[min(var(--radius-md),10px)] defaults:px-2 defaults:text-xs defaults:in-data-[slot=button-group]:rounded-lg defaults:has-data-[icon=inline-end]:pr-1.5 defaults:has-data-[icon=inline-start]:pl-1.5 defaults:[&_svg:not([class*='size-'])]:size-3",
        sm: "defaults:h-7 defaults:gap-1 defaults:rounded-[min(var(--radius-md),12px)] defaults:px-2.5 defaults:text-[0.8rem] defaults:[line-height:var(--text-sm--line-height)] defaults:in-data-[slot=button-group]:rounded-lg defaults:has-data-[icon=inline-end]:pr-1.5 defaults:has-data-[icon=inline-start]:pl-1.5 defaults:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "defaults:h-9 defaults:gap-1.5 defaults:px-2.5 defaults:has-data-[icon=inline-end]:pr-2 defaults:has-data-[icon=inline-start]:pl-2",
        icon: "defaults:size-8",
        "icon-xs":
          "defaults:size-6 defaults:rounded-[min(var(--radius-md),10px)] defaults:in-data-[slot=button-group]:rounded-lg defaults:[&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "defaults:size-7 defaults:rounded-[min(var(--radius-md),12px)] defaults:in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "defaults:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
