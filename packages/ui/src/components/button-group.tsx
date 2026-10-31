// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

import { Separator } from "@proto/ui/components/separator";

const buttonGroupVariants = cva(
  "defaults:flex defaults:w-fit defaults:items-stretch defaults:*:focus-visible:relative defaults:*:focus-visible:z-10 defaults:has-[>[data-slot=button-group]]:gap-2 defaults:has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-lg defaults:[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit defaults:[&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          "defaults:*:data-slot:rounded-r-none defaults:[&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-lg! defaults:[&>[data-slot]~[data-slot]]:rounded-l-none defaults:[&>[data-slot]~[data-slot]]:border-l-0",
        vertical:
          "defaults:flex-col defaults:*:data-slot:rounded-b-none defaults:[&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-lg! defaults:[&>[data-slot]~[data-slot]]:rounded-t-none defaults:[&>[data-slot]~[data-slot]]:border-t-0",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
);

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

function ButtonGroupText({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "defaults:flex defaults:items-center defaults:gap-2 defaults:rounded-lg defaults:border defaults:bg-muted defaults:px-2.5 defaults:text-sm defaults:font-medium defaults:[&_svg]:pointer-events-none defaults:[&_svg:not([class*='size-'])]:size-4",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "button-group-text",
    },
  });
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "defaults:relative defaults:self-stretch defaults:bg-input defaults:data-horizontal:mx-px defaults:data-horizontal:w-auto defaults:data-vertical:my-px defaults:data-vertical:h-auto",
        className
      )}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants };
