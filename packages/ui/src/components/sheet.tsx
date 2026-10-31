// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "@proto/ui/lib/utils";

import { Button } from "@proto/ui/components/button";
import { XIcon } from "@proto/ui/lib/icons";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "defaults:fixed defaults:inset-0 defaults:z-50 defaults:bg-black/10 defaults:transition-opacity defaults:duration-150 defaults:data-ending-style:opacity-0 defaults:data-starting-style:opacity-0 defaults:supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "defaults:fixed defaults:z-50 defaults:flex defaults:flex-col defaults:gap-4 defaults:bg-popover defaults:bg-clip-padding defaults:text-sm defaults:text-popover-foreground defaults:shadow-lg defaults:transition defaults:duration-200 defaults:ease-in-out defaults:data-ending-style:opacity-0 defaults:data-starting-style:opacity-0",
          side === "right" &&
            "defaults:inset-y-0 defaults:right-0 defaults:h-full defaults:w-3/4 defaults:border-l defaults:sm:max-w-sm defaults:data-ending-style:translate-x-[2.5rem] defaults:data-starting-style:translate-x-[2.5rem]",
          side === "left" &&
            "defaults:inset-y-0 defaults:left-0 defaults:h-full defaults:w-3/4 defaults:border-r defaults:sm:max-w-sm defaults:data-ending-style:translate-x-[-2.5rem] defaults:data-starting-style:translate-x-[-2.5rem]",
          side === "top" &&
            "defaults:inset-x-0 defaults:top-0 defaults:h-auto defaults:border-b defaults:data-ending-style:translate-y-[-2.5rem] defaults:data-starting-style:translate-y-[-2.5rem]",
          side === "bottom" &&
            "defaults:inset-x-0 defaults:bottom-0 defaults:h-auto defaults:border-t defaults:data-ending-style:translate-y-[2.5rem] defaults:data-starting-style:translate-y-[2.5rem]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="defaults:absolute defaults:top-3 defaults:right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="defaults:sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("defaults:flex defaults:flex-col defaults:gap-0.5 defaults:p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "defaults:mt-auto defaults:flex defaults:flex-col defaults:gap-2 defaults:p-4",
        className
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "defaults:font-heading defaults:text-base defaults:font-medium defaults:text-foreground",
        className
      )}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("defaults:text-sm defaults:text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
