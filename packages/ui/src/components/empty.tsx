// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "defaults:flex defaults:w-full defaults:min-w-0 defaults:flex-1 defaults:flex-col defaults:items-center defaults:justify-center defaults:gap-4 defaults:rounded-xl defaults:border-dashed defaults:p-6 defaults:text-center defaults:text-balance",
        className
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "defaults:flex defaults:max-w-sm defaults:flex-col defaults:items-center defaults:gap-2",
        className
      )}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  "defaults:mb-2 defaults:flex defaults:shrink-0 defaults:items-center defaults:justify-center defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "defaults:bg-transparent",
        icon: "defaults:flex defaults:size-8 defaults:shrink-0 defaults:items-center defaults:justify-center defaults:rounded-lg defaults:bg-muted defaults:text-foreground defaults:[&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn(
        "defaults:font-heading defaults:text-sm defaults:font-medium defaults:tracking-tight",
        className
      )}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "defaults:text-sm/relaxed defaults:text-muted-foreground defaults:[&>a]:underline defaults:[&>a]:underline-offset-4 defaults:[&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "defaults:flex defaults:w-full defaults:max-w-sm defaults:min-w-0 defaults:flex-col defaults:items-center defaults:gap-2.5 defaults:text-sm defaults:text-balance",
        className
      )}
      {...props}
    />
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
