// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@proto/ui/lib/utils";

const alertVariants = cva(
  [
    "defaults:relative defaults:w-full defaults:text-sm defaults:border defaults:has-[>svg]:grid-cols-[calc(var(--spacing)*3)_1fr] defaults:grid-cols-[0_1fr] defaults:grid defaults:gap-y-0.5 defaults:items-center defaults:[&>svg:not([class*=size-])]:size-4",
    "defaults:has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_[data-slot=alert-action]]:sm:row-end-3",
    "defaults:has-[>[data-slot=alert-title]+[data-slot=alert-description]]:items-start",
    "defaults:has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_svg]:translate-y-0.5",
    "defaults:rounded-lg",
    "defaults:px-3",
    "defaults:py-2.5",
    "defaults:has-[>svg]:gap-x-2.5",
  ],
  {
    variants: {
      variant: {
        default: "defaults:bg-card defaults:text-card-foreground",
        destructive:
          "defaults:border-destructive/30 defaults:bg-destructive/4 defaults:[&>svg]:text-destructive",
        info: "defaults:border-info/30 defaults:bg-info/4 defaults:[&>svg]:text-info",
        success: "defaults:border-success/30 defaults:bg-success/4 defaults:[&>svg]:text-success",
        warning: "defaults:border-warning/30 defaults:bg-warning/4 defaults:[&>svg]:text-warning",
        invert:
          "defaults:border-invert defaults:bg-invert defaults:text-invert-foreground defaults:[&_[data-slot=alert-description]]:text-invert-foreground/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "defaults:col-start-2 defaults:line-clamp-1 defaults:min-h-4 defaults:font-medium defaults:tracking-tight",
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "defaults:text-muted-foreground defaults:col-start-2 defaults:grid defaults:justify-items-start defaults:gap-1 defaults:text-sm defaults:[&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "defaults:flex defaults:gap-1.5 defaults:max-sm:col-start-2 defaults:max-sm:mt-2 defaults:max-sm:justify-start defaults:sm:col-start-3 defaults:sm:row-start-1 defaults:sm:justify-end defaults:sm:self-center",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
