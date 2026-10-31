// Vendored from @proto/ui (packages/ui/src/components/avatar.tsx @ 5e799db) for the prebuilt shell
// (ADR-002): imports point at ./utils and ./icons; never import @proto/ui from the shell.
// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "./utils";

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar defaults:relative defaults:flex defaults:size-8 defaults:shrink-0 defaults:rounded-full defaults:select-none defaults:after:absolute defaults:after:inset-0 defaults:after:rounded-full defaults:after:border defaults:after:border-border defaults:after:mix-blend-darken defaults:data-[size=lg]:size-10 defaults:data-[size=sm]:size-6 defaults:dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "defaults:aspect-square defaults:size-full defaults:rounded-full defaults:object-cover",
        className
      )}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "defaults:flex defaults:size-full defaults:items-center defaults:justify-center defaults:rounded-full defaults:bg-muted defaults:text-sm defaults:text-muted-foreground defaults:group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "defaults:absolute defaults:right-0 defaults:bottom-0 defaults:z-10 defaults:inline-flex defaults:items-center defaults:justify-center defaults:rounded-full defaults:bg-primary defaults:text-primary-foreground defaults:bg-blend-color defaults:ring-2 defaults:ring-background defaults:select-none",
        "defaults:group-data-[size=sm]/avatar:size-2 defaults:group-data-[size=sm]/avatar:[&>svg]:hidden",
        "defaults:group-data-[size=default]/avatar:size-2.5 defaults:group-data-[size=default]/avatar:[&>svg]:size-2",
        "defaults:group-data-[size=lg]/avatar:size-3 defaults:group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group defaults:flex defaults:-space-x-2 defaults:*:data-[slot=avatar]:ring-2 defaults:*:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "defaults:relative defaults:flex defaults:size-8 defaults:shrink-0 defaults:items-center defaults:justify-center defaults:rounded-full defaults:bg-muted defaults:text-sm defaults:text-muted-foreground defaults:ring-2 defaults:ring-background defaults:group-has-data-[size=lg]/avatar-group:size-10 defaults:group-has-data-[size=sm]/avatar-group:size-6 defaults:[&>svg]:size-4 defaults:group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 defaults:group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
