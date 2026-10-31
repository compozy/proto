// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { cn } from "@proto/ui/lib/utils";

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("defaults:flex defaults:min-w-0 defaults:flex-col defaults:gap-2", className)}
      {...props}
    />
  );
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message defaults:relative defaults:flex defaults:w-full defaults:min-w-0 defaults:gap-2 defaults:text-sm defaults:data-[align=end]:flex-row-reverse",
        className
      )}
      {...props}
    />
  );
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "defaults:flex defaults:w-fit defaults:min-w-8 defaults:shrink-0 defaults:items-center defaults:justify-center defaults:self-end defaults:overflow-hidden defaults:rounded-full defaults:bg-muted defaults:group-has-data-[slot=message-footer]/message:-translate-y-8",
        className
      )}
      {...props}
    />
  );
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "defaults:flex defaults:w-full defaults:min-w-0 defaults:flex-col defaults:gap-2.5 defaults:wrap-break-word defaults:group-data-[align=end]/message:*:data-slot:self-end",
        className
      )}
      {...props}
    />
  );
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "defaults:flex defaults:max-w-full defaults:min-w-0 defaults:items-center defaults:px-3 defaults:text-xs defaults:font-medium defaults:text-muted-foreground defaults:group-has-data-[variant=ghost]/message:px-0",
        className
      )}
      {...props}
    />
  );
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "defaults:flex defaults:max-w-full defaults:min-w-0 defaults:items-center defaults:px-3 defaults:text-xs defaults:font-medium defaults:text-muted-foreground defaults:group-has-data-[variant=ghost]/message:px-0 defaults:group-data-[align=end]/message:justify-end",
        className
      )}
      {...props}
    />
  );
}

export { MessageGroup, Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader };
