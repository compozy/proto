// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

import { Button } from "@proto/ui/components/button";

const attachmentVariants = cva(
  "group/attachment defaults:relative defaults:flex defaults:w-fit defaults:max-w-full defaults:min-w-0 defaults:shrink-0 defaults:flex-wrap defaults:rounded-xl defaults:border defaults:bg-card defaults:text-card-foreground defaults:transition-colors defaults:focus-within:ring-1 defaults:focus-within:ring-ring/50 defaults:has-[>a,>button]:hover:bg-muted/50 defaults:data-[state=error]:border-destructive/30 defaults:data-[state=idle]:border-dashed",
  {
    variants: {
      size: {
        default:
          "defaults:gap-2 defaults:text-sm defaults:has-data-[slot=attachment-content]:px-2.5 defaults:has-data-[slot=attachment-content]:py-2 defaults:has-data-[slot=attachment-media]:p-2",
        sm: "defaults:gap-2.5 defaults:text-xs defaults:has-data-[slot=attachment-content]:px-2 defaults:has-data-[slot=attachment-content]:py-1.5 defaults:has-data-[slot=attachment-media]:p-1.5",
        xs: "defaults:gap-1.5 defaults:rounded-lg defaults:text-xs defaults:has-data-[slot=attachment-content]:px-1.5 defaults:has-data-[slot=attachment-content]:py-1 defaults:has-data-[slot=attachment-media]:p-1",
      },
      orientation: {
        horizontal: "defaults:min-w-40 defaults:items-center",
        vertical:
          "defaults:w-24 defaults:flex-col defaults:has-data-[slot=attachment-content]:w-30",
      },
    },
  }
);

function Attachment({
  className,
  state = "done",
  size = "default",
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof attachmentVariants> & {
    state?: "idle" | "uploading" | "processing" | "error" | "done";
  }) {
  return (
    <div
      data-slot="attachment"
      data-state={state}
      data-size={size}
      data-orientation={orientation}
      className={cn(attachmentVariants({ size, orientation }), className)}
      {...props}
    />
  );
}

const attachmentMediaVariants = cva(
  "defaults:relative defaults:flex defaults:aspect-square defaults:w-10 defaults:shrink-0 defaults:items-center defaults:justify-center defaults:overflow-hidden defaults:rounded-lg defaults:bg-muted defaults:text-foreground defaults:group-data-[orientation=vertical]/attachment:w-full defaults:group-data-[size=sm]/attachment:w-8 defaults:group-data-[size=xs]/attachment:w-7 defaults:group-data-[size=xs]/attachment:rounded-md defaults:group-data-[state=error]/attachment:bg-destructive/10 defaults:group-data-[state=error]/attachment:text-destructive defaults:group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! defaults:[&_svg]:pointer-events-none defaults:[&_svg:not([class*='size-'])]:size-4 defaults:group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 defaults:group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        icon: "",
        image:
          "defaults:opacity-60 defaults:group-data-[state=done]/attachment:opacity-100 defaults:group-data-[state=idle]/attachment:opacity-100 defaults:*:[img]:aspect-square defaults:*:[img]:w-full defaults:*:[img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "icon",
    },
  }
);

function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof attachmentMediaVariants>) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn(attachmentMediaVariants({ variant }), className)}
      {...props}
    />
  );
}

function AttachmentContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-content"
      className={cn(
        "defaults:max-w-full defaults:min-w-0 defaults:flex-1 defaults:leading-tight defaults:group-data-[orientation=vertical]/attachment:px-1",
        className
      )}
      {...props}
    />
  );
}

function AttachmentTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-title"
      className={cn(
        "defaults:block defaults:max-w-full defaults:min-w-0 defaults:truncate defaults:font-medium defaults:group-data-[state=processing]/attachment:shimmer defaults:group-data-[state=uploading]/attachment:shimmer",
        className
      )}
      {...props}
    />
  );
}

function AttachmentDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-description"
      className={cn(
        "defaults:mt-0.5 defaults:block defaults:min-w-0 defaults:truncate defaults:text-xs defaults:text-muted-foreground defaults:group-data-[state=error]/attachment:text-destructive/80",
        "defaults:max-w-full",
        className
      )}
      {...props}
    />
  );
}

function AttachmentActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-actions"
      className={cn(
        "defaults:relative defaults:z-20 defaults:flex defaults:shrink-0 defaults:items-center defaults:group-data-[orientation=vertical]/attachment:absolute defaults:group-data-[orientation=vertical]/attachment:top-3 defaults:group-data-[orientation=vertical]/attachment:right-3 defaults:group-data-[orientation=vertical]/attachment:gap-1",
        className
      )}
      {...props}
    />
  );
}

function AttachmentAction({
  className,
  variant,
  size = "icon-xs",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="attachment-action"
      variant={variant ?? "ghost"}
      size={size}
      className={cn(className)}
      {...props}
    />
  );
}

function AttachmentTrigger({
  className,
  render,
  type,
  ...props
}: useRender.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: render ? type : (type ?? "button"),
        className: cn(
          "defaults:absolute defaults:inset-0 defaults:z-10 defaults:outline-none",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "attachment-trigger",
    },
  });
}

function AttachmentGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-group"
      className={cn(
        "defaults:flex defaults:min-w-0 defaults:scroll-fade-x defaults:snap-x defaults:snap-mandatory defaults:scroll-px-1 defaults:scrollbar-none defaults:gap-3 defaults:overflow-x-auto defaults:overscroll-x-contain defaults:py-1 defaults:*:data-[slot=attachment]:flex-none defaults:*:data-[slot=attachment]:snap-start",
        className
      )}
      {...props}
    />
  );
}

export {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
};
