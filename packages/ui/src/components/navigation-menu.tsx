// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { cva } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";
import { ChevronDownIcon } from "@proto/ui/lib/icons";

function NavigationMenu({
  align = "start",
  className,
  children,
  ...props
}: NavigationMenuPrimitive.Root.Props & Pick<NavigationMenuPrimitive.Positioner.Props, "align">) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn(
        "group/navigation-menu defaults:relative defaults:flex defaults:max-w-max defaults:flex-1 defaults:items-center defaults:justify-center",
        className
      )}
      {...props}
    >
      {children}
      <NavigationMenuPositioner align={align} />
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn(
        "group defaults:flex defaults:flex-1 defaults:list-none defaults:items-center defaults:justify-center defaults:gap-0",
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn("defaults:relative", className)}
      {...props}
    />
  );
}

const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger defaults:inline-flex defaults:h-9 defaults:w-max defaults:items-center defaults:justify-center defaults:rounded-lg defaults:px-2.5 defaults:py-1.5 defaults:text-sm defaults:font-medium defaults:transition-all defaults:outline-none defaults:hover:bg-muted defaults:focus:bg-muted defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:focus-visible:outline-1 defaults:disabled:pointer-events-none defaults:disabled:opacity-50 defaults:data-popup-open:bg-muted/50 defaults:data-popup-open:hover:bg-muted defaults:data-open:bg-muted/50 defaults:data-open:hover:bg-muted defaults:data-open:focus:bg-muted"
);

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: NavigationMenuPrimitive.Trigger.Props) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon
        className="defaults:relative defaults:top-px defaults:ml-1 defaults:size-3 defaults:transition defaults:duration-300 defaults:group-data-popup-open/navigation-menu-trigger:rotate-180 defaults:group-data-open/navigation-menu-trigger:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({ className, ...props }: NavigationMenuPrimitive.Content.Props) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "defaults:data-ending-style:data-activation-direction=left:translate-x-[50%] defaults:data-ending-style:data-activation-direction=right:translate-x-[-50%] defaults:data-starting-style:data-activation-direction=left:translate-x-[-50%] defaults:data-starting-style:data-activation-direction=right:translate-x-[50%] defaults:h-full defaults:w-auto defaults:p-1 defaults:transition-[opacity,transform,translate] defaults:duration-[0.35s] defaults:ease-[cubic-bezier(0.22,1,0.36,1)] defaults:group-data-[viewport=false]/navigation-menu:rounded-lg defaults:group-data-[viewport=false]/navigation-menu:bg-popover defaults:group-data-[viewport=false]/navigation-menu:text-popover-foreground defaults:group-data-[viewport=false]/navigation-menu:shadow defaults:group-data-[viewport=false]/navigation-menu:ring-1 defaults:group-data-[viewport=false]/navigation-menu:ring-foreground/10 defaults:group-data-[viewport=false]/navigation-menu:duration-300 defaults:data-ending-style:opacity-0 defaults:data-starting-style:opacity-0 defaults:data-[motion=from-end]:slide-in-from-right-52 defaults:data-[motion=from-start]:slide-in-from-left-52 defaults:data-[motion=to-end]:slide-out-to-right-52 defaults:data-[motion=to-start]:slide-out-to-left-52 defaults:data-[motion^=from-]:animate-in defaults:data-[motion^=from-]:fade-in defaults:data-[motion^=to-]:animate-out defaults:data-[motion^=to-]:fade-out defaults:**:data-[slot=navigation-menu-link]:focus:ring-0 defaults:**:data-[slot=navigation-menu-link]:focus:outline-none defaults:group-data-[viewport=false]/navigation-menu:data-open:animate-in defaults:group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 defaults:group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 defaults:group-data-[viewport=false]/navigation-menu:data-closed:animate-out defaults:group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 defaults:group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95",
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuPositioner({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  ...props
}: NavigationMenuPrimitive.Positioner.Props) {
  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "defaults:isolate defaults:z-50 defaults:h-(--positioner-height) defaults:w-(--positioner-width) defaults:max-w-(--available-width) defaults:transition-[top,left,right,bottom] defaults:duration-[0.35s] defaults:ease-[cubic-bezier(0.22,1,0.36,1)] defaults:data-instant:transition-none defaults:data-[side=bottom]:before:top-[-10px] defaults:data-[side=bottom]:before:right-0 defaults:data-[side=bottom]:before:left-0",
          className
        )}
        {...props}
      >
        <NavigationMenuPrimitive.Popup className="defaults:data-[ending-style]:easing-[ease] defaults:xs:w-(--popup-width) defaults:relative defaults:h-(--popup-height) defaults:w-(--popup-width) defaults:origin-(--transform-origin) defaults:rounded-lg defaults:bg-popover defaults:text-popover-foreground defaults:shadow defaults:ring-1 defaults:ring-foreground/10 defaults:transition-[opacity,transform,width,height,scale,translate] defaults:duration-[0.35s] defaults:ease-[cubic-bezier(0.22,1,0.36,1)] defaults:outline-none defaults:data-ending-style:scale-90 defaults:data-ending-style:opacity-0 defaults:data-ending-style:duration-150 defaults:data-starting-style:scale-90 defaults:data-starting-style:opacity-0">
          <NavigationMenuPrimitive.Viewport className="defaults:relative defaults:size-full defaults:overflow-hidden" />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  );
}

function NavigationMenuLink({ className, ...props }: NavigationMenuPrimitive.Link.Props) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "defaults:flex defaults:items-center defaults:gap-2 defaults:rounded-lg defaults:p-2 defaults:text-sm defaults:transition-all defaults:outline-none defaults:hover:bg-muted defaults:focus:bg-muted defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:focus-visible:outline-1 defaults:in-data-[slot=navigation-menu-content]:rounded-md defaults:data-active:bg-muted/50 defaults:data-active:hover:bg-muted defaults:data-active:focus:bg-muted defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuIndicator({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Icon>) {
  return (
    <NavigationMenuPrimitive.Icon
      data-slot="navigation-menu-indicator"
      className={cn(
        "defaults:top-full defaults:z-1 defaults:flex defaults:h-1.5 defaults:items-end defaults:justify-center defaults:overflow-hidden defaults:data-[state=hidden]:animate-out defaults:data-[state=hidden]:fade-out defaults:data-[state=visible]:animate-in defaults:data-[state=visible]:fade-in",
        className
      )}
      {...props}
    >
      <div className="defaults:relative defaults:top-[60%] defaults:h-2 defaults:w-2 defaults:rotate-45 defaults:rounded-tl-sm defaults:bg-border defaults:shadow-md" />
    </NavigationMenuPrimitive.Icon>
  );
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  NavigationMenuPositioner,
};
