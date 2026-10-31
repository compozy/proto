// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@proto/ui/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proto/ui/components/dialog";
import { InputGroup, InputGroupAddon } from "@proto/ui/components/input-group";
import { CheckIcon, SearchIcon } from "@proto/ui/lib/icons";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "defaults:flex defaults:size-full defaults:flex-col defaults:overflow-hidden defaults:rounded-xl! defaults:bg-popover defaults:p-1 defaults:text-popover-foreground",
        className
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="defaults:sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "defaults:top-1/3 defaults:translate-y-0 defaults:overflow-hidden defaults:rounded-xl! defaults:p-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="defaults:p-1 defaults:pb-0">
      <InputGroup className="defaults:h-8! defaults:rounded-lg! defaults:border-input/30 defaults:bg-input/30 defaults:shadow-none! defaults:*:data-[slot=input-group-addon]:pl-2!">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            "defaults:w-full defaults:text-sm defaults:outline-hidden defaults:disabled:cursor-not-allowed defaults:disabled:opacity-50",
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="defaults:size-4 defaults:shrink-0 defaults:opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "defaults:no-scrollbar defaults:max-h-72 defaults:scroll-py-1 defaults:overflow-x-hidden defaults:overflow-y-auto defaults:outline-none",
        className
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("defaults:py-6 defaults:text-center defaults:text-sm", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "defaults:overflow-hidden defaults:p-1 defaults:text-foreground defaults:**:[[cmdk-group-heading]]:px-2 defaults:**:[[cmdk-group-heading]]:py-1.5 defaults:**:[[cmdk-group-heading]]:text-xs defaults:**:[[cmdk-group-heading]]:font-medium defaults:**:[[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("defaults:-mx-1 defaults:h-px defaults:bg-border", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-2 defaults:rounded-sm defaults:px-2 defaults:py-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:in-data-[slot=dialog-content]:rounded-lg! defaults:data-[disabled=true]:pointer-events-none defaults:data-[disabled=true]:opacity-50 defaults:data-selected:bg-muted defaults:data-selected:text-foreground defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4 defaults:data-selected:*:[svg]:text-foreground",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon className="defaults:ml-auto defaults:opacity-0 defaults:group-has-data-[slot=command-shortcut]/command-item:hidden defaults:group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "defaults:ml-auto defaults:text-xs defaults:tracking-widest defaults:text-muted-foreground defaults:group-data-selected/command-item:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
