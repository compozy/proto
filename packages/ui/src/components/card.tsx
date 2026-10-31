// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { cn } from "@proto/ui/lib/utils";

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm";
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card defaults:flex defaults:flex-col defaults:gap-(--card-spacing) defaults:overflow-hidden defaults:rounded-xl defaults:bg-card defaults:py-(--card-spacing) defaults:text-sm defaults:text-card-foreground defaults:ring-1 defaults:ring-foreground/10 defaults:[--card-spacing:--spacing(4)] defaults:has-data-[slot=card-footer]:pb-0 defaults:has-[>img:first-child]:pt-0 defaults:data-[size=sm]:[--card-spacing:--spacing(3)] defaults:data-[size=sm]:has-data-[slot=card-footer]:pb-0 defaults:*:[img:first-child]:rounded-t-xl defaults:*:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header defaults:@container/card-header defaults:grid defaults:auto-rows-min defaults:items-start defaults:gap-1 defaults:rounded-t-xl defaults:px-(--card-spacing) defaults:has-data-[slot=card-action]:grid-cols-[1fr_auto] defaults:has-data-[slot=card-description]:grid-rows-[auto_auto] defaults:[.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "defaults:font-heading defaults:text-base defaults:leading-snug defaults:font-medium defaults:group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("defaults:text-sm defaults:text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "defaults:col-start-2 defaults:row-span-2 defaults:row-start-1 defaults:self-start defaults:justify-self-end",
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("defaults:px-(--card-spacing)", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "defaults:flex defaults:items-center defaults:rounded-b-xl defaults:border-t defaults:bg-muted/50 defaults:p-(--card-spacing)",
        className
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
