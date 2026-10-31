// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-group"
      className={cn("defaults:flex defaults:min-w-0 defaults:flex-col defaults:gap-2", className)}
      {...props}
    />
  );
}

const bubbleVariants = cva(
  "group/bubble defaults:relative defaults:flex defaults:w-fit defaults:max-w-[80%] defaults:min-w-0 defaults:flex-col defaults:gap-1 defaults:group-data-[align=end]/message:self-end defaults:data-[align=end]:self-end defaults:data-[variant=ghost]:max-w-full",
  {
    variants: {
      variant: {
        default:
          "defaults:*:data-[slot=bubble-content]:bg-primary defaults:*:data-[slot=bubble-content]:text-primary-foreground defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary/80",
        secondary:
          "defaults:*:data-[slot=bubble-content]:bg-secondary defaults:*:data-[slot=bubble-content]:text-secondary-foreground defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        muted:
          "defaults:*:data-[slot=bubble-content]:bg-muted defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]",
        tinted:
          "defaults:*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.93_calc(c*0.4)_h)] defaults:*:data-[slot=bubble-content]:text-foreground defaults:dark:*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.3_calc(c*0.4)_h)] defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.88_calc(c*0.5)_h)] defaults:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.35_calc(c*0.5)_h)]",
        outline:
          "defaults:*:data-[slot=bubble-content]:border-border defaults:*:data-[slot=bubble-content]:bg-background defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground defaults:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-input/30",
        ghost:
          "defaults:border-none defaults:*:data-[slot=bubble-content]:rounded-none defaults:*:data-[slot=bubble-content]:bg-transparent defaults:*:data-[slot=bubble-content]:p-0 defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground defaults:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted/50",
        destructive:
          "defaults:*:data-[slot=bubble-content]:bg-destructive/10 defaults:*:data-[slot=bubble-content]:text-destructive defaults:dark:*:data-[slot=bubble-content]:bg-destructive/20 defaults:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/20 defaults:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & {
    align?: "start" | "end";
  }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  );
}

function BubbleContent({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "defaults:w-fit defaults:max-w-full defaults:min-w-0 defaults:overflow-hidden defaults:rounded-xl defaults:border defaults:border-transparent defaults:px-3 defaults:py-2 defaults:text-sm defaults:leading-relaxed defaults:wrap-break-word defaults:group-data-[align=end]/bubble:self-end defaults:[button]:text-left defaults:[button,a]:transition-colors defaults:[button,a]:outline-none defaults:[button,a]:focus-visible:border-ring defaults:[button,a]:focus-visible:ring-3 defaults:[button,a]:focus-visible:ring-ring/50",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "bubble-content",
    },
  });
}

const bubbleReactionsVariants = cva(
  "defaults:absolute defaults:z-10 defaults:flex defaults:w-fit defaults:shrink-0 defaults:items-center defaults:justify-center defaults:gap-1 defaults:rounded-full defaults:bg-muted defaults:px-1.5 defaults:py-0.5 defaults:text-sm defaults:ring-3 defaults:ring-card defaults:has-[button]:p-0",
  {
    variants: {
      side: {
        top: "defaults:top-0 defaults:-translate-y-3/4",
        bottom: "defaults:bottom-0 defaults:translate-y-3/4",
      },
      align: {
        start: "defaults:left-3",
        end: "defaults:right-3",
      },
    },
    defaultVariants: {
      side: "bottom",
      align: "end",
    },
  }
);

function BubbleReactions({
  side = "bottom",
  align = "end",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(bubbleReactionsVariants({ side, align }), className)}
      {...props}
    />
  );
}

export { BubbleGroup, Bubble, BubbleContent, BubbleReactions };
