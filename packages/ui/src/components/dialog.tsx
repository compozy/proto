// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@proto/ui/lib/utils";

import { Button } from "@proto/ui/components/button";
import { XIcon } from "@proto/ui/lib/icons";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "defaults:fixed defaults:inset-0 defaults:isolate defaults:z-50 defaults:bg-black/10 defaults:duration-100 defaults:supports-backdrop-filter:backdrop-blur-xs defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-closed:animate-out defaults:data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "defaults:fixed defaults:top-1/2 defaults:left-1/2 defaults:z-50 defaults:grid defaults:w-full defaults:max-w-[calc(100%-2rem)] defaults:-translate-x-1/2 defaults:-translate-y-1/2 defaults:gap-4 defaults:rounded-xl defaults:bg-popover defaults:p-4 defaults:text-sm defaults:text-popover-foreground defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:outline-none defaults:sm:max-w-sm defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="defaults:absolute defaults:top-2 defaults:right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="defaults:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("defaults:flex defaults:flex-col defaults:gap-2", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "defaults:-mx-4 defaults:-mb-4 defaults:flex defaults:flex-col-reverse defaults:gap-2 defaults:rounded-b-xl defaults:border-t defaults:bg-muted/50 defaults:p-4 defaults:sm:flex-row defaults:sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "defaults:font-heading defaults:text-base defaults:leading-none defaults:font-medium",
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "defaults:text-sm defaults:text-muted-foreground defaults:*:[a]:underline defaults:*:[a]:underline-offset-3 defaults:*:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
