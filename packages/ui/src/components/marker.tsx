// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

const markerVariants = cva(
  "group/marker defaults:relative defaults:flex defaults:min-h-4 defaults:w-full defaults:items-center defaults:gap-2 defaults:text-left defaults:text-sm defaults:text-muted-foreground defaults:[&_svg:not([class*='size-'])]:size-4 defaults:[a]:underline defaults:[a]:underline-offset-3 defaults:[a]:hover:text-foreground",
  {
    variants: {
      variant: {
        default: "",
        separator:
          "defaults:before:mr-1 defaults:before:h-px defaults:before:min-w-0 defaults:before:flex-1 defaults:before:bg-border defaults:after:ml-1 defaults:after:h-px defaults:after:min-w-0 defaults:after:flex-1 defaults:after:bg-border",
        border: "defaults:border-b defaults:border-border defaults:pb-2",
      },
    },
  }
);

function Marker({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof markerVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(markerVariants({ variant, className })),
      },
      props
    ),
    render,
    state: {
      slot: "marker",
      variant,
    },
  });
}

function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      className={cn(
        "defaults:size-4 defaults:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-content"
      className={cn(
        "defaults:min-w-0 defaults:wrap-break-word defaults:group-data-[variant=separator]/marker:flex-none defaults:group-data-[variant=separator]/marker:text-center defaults:*:[a]:underline defaults:*:[a]:underline-offset-3 defaults:*:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Marker, MarkerIcon, MarkerContent, markerVariants };
