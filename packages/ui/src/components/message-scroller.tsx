// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";
import { cn } from "@proto/ui/lib/utils";

import { Button } from "@proto/ui/components/button";
import { ArrowDownIcon } from "@proto/ui/lib/icons";

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>
) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller defaults:relative defaults:flex defaults:size-full defaults:min-h-0 defaults:flex-col defaults:overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        "defaults:size-full defaults:min-h-0 defaults:min-w-0 defaults:scroll-fade-b defaults:scrollbar-thin defaults:scrollbar-gutter-stable defaults:overflow-y-auto defaults:overscroll-contain defaults:contain-content defaults:data-autoscrolling:scrollbar-thumb-transparent defaults:data-autoscrolling:scrollbar-track-transparent defaults:data-pending-scroll:invisible",
        className
      )}
      {...props}
    />
  );
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn(
        "defaults:flex defaults:h-max defaults:min-h-full defaults:flex-col defaults:gap-6",
        className
      )}
      {...props}
    />
  );
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn(
        "defaults:min-w-0 defaults:shrink-0 defaults:[contain-intrinsic-size:auto_10rem] defaults:[content-visibility:auto]",
        className
      )}
      {...props}
    />
  );
}

function MessageScrollerButton({
  direction = "end",
  className,
  children,
  render,
  variant = "secondary",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      className={cn(
        "defaults:absolute defaults:inset-s-1/2 defaults:-translate-x-1/2 defaults:border-border defaults:bg-background defaults:text-foreground defaults:transition-[translate,scale,opacity] defaults:duration-200 defaults:hover:bg-muted defaults:hover:text-foreground defaults:data-[active=false]:pointer-events-none defaults:data-[active=false]:scale-95 defaults:data-[active=false]:opacity-0 defaults:data-[active=false]:duration-400 defaults:data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] defaults:data-[active=true]:translate-y-0 defaults:data-[active=true]:scale-100 defaults:data-[active=true]:opacity-100 defaults:data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] defaults:data-[direction=end]:bottom-4 defaults:data-[direction=end]:data-[active=false]:translate-y-full defaults:data-[direction=start]:top-4 defaults:data-[direction=start]:data-[active=false]:-translate-y-full defaults:rtl:translate-x-1/2 defaults:data-[direction=start]:[&_svg]:rotate-180",
        className
      )}
      render={render ?? <Button variant={variant} size={size} />}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="defaults:sr-only">
            {direction === "end" ? "Scroll to end" : "Scroll to start"}
          </span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  );
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
};
