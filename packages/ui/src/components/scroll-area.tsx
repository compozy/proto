// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@proto/ui/lib/utils";
function ScrollArea({ children, ...props }: ScrollAreaPrimitive.Root.Props) {
  return (
    <ScrollAreaRoot {...props}>
      <ScrollAreaViewport>
        <ScrollAreaPrimitive.Content
          data-slot="scroll-area-content"
          style={{ minWidth: "100%", display: "table" }}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaViewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaRoot>
  );
}
function ScrollAreaRoot({ className, ...props }: ScrollAreaPrimitive.Root.Props) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("defaults:relative", className)}
      {...props}
    />
  );
}
function ScrollAreaViewport({ className, ...props }: ScrollAreaPrimitive.Viewport.Props) {
  return (
    <ScrollAreaPrimitive.Viewport
      data-slot="scroll-area-viewport"
      className={cn(
        "defaults:size-full defaults:rounded-[inherit] defaults:transition-[color,box-shadow] defaults:outline-none defaults:focus-visible:ring-[3px] defaults:focus-visible:ring-ring/50 defaults:focus-visible:outline-1",
        className
      )}
      {...props}
    />
  );
}
function ScrollAreaScrollbar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "defaults:flex defaults:touch-none defaults:p-px defaults:transition-colors defaults:select-none defaults:data-horizontal:h-2.5 defaults:data-horizontal:flex-col defaults:data-horizontal:border-t defaults:data-horizontal:border-t-transparent defaults:data-vertical:h-full defaults:data-vertical:w-2.5 defaults:data-vertical:border-l defaults:data-vertical:border-l-transparent",
        className
      )}
      {...props}
    />
  );
}
function ScrollAreaThumb({ className, ...props }: ScrollAreaPrimitive.Thumb.Props) {
  return (
    <ScrollAreaPrimitive.Thumb
      data-slot="scroll-area-thumb"
      className={cn(
        "defaults:relative defaults:flex-1 defaults:rounded-full defaults:bg-border",
        className
      )}
      {...props}
    />
  );
}
function ScrollBar({
  children = <ScrollAreaThumb />,
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return <ScrollAreaScrollbar {...props}>{children}</ScrollAreaScrollbar>;
}
export {
  ScrollArea,
  ScrollAreaRoot,
  ScrollAreaViewport,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollBar,
};
