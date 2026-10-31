// Vendored from @proto/ui (packages/ui/src/components/input-group.tsx @ 5e799db) for the prebuilt shell
// (ADR-002): imports point at ./utils and ./icons; never import @proto/ui from the shell.
// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group defaults:relative defaults:flex defaults:h-8 defaults:w-full defaults:min-w-0 defaults:items-center defaults:rounded-lg defaults:border defaults:border-input defaults:transition-colors defaults:outline-none defaults:in-data-[slot=combobox-content]:focus-within:border-inherit defaults:in-data-[slot=combobox-content]:focus-within:ring-0 defaults:has-disabled:bg-input/50 defaults:has-disabled:opacity-50 defaults:has-[[data-slot=input-group-control]:focus-visible]:border-ring defaults:has-[[data-slot=input-group-control]:focus-visible]:ring-3 defaults:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 defaults:has-[[data-slot][aria-invalid=true]]:border-destructive defaults:has-[[data-slot][aria-invalid=true]]:ring-3 defaults:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 defaults:has-[>[data-align=block-end]]:h-auto defaults:has-[>[data-align=block-end]]:flex-col defaults:has-[>[data-align=block-start]]:h-auto defaults:has-[>[data-align=block-start]]:flex-col defaults:has-[>textarea]:h-auto defaults:dark:bg-input/30 defaults:dark:has-disabled:bg-input/80 defaults:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 defaults:has-[>[data-align=block-end]]:[&>input]:pt-3 defaults:has-[>[data-align=block-start]]:[&>input]:pb-3 defaults:has-[>[data-align=inline-end]]:[&>input]:pr-1.5 defaults:has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        className
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "defaults:flex defaults:h-auto defaults:cursor-text defaults:items-center defaults:justify-center defaults:gap-2 defaults:py-1.5 defaults:text-sm defaults:font-medium defaults:text-muted-foreground defaults:select-none defaults:group-data-[disabled=true]/input-group:opacity-50 defaults:[&>kbd]:rounded-[calc(var(--radius)-5px)] defaults:[&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "defaults:order-first defaults:pl-2 defaults:has-[>button]:ml-[-0.3rem] defaults:has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "defaults:order-last defaults:pr-2 defaults:has-[>button]:mr-[-0.3rem] defaults:has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "defaults:order-first defaults:w-full defaults:justify-start defaults:px-2.5 defaults:pt-2 defaults:group-has-[>input]/input-group:pt-2 defaults:[.border-b]:pb-2",
        "block-end":
          "defaults:order-last defaults:w-full defaults:justify-start defaults:px-2.5 defaults:pb-2 defaults:group-has-[>input]/input-group:pb-2 defaults:[.border-t]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
);

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={e => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "defaults:flex defaults:items-center defaults:gap-2 defaults:text-sm defaults:shadow-none",
  {
    variants: {
      size: {
        xs: "defaults:h-6 defaults:gap-1 defaults:rounded-[calc(var(--radius)-3px)] defaults:px-1.5 defaults:[&>svg:not([class*='size-'])]:size-3.5",
        sm: "",
        "icon-xs":
          "defaults:size-6 defaults:rounded-[calc(var(--radius)-3px)] defaults:p-0 defaults:has-[>svg]:p-0",
        "icon-sm": "defaults:size-8 defaults:p-0 defaults:has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
);

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset";
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "defaults:flex defaults:items-center defaults:gap-2 defaults:text-sm defaults:text-muted-foreground defaults:[&_svg]:pointer-events-none defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "defaults:flex-1 defaults:rounded-none defaults:border-0 defaults:bg-transparent defaults:shadow-none defaults:ring-0 defaults:focus-visible:ring-0 defaults:disabled:bg-transparent defaults:aria-invalid:ring-0 defaults:dark:bg-transparent defaults:dark:disabled:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "defaults:flex-1 defaults:resize-none defaults:rounded-none defaults:border-0 defaults:bg-transparent defaults:py-2 defaults:shadow-none defaults:ring-0 defaults:focus-visible:ring-0 defaults:disabled:bg-transparent defaults:aria-invalid:ring-0 defaults:dark:bg-transparent defaults:dark:disabled:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
