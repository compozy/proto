// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { createContext, useContext, useId, useState } from "react";
import { cn } from "@proto/ui/lib/utils";

function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}
const TooltipDescriptionContext = createContext<{ id: string; open: boolean } | null>(null);

function Tooltip({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: TooltipPrimitive.Root.Props) {
  const id = useId();
  const [localOpen, setOpen] = useState(defaultOpen);
  const open = controlledOpen ?? localOpen;
  return (
    <TooltipDescriptionContext value={{ id: `${id}-tooltip`, open }}>
      <TooltipPrimitive.Root
        {...props}
        open={open}
        onOpenChange={(next, details) => {
          onOpenChange?.(next, details);
          if (!details.isCanceled && controlledOpen === undefined) setOpen(next);
        }}
      />
    </TooltipDescriptionContext>
  );
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  const description = useContext(TooltipDescriptionContext);
  const describedBy =
    [props["aria-describedby"], description?.open ? description.id : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      aria-describedby={describedBy}
    />
  );
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  const description = useContext(TooltipDescriptionContext);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="defaults:isolate defaults:z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "defaults:z-50 defaults:inline-flex defaults:w-fit defaults:max-w-xs defaults:origin-(--transform-origin) defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:bg-foreground defaults:px-3 defaults:py-1.5 defaults:text-xs defaults:text-background defaults:has-data-[slot=kbd]:pr-1.5 defaults:data-[side=bottom]:slide-in-from-top-2 defaults:data-[side=inline-end]:slide-in-from-left-2 defaults:data-[side=inline-start]:slide-in-from-right-2 defaults:data-[side=left]:slide-in-from-right-2 defaults:data-[side=right]:slide-in-from-left-2 defaults:data-[side=top]:slide-in-from-bottom-2 defaults:**:data-[slot=kbd]:relative defaults:**:data-[slot=kbd]:isolate defaults:**:data-[slot=kbd]:z-50 defaults:**:data-[slot=kbd]:rounded-sm defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95",
            className
          )}
          {...props}
          role="tooltip"
          id={description?.id ?? props.id}
        >
          {children}
          <TooltipPrimitive.Arrow className="defaults:z-50 defaults:size-2.5 defaults:translate-y-[calc(-50%-2px)] defaults:rotate-45 defaults:rounded-[2px] defaults:bg-foreground defaults:fill-foreground defaults:data-[side=bottom]:top-1 defaults:data-[side=inline-end]:top-1/2! defaults:data-[side=inline-end]:-left-1 defaults:data-[side=inline-end]:-translate-y-1/2 defaults:data-[side=inline-start]:top-1/2! defaults:data-[side=inline-start]:-right-1 defaults:data-[side=inline-start]:-translate-y-1/2 defaults:data-[side=left]:top-1/2! defaults:data-[side=left]:-right-1 defaults:data-[side=left]:-translate-y-1/2 defaults:data-[side=right]:top-1/2! defaults:data-[side=right]:-left-1 defaults:data-[side=right]:-translate-y-1/2 defaults:data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
