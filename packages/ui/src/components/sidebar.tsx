// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

import { useIsMobile } from "@proto/ui/hooks/use-mobile";
import { Button } from "@proto/ui/components/button";
import { Input } from "@proto/ui/components/input";
import { Separator } from "@proto/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@proto/ui/components/sheet";
import { Skeleton } from "@proto/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@proto/ui/components/tooltip";
import { PanelLeftIcon } from "@proto/ui/lib/icons";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open]
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper defaults:flex defaults:min-h-svh defaults:w-full defaults:has-data-[variant=inset]:bg-sidebar",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  dir,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "defaults:flex defaults:h-full defaults:w-(--sidebar-width) defaults:flex-col defaults:bg-sidebar defaults:text-sidebar-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          dir={dir}
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="defaults:w-(--sidebar-width) defaults:bg-sidebar defaults:p-0 defaults:text-sidebar-foreground defaults:[&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="defaults:sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="defaults:flex defaults:h-full defaults:w-full defaults:flex-col">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer defaults:hidden defaults:text-sidebar-foreground defaults:md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "defaults:relative defaults:w-(--sidebar-width) defaults:bg-transparent defaults:transition-[width] defaults:duration-200 defaults:ease-linear",
          "defaults:group-data-[collapsible=offcanvas]:w-0",
          "defaults:group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "defaults:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "defaults:group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          "defaults:fixed defaults:inset-y-0 defaults:z-10 defaults:hidden defaults:h-svh defaults:w-(--sidebar-width) defaults:transition-[left,right,width] defaults:duration-200 defaults:ease-linear defaults:data-[side=left]:left-0 defaults:data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] defaults:data-[side=right]:right-0 defaults:data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] defaults:md:flex",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "defaults:p-2 defaults:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "defaults:group-data-[collapsible=icon]:w-(--sidebar-width-icon) defaults:group-data-[side=left]:border-r defaults:group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="defaults:flex defaults:size-full defaults:flex-col defaults:bg-sidebar defaults:group-data-[variant=floating]:rounded-lg defaults:group-data-[variant=floating]:shadow-sm defaults:group-data-[variant=floating]:ring-1 defaults:group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeftIcon className="defaults:rtl:rotate-180" />
      <span className="defaults:sr-only">Toggle Sidebar</span>
    </Button>
  );
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "defaults:absolute defaults:inset-y-0 defaults:z-20 defaults:hidden defaults:w-4 defaults:transition-all defaults:ease-linear defaults:group-data-[side=left]:-right-4 defaults:group-data-[side=right]:left-0 defaults:after:absolute defaults:after:inset-y-0 defaults:after:start-1/2 defaults:after:w-[2px] defaults:hover:after:bg-sidebar-border defaults:sm:flex defaults:ltr:-translate-x-1/2 defaults:rtl:-translate-x-1/2",
        "defaults:in-data-[side=left]:cursor-w-resize defaults:in-data-[side=right]:cursor-e-resize",
        "defaults:[[data-side=left][data-state=collapsed]_&]:cursor-e-resize defaults:[[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "defaults:group-data-[collapsible=offcanvas]:translate-x-0 defaults:group-data-[collapsible=offcanvas]:after:left-full defaults:hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "defaults:[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "defaults:[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "defaults:relative defaults:flex defaults:w-full defaults:flex-1 defaults:flex-col defaults:bg-background defaults:md:peer-data-[variant=inset]:m-2 defaults:md:peer-data-[variant=inset]:ml-0 defaults:md:peer-data-[variant=inset]:rounded-xl defaults:md:peer-data-[variant=inset]:shadow-sm defaults:md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  );
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn(
        "defaults:h-8 defaults:w-full defaults:bg-background defaults:shadow-none",
        className
      )}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("defaults:flex defaults:flex-col defaults:gap-2 defaults:p-2", className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("defaults:flex defaults:flex-col defaults:gap-2 defaults:p-2", className)}
      {...props}
    />
  );
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("defaults:mx-2 defaults:w-auto defaults:bg-sidebar-border", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "defaults:no-scrollbar defaults:flex defaults:min-h-0 defaults:flex-1 defaults:flex-col defaults:gap-0 defaults:overflow-auto defaults:group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn(
        "defaults:relative defaults:flex defaults:w-full defaults:min-w-0 defaults:flex-col defaults:p-2",
        className
      )}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "defaults:flex defaults:h-8 defaults:shrink-0 defaults:items-center defaults:rounded-md defaults:px-2 defaults:text-xs defaults:font-medium defaults:text-sidebar-foreground/70 defaults:ring-sidebar-ring defaults:outline-hidden defaults:transition-[margin,opacity] defaults:duration-200 defaults:ease-linear defaults:group-data-[collapsible=icon]:-mt-8 defaults:group-data-[collapsible=icon]:opacity-0 defaults:focus-visible:ring-2 defaults:[&>svg]:size-4 defaults:[&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-group-label",
      sidebar: "group-label",
    },
  });
}

function SidebarGroupAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & React.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "defaults:absolute defaults:top-3.5 defaults:right-3 defaults:flex defaults:aspect-square defaults:w-5 defaults:items-center defaults:justify-center defaults:rounded-md defaults:p-0 defaults:text-sidebar-foreground defaults:ring-sidebar-ring defaults:outline-hidden defaults:transition-transform defaults:group-data-[collapsible=icon]:hidden defaults:after:absolute defaults:after:-inset-2 defaults:hover:bg-sidebar-accent defaults:hover:text-sidebar-accent-foreground defaults:focus-visible:ring-2 defaults:md:after:hidden defaults:[&>svg]:size-4 defaults:[&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-group-action",
      sidebar: "group-action",
    },
  });
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("defaults:w-full defaults:text-sm", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn(
        "defaults:flex defaults:w-full defaults:min-w-0 defaults:flex-col defaults:gap-0",
        className
      )}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item defaults:relative", className)}
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button group/menu-button defaults:flex defaults:w-full defaults:items-center defaults:gap-2 defaults:overflow-hidden defaults:rounded-md defaults:p-2 defaults:text-left defaults:text-sm defaults:ring-sidebar-ring defaults:outline-hidden defaults:transition-[width,height,padding] defaults:group-has-data-[sidebar=menu-action]/menu-item:pr-8 defaults:group-data-[collapsible=icon]:size-8! defaults:group-data-[collapsible=icon]:p-2! defaults:hover:bg-sidebar-accent defaults:hover:text-sidebar-accent-foreground defaults:focus-visible:ring-2 defaults:active:bg-sidebar-accent defaults:active:text-sidebar-accent-foreground defaults:disabled:pointer-events-none defaults:disabled:opacity-50 defaults:aria-disabled:pointer-events-none defaults:aria-disabled:opacity-50 defaults:data-open:hover:bg-sidebar-accent defaults:data-open:hover:text-sidebar-accent-foreground defaults:data-active:bg-sidebar-accent defaults:data-active:font-medium defaults:data-active:text-sidebar-accent-foreground defaults:[&_svg]:size-4 defaults:[&_svg]:shrink-0 defaults:[&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "defaults:hover:bg-sidebar-accent defaults:hover:text-sidebar-accent-foreground",
        outline:
          "defaults:bg-background defaults:shadow-[0_0_0_1px_var(--sidebar-border)] defaults:hover:bg-sidebar-accent defaults:hover:text-sidebar-accent-foreground defaults:hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "defaults:h-8 defaults:text-sm",
        sm: "defaults:h-7 defaults:text-xs",
        lg: "defaults:h-12 defaults:text-sm defaults:group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar();
  const comp = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      },
      props
    ),
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  });

  if (!tooltip) {
    return comp;
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  );
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    showOnHover?: boolean;
  }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "defaults:absolute defaults:top-1.5 defaults:right-1 defaults:flex defaults:aspect-square defaults:w-5 defaults:items-center defaults:justify-center defaults:rounded-md defaults:p-0 defaults:text-sidebar-foreground defaults:ring-sidebar-ring defaults:outline-hidden defaults:transition-transform defaults:group-data-[collapsible=icon]:hidden defaults:peer-hover/menu-button:text-sidebar-accent-foreground defaults:peer-data-[size=default]/menu-button:top-1.5 defaults:peer-data-[size=lg]/menu-button:top-2.5 defaults:peer-data-[size=sm]/menu-button:top-1 defaults:after:absolute defaults:after:-inset-2 defaults:hover:bg-sidebar-accent defaults:hover:text-sidebar-accent-foreground defaults:focus-visible:ring-2 defaults:md:after:hidden defaults:[&>svg]:size-4 defaults:[&>svg]:shrink-0",
          showOnHover &&
            "defaults:group-focus-within/menu-item:opacity-100 defaults:group-hover/menu-item:opacity-100 defaults:peer-data-active/menu-button:text-sidebar-accent-foreground defaults:aria-expanded:opacity-100 defaults:md:opacity-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-action",
      sidebar: "menu-action",
    },
  });
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "defaults:pointer-events-none defaults:absolute defaults:right-1 defaults:flex defaults:h-5 defaults:min-w-5 defaults:items-center defaults:justify-center defaults:rounded-md defaults:px-1 defaults:text-xs defaults:font-medium defaults:text-sidebar-foreground defaults:tabular-nums defaults:select-none defaults:group-data-[collapsible=icon]:hidden defaults:peer-hover/menu-button:text-sidebar-accent-foreground defaults:peer-data-[size=default]/menu-button:top-1.5 defaults:peer-data-[size=lg]/menu-button:top-2.5 defaults:peer-data-[size=sm]/menu-button:top-1 defaults:peer-data-active/menu-button:text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean;
}) {
  // Random width between 50 to 90%.
  const [width] = React.useState(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  });

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn(
        "defaults:flex defaults:h-8 defaults:items-center defaults:gap-2 defaults:rounded-md defaults:px-2",
        className
      )}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="defaults:size-4 defaults:rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="defaults:h-4 defaults:max-w-(--skeleton-width) defaults:flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "defaults:mx-3.5 defaults:flex defaults:min-w-0 defaults:translate-x-px defaults:flex-col defaults:gap-1 defaults:border-l defaults:border-sidebar-border defaults:px-2.5 defaults:py-0.5 defaults:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item defaults:relative", className)}
      {...props}
    />
  );
}

function SidebarMenuSubButton({
  render,
  size = "md",
  isActive = false,
  className,
  ...props
}: useRender.ComponentProps<"a"> &
  React.ComponentProps<"a"> & {
    size?: "sm" | "md";
    isActive?: boolean;
  }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "defaults:flex defaults:h-7 defaults:min-w-0 defaults:-translate-x-px defaults:items-center defaults:gap-2 defaults:overflow-hidden defaults:rounded-md defaults:px-2 defaults:text-sidebar-foreground defaults:ring-sidebar-ring defaults:outline-hidden defaults:group-data-[collapsible=icon]:hidden defaults:hover:bg-sidebar-accent defaults:hover:text-sidebar-accent-foreground defaults:focus-visible:ring-2 defaults:active:bg-sidebar-accent defaults:active:text-sidebar-accent-foreground defaults:disabled:pointer-events-none defaults:disabled:opacity-50 defaults:aria-disabled:pointer-events-none defaults:aria-disabled:opacity-50 defaults:data-[size=md]:text-sm defaults:data-[size=sm]:text-xs defaults:data-active:bg-sidebar-accent defaults:data-active:text-sidebar-accent-foreground defaults:[&>span:last-child]:truncate defaults:[&>svg]:size-4 defaults:[&>svg]:shrink-0 defaults:[&>svg]:text-sidebar-accent-foreground",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-sub-button",
      sidebar: "menu-sub-button",
      size,
      active: isActive,
    },
  });
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
