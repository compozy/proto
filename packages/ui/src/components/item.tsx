// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

import { Separator } from "@proto/ui/components/separator";

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn(
        "group/item-group defaults:flex defaults:w-full defaults:flex-col defaults:gap-4 defaults:has-data-[size=sm]:gap-2.5 defaults:has-data-[size=xs]:gap-2",
        className
      )}
      {...props}
    />
  );
}

function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn("defaults:my-2", className)}
      {...props}
    />
  );
}

const itemVariants = cva(
  "group/item defaults:flex defaults:w-full defaults:flex-wrap defaults:items-center defaults:rounded-lg defaults:border defaults:text-sm defaults:transition-colors defaults:duration-100 defaults:outline-none defaults:focus-visible:border-ring defaults:focus-visible:ring-[3px] defaults:focus-visible:ring-ring/50 defaults:[a]:transition-colors defaults:[a]:hover:bg-muted",
  {
    variants: {
      variant: {
        default: "defaults:border-transparent",
        outline: "defaults:border-border",
        muted: "defaults:border-transparent defaults:bg-muted/50",
      },
      size: {
        default: "defaults:gap-2.5 defaults:px-3 defaults:py-2.5",
        sm: "defaults:gap-2.5 defaults:px-3 defaults:py-2.5",
        xs: "defaults:gap-2 defaults:px-2.5 defaults:py-2 defaults:in-data-[slot=dropdown-menu-content]:p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Item({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(itemVariants({ variant, size, className })),
      },
      props
    ),
    render,
    state: {
      slot: "item",
      variant,
      size,
    },
  });
}

const itemMediaVariants = cva(
  "defaults:flex defaults:shrink-0 defaults:items-center defaults:justify-center defaults:gap-2 defaults:group-has-data-[slot=item-description]/item:translate-y-0.5 defaults:group-has-data-[slot=item-description]/item:self-start defaults:[&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "defaults:bg-transparent",
        icon: "defaults:[&_svg:not([class*='size-'])]:size-4",
        image:
          "defaults:size-10 defaults:overflow-hidden defaults:rounded-sm defaults:group-data-[size=sm]/item:size-8 defaults:group-data-[size=xs]/item:size-6 defaults:[&_img]:size-full defaults:[&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        "defaults:flex defaults:flex-1 defaults:flex-col defaults:gap-1 defaults:group-data-[size=xs]/item:gap-0 defaults:[&+[data-slot=item-content]]:flex-none",
        className
      )}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "defaults:line-clamp-1 defaults:flex defaults:w-fit defaults:items-center defaults:gap-2 defaults:text-sm defaults:leading-snug defaults:font-medium defaults:underline-offset-4",
        className
      )}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "defaults:line-clamp-2 defaults:text-left defaults:text-sm defaults:leading-normal defaults:font-normal defaults:text-muted-foreground defaults:group-data-[size=xs]/item:text-xs defaults:[&>a]:underline defaults:[&>a]:underline-offset-4 defaults:[&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("defaults:flex defaults:items-center defaults:gap-2", className)}
      {...props}
    />
  );
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-header"
      className={cn(
        "defaults:flex defaults:basis-full defaults:items-center defaults:justify-between defaults:gap-2",
        className
      )}
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-footer"
      className={cn(
        "defaults:flex defaults:basis-full defaults:items-center defaults:justify-between defaults:gap-2",
        className
      )}
      {...props}
    />
  );
}

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
};
