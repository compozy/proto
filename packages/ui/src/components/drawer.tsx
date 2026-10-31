// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "@proto/ui/lib/utils";

type DrawerContextProps = {
  hasSnapPoints: boolean;
  modal: DrawerPrimitive.Root.Props["modal"];
  showSwipeHandle: boolean;
  swipeDirection: NonNullable<DrawerPrimitive.Root.Props["swipeDirection"]>;
};

const DrawerContext = React.createContext<DrawerContextProps | null>(null);

function useDrawer() {
  const context = React.useContext(DrawerContext);

  if (!context) {
    throw new Error("useDrawer must be used within a Drawer.");
  }

  return context;
}

function Drawer({
  modal = true,
  showSwipeHandle = false,
  snapPoints,
  swipeDirection = "down",
  ...props
}: DrawerPrimitive.Root.Props & {
  showSwipeHandle?: boolean;
}) {
  const hasSnapPoints = snapPoints != null && snapPoints.length > 0;
  const contextValue = React.useMemo(
    () => ({ hasSnapPoints, modal, showSwipeHandle, swipeDirection }),
    [hasSnapPoints, modal, showSwipeHandle, swipeDirection]
  );

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={modal}
        snapPoints={snapPoints}
        swipeDirection={swipeDirection}
        {...props}
      />
    </DrawerContext.Provider>
  );
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "defaults:fixed defaults:inset-0 defaults:z-50 defaults:min-h-dvh defaults:bg-black/10 defaults:opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] defaults:transition-opacity defaults:duration-450 defaults:ease-[cubic-bezier(0.32,0.72,0,1)] defaults:select-none defaults:data-ending-style:pointer-events-none defaults:data-ending-style:opacity-0 defaults:data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] defaults:data-snap-points:[--drawer-overlay-min-opacity:0.5] defaults:data-starting-style:opacity-0 defaults:data-swiping:duration-0 defaults:supports-backdrop-filter:backdrop-blur-xs defaults:supports-[-webkit-touch-callout:none]:absolute",
        className
      )}
      {...props}
    />
  );
}

function DrawerSwipeHandle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      className={cn(
        "defaults:relative defaults:z-10 defaults:flex defaults:shrink-0 defaults:cursor-grab defaults:transition-opacity defaults:duration-200 defaults:group-data-nested-drawer-open/drawer-popup:opacity-0 defaults:group-data-nested-drawer-swiping/drawer-popup:opacity-100 defaults:group-data-[swipe-axis=x]/drawer-popup:h-full defaults:group-data-[swipe-axis=x]/drawer-popup:w-3 defaults:group-data-[swipe-axis=x]/drawer-popup:items-center defaults:group-data-[swipe-axis=y]/drawer-popup:h-3 defaults:group-data-[swipe-axis=y]/drawer-popup:w-full defaults:group-data-[swipe-axis=y]/drawer-popup:justify-center defaults:group-data-[swipe-direction=down]/drawer-popup:items-end defaults:group-data-[swipe-direction=left]/drawer-popup:order-last defaults:group-data-[swipe-direction=left]/drawer-popup:justify-start defaults:group-data-[swipe-direction=right]/drawer-popup:justify-end defaults:group-data-[swipe-direction=up]/drawer-popup:order-last defaults:group-data-[swipe-direction=up]/drawer-popup:items-start defaults:after:block defaults:after:shrink-0 defaults:after:rounded-full defaults:after:bg-muted defaults:group-data-[swipe-axis=x]/drawer-popup:after:h-24 defaults:group-data-[swipe-axis=x]/drawer-popup:after:w-1 defaults:group-data-[swipe-axis=y]/drawer-popup:after:h-1 defaults:group-data-[swipe-axis=y]/drawer-popup:after:w-24 defaults:active:cursor-grabbing",
        className
      )}
      {...props}
    />
  );
}

function DrawerContent({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  const { hasSnapPoints, modal, showSwipeHandle, swipeDirection } = useDrawer();
  const swipeAxis = swipeDirection === "down" || swipeDirection === "up" ? "y" : "x";

  return (
    <DrawerPortal data-slot="drawer-portal">
      {modal === true && <DrawerOverlay data-snap-points={hasSnapPoints ? "" : undefined} />}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        data-modal={modal}
        className="defaults:pointer-events-none defaults:fixed defaults:inset-0 defaults:z-50 defaults:select-none defaults:data-[modal=true]:pointer-events-auto"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          data-swipe-axis={swipeAxis}
          data-snap-points={hasSnapPoints ? "" : undefined}
          className={cn(
            // Base.
            "group/drawer-popup defaults:pointer-events-auto defaults:fixed defaults:z-50 defaults:m-(--drawer-inset,0px) defaults:flex defaults:h-(--drawer-content-height) defaults:max-h-(--drawer-content-max-height,none) defaults:min-h-0 defaults:w-(--drawer-content-width,auto) defaults:transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] defaults:flex-col defaults:bg-popover defaults:text-sm defaults:text-popover-foreground defaults:transition-[transform,height,opacity,filter] defaults:duration-450 defaults:ease-[cubic-bezier(0.22,1,0.36,1)] defaults:will-change-transform defaults:outline-none defaults:select-none defaults:[interpolate-size:allow-keywords] defaults:data-[swipe-direction=down]:rounded-t-xl defaults:data-[swipe-direction=down]:border-t defaults:data-[swipe-direction=left]:rounded-r-xl defaults:data-[swipe-direction=left]:border-r defaults:data-[swipe-direction=right]:rounded-l-xl defaults:data-[swipe-direction=right]:border-l defaults:data-[swipe-direction=up]:rounded-b-xl defaults:data-[swipe-direction=up]:border-b",
            // Nested.
            "defaults:data-nested-drawer-open:overflow-hidden defaults:data-nested-drawer-open:brightness-95",
            // Bleed.
            "defaults:after:pointer-events-none defaults:after:absolute defaults:after:bg-(--drawer-bleed-background,var(--color-popover)) defaults:data-[swipe-axis=x]:after:inset-y-0 defaults:data-[swipe-axis=x]:after:w-(--bleed) defaults:data-[swipe-axis=y]:after:inset-x-0 defaults:data-[swipe-axis=y]:after:h-(--bleed) defaults:data-[swipe-direction=down]:after:top-full defaults:data-[swipe-direction=left]:after:right-full defaults:data-[swipe-direction=right]:after:left-full defaults:data-[swipe-direction=up]:after:bottom-full",
            // Sizing.
            "defaults:[--drawer-content-height:var(--drawer-height,auto)] defaults:data-[swipe-axis=x]:[--drawer-content-width:75%] defaults:data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-6rem)] defaults:data-[swipe-axis=y]:data-snap-points:[--drawer-content-height:100dvh] defaults:data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]",
            // Stack.
            "defaults:[--bleed:3rem] defaults:[--peek:1rem] defaults:[--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] defaults:[--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] defaults:[--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] defaults:[--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] defaults:[--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] defaults:[--stack-shrink:calc(1-var(--stack-scale))] defaults:[--stack-step:0.05]",
            // Transitions.
            "defaults:data-ending-style:transform-(--closed-transform) defaults:data-ending-style:opacity-[0.9999] defaults:data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] defaults:data-nested-drawer-swiping:duration-0 defaults:data-ending-style:data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] defaults:data-starting-style:transform-(--closed-transform) defaults:data-swiping:duration-0 defaults:data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            // Axis: y.
            "defaults:data-[swipe-axis=y]:inset-x-0 defaults:data-[swipe-axis=y]:data-nested-drawer-open:h-(--stack-height)",
            // Axis: x.
            "defaults:data-[swipe-axis=x]:inset-y-0 defaults:data-[swipe-axis=x]:flex-row",
            // Direction: down.
            "defaults:data-[swipe-direction=down]:bottom-0 defaults:data-[swipe-direction=down]:origin-bottom defaults:data-[swipe-direction=down]:[--closed-transform:translate3d(0,calc(100%+var(--drawer-inset,0px)+2px),0)] defaults:data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]",
            // Direction: up.
            "defaults:data-[swipe-direction=up]:top-0 defaults:data-[swipe-direction=up]:origin-top defaults:data-[swipe-direction=up]:[--closed-transform:translate3d(0,calc(-100%-var(--drawer-inset,0px)-2px),0)] defaults:data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]",
            // Direction: left.
            "defaults:data-[swipe-direction=left]:left-0 defaults:data-[swipe-direction=left]:origin-left defaults:data-[swipe-direction=left]:[--closed-transform:translate3d(calc(-100%-var(--drawer-inset,0px)-2px),0,0)] defaults:data-[swipe-direction=left]:[--translate-x:calc(var(--drawer-swipe-movement-x)+var(--stack-peek-offset)+(var(--stack-shrink)*100%))]",
            // Direction: right.
            "defaults:data-[swipe-direction=right]:right-0 defaults:data-[swipe-direction=right]:origin-right defaults:data-[swipe-direction=right]:[--closed-transform:translate3d(calc(100%+var(--drawer-inset,0px)+2px),0,0)] defaults:data-[swipe-direction=right]:[--translate-x:calc(var(--drawer-swipe-movement-x)-var(--stack-peek-offset)-(var(--stack-shrink)*100%))]",
            className
          )}
          {...props}
        >
          {showSwipeHandle && <DrawerSwipeHandle />}
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            className={cn(
              "defaults:flex defaults:min-h-0 defaults:flex-1 defaults:flex-col defaults:overflow-hidden defaults:overscroll-contain defaults:rounded-[inherit] defaults:transition-opacity defaults:duration-300 defaults:ease-[cubic-bezier(0.45,1.005,0,1.005)] defaults:select-text defaults:group-data-nested-drawer-open/drawer-popup:opacity-0 defaults:group-data-nested-drawer-swiping/drawer-popup:opacity-100 defaults:group-data-swiping/drawer-popup:select-none"
            )}
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "defaults:flex defaults:shrink-0 defaults:flex-col defaults:gap-0.5 defaults:p-4 defaults:pb-0 defaults:group-data-[swipe-axis=y]/drawer-popup:text-center defaults:md:gap-0.5 defaults:md:text-left",
        className
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "defaults:mt-auto defaults:flex defaults:shrink-0 defaults:flex-col defaults:gap-2 defaults:p-4 defaults:pt-0",
        className
      )}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "defaults:font-heading defaults:text-base defaults:font-medium defaults:text-foreground",
        className
      )}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn(
        "defaults:text-sm defaults:text-balance defaults:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerSwipeHandle,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
