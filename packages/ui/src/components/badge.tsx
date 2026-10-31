// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@proto/ui/lib/utils";

const badgeVariants = cva(
  [
    "defaults:relative defaults:inline-flex defaults:shrink-0 defaults:items-center defaults:justify-center defaults:w-fit defaults:border defaults:border-transparent defaults:font-medium defaults:whitespace-nowrap defaults:outline-none defaults:transition-shadow",
    "defaults:focus-visible:ring-2 defaults:focus-visible:ring-ring defaults:focus-visible:ring-offset-1 defaults:focus-visible:ring-offset-background defaults:disabled:pointer-events-none defaults:disabled:opacity-50",
    "defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*=size-])]:size-3",
  ],
  {
    variants: {
      variant: {
        default: "defaults:bg-primary defaults:text-primary-foreground",
        outline: "defaults:border-border defaults:bg-transparent defaults:dark:bg-input/32",
        secondary: "defaults:bg-secondary defaults:text-secondary-foreground",
        info: "defaults:bg-info defaults:text-white",
        success: "defaults:bg-success defaults:text-white",
        warning: "defaults:bg-warning defaults:text-white",
        destructive: "defaults:bg-destructive defaults:text-white",
        focus: "defaults:bg-focus defaults:text-focus-foreground",
        invert: "defaults:bg-invert defaults:text-invert-foreground",
        "primary-light":
          "defaults:border-primary/10 defaults:bg-primary/10 defaults:text-primary defaults:dark:border-primary/25 defaults:dark:bg-primary/15 defaults:dark:text-primary",
        "warning-light":
          "defaults:border-warning/15 defaults:bg-warning/10 defaults:text-warning-foreground defaults:dark:border-warning/25 defaults:dark:bg-warning/15 defaults:dark:text-warning",
        "success-light":
          "defaults:border-success/15 defaults:bg-success/10 defaults:text-success-foreground defaults:dark:border-success/25 defaults:dark:bg-success/15 defaults:dark:text-success",
        "info-light":
          "defaults:border-info/15 defaults:bg-info/10 defaults:text-info-foreground defaults:dark:border-info/25 defaults:dark:bg-info/15 defaults:dark:text-info",
        "destructive-light":
          "defaults:border-destructive/15 defaults:bg-destructive/10 defaults:text-destructive-emphasis defaults:dark:border-destructive/25 defaults:dark:bg-destructive/15 defaults:dark:text-destructive",
        "invert-light":
          "defaults:border-invert/15 defaults:bg-invert/10 defaults:text-foreground defaults:dark:border-invert/45 defaults:dark:bg-invert/35 defaults:dark:text-invert-foreground",
        "focus-light":
          "defaults:border-focus/15 defaults:bg-focus/10 defaults:text-focus defaults:dark:border-focus/25 defaults:dark:bg-focus/15 defaults:dark:text-focus",
        "primary-outline":
          "defaults:bg-background defaults:border-border defaults:text-primary defaults:dark:bg-input/30",
        "warning-outline":
          "defaults:bg-background defaults:border-border defaults:text-warning-foreground defaults:dark:bg-input/30",
        "success-outline":
          "defaults:bg-background defaults:border-border defaults:text-success-foreground defaults:dark:bg-input/30",
        "info-outline":
          "defaults:bg-background defaults:border-border defaults:text-info-foreground defaults:dark:bg-input/30",
        "destructive-outline":
          "defaults:bg-background defaults:border-border defaults:text-destructive-emphasis defaults:dark:bg-input/30",
        "invert-outline":
          "defaults:bg-background defaults:border-border defaults:text-invert-foreground defaults:dark:bg-input/30",
        "focus-outline":
          "defaults:bg-background defaults:border-border defaults:text-focus defaults:dark:bg-input/30",
      },
      size: {
        xs: "defaults:px-1 defaults:py-0.25 defaults:text-[0.6rem] defaults:leading-none defaults:h-4 defaults:min-w-4 defaults:gap-1",
        sm: "defaults:px-1 defaults:py-0.25 defaults:text-[0.625rem] defaults:leading-none defaults:h-4.5 defaults:min-w-4.5 defaults:gap-1",
        default:
          "defaults:px-1.25 defaults:py-0.5 defaults:text-xs defaults:h-5 defaults:min-w-5 defaults:gap-1",
        lg: "defaults:px-1.5 defaults:py-0.5 defaults:text-xs defaults:h-5.5 defaults:min-w-5.5 defaults:gap-1",
        xl: "defaults:px-2 defaults:py-0.75 defaults:text-sm defaults:h-6 defaults:min-w-6 defaults:gap-1.5",
      },
      /** `default`: active style radius. `full`: pill radius. */
      radius: {
        default: "defaults:rounded-sm",
        full: "defaults:rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      radius: "default",
    },
  }
);

interface BadgeProps extends useRender.ComponentProps<"span"> {
  variant?: VariantProps<typeof badgeVariants>["variant"];
  size?: VariantProps<typeof badgeVariants>["size"];
  radius?: VariantProps<typeof badgeVariants>["radius"];
}

function Badge({ className, variant, size, radius, render, ...props }: BadgeProps) {
  const defaultProps = {
    "data-slot": "badge",
    className: cn(badgeVariants({ variant, size, radius, className })),
  };

  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(defaultProps, props),
  });
}

export { Badge, badgeVariants, type BadgeProps };
