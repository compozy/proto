// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "@proto/ui/lib/utils";

import { Button } from "@proto/ui/components/button";

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "defaults:fixed defaults:inset-0 defaults:isolate defaults:z-50 defaults:bg-black/10 defaults:duration-100 defaults:supports-backdrop-filter:backdrop-blur-xs defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-closed:animate-out defaults:data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: "default" | "sm";
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "group/alert-dialog-content defaults:fixed defaults:top-1/2 defaults:left-1/2 defaults:z-50 defaults:grid defaults:w-full defaults:-translate-x-1/2 defaults:-translate-y-1/2 defaults:gap-4 defaults:rounded-xl defaults:bg-popover defaults:p-4 defaults:text-popover-foreground defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:outline-none defaults:data-[size=default]:max-w-xs defaults:data-[size=sm]:max-w-xs defaults:data-[size=default]:sm:max-w-sm defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "defaults:grid defaults:grid-rows-[auto_1fr] defaults:place-items-center defaults:gap-1.5 defaults:text-center defaults:has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] defaults:has-data-[slot=alert-dialog-media]:gap-x-4 defaults:sm:group-data-[size=default]/alert-dialog-content:place-items-start defaults:sm:group-data-[size=default]/alert-dialog-content:text-left defaults:sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "defaults:-mx-4 defaults:-mb-4 defaults:flex defaults:flex-col-reverse defaults:gap-2 defaults:rounded-b-xl defaults:border-t defaults:bg-muted/50 defaults:p-4 defaults:group-data-[size=sm]/alert-dialog-content:grid defaults:group-data-[size=sm]/alert-dialog-content:grid-cols-2 defaults:sm:flex-row defaults:sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "defaults:mb-2 defaults:inline-flex defaults:size-10 defaults:items-center defaults:justify-center defaults:rounded-md defaults:bg-muted defaults:sm:group-data-[size=default]/alert-dialog-content:row-span-2 defaults:*:[svg:not([class*='size-'])]:size-6",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "defaults:font-heading defaults:text-base defaults:font-medium defaults:sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "defaults:text-sm defaults:text-balance defaults:text-muted-foreground defaults:md:text-pretty defaults:*:[a]:underline defaults:*:[a]:underline-offset-3 defaults:*:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button data-slot="alert-dialog-action" className={cn(className)} {...props} />;
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
