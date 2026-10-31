/**
 * Viewport of the prototype canvas: a device toggle (desktop, tablet, phone, fit to the area) and
 * a menu with every preset width of each device. Custom widths come from dragging the canvas
 * edges (`canvas.tsx`); all of them live in `?w=`.
 */
import {
  ChevronDownIcon,
  MonitorIcon,
  ScanIcon,
  SmartphoneIcon,
  TabletIcon,
} from "@proto/ui/lib/icons";

import { Button } from "@proto/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@proto/ui/components/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@proto/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@proto/ui/components/tooltip";

import { deviceOf, devices, updateView, type Device, type Viewport } from "./view";

const icons = { desktop: MonitorIcon, tablet: TabletIcon, phone: SmartphoneIcon } as const;

export function ViewportControl({ width }: { width: Viewport }) {
  const device = deviceOf(width);
  const choose = (value: Device | "fit") => {
    if (value === "fit") updateView({ width: "fit" });
    else if (value !== device) {
      updateView({ width: devices.find(item => item.id === value)?.widths[0]?.width ?? "fit" });
    }
  };
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5" data-testid="viewport">
      <ToggleGroup
        aria-label="Device"
        size="sm"
        spacing={0}
        value={[device ?? "fit"]}
        onValueChange={(values: string[]) => {
          const value = values[0];
          if (value) choose(value as Device | "fit");
        }}
        className="gap-0.5"
      >
        {devices.map(item => {
          const Icon = icons[item.id];
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={item.id}
                    aria-label={item.label}
                    className="h-6 min-w-7 rounded-md px-1.5 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground data-pressed:bg-card"
                  />
                }
              >
                <Icon />
              </TooltipTrigger>
              <TooltipContent>
                {item.label} · {item.widths[0]?.width} px
              </TooltipContent>
            </Tooltip>
          );
        })}
        <Tooltip>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value="fit"
                aria-label="Fit to area"
                className="h-6 min-w-7 rounded-md px-1.5 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground data-pressed:bg-card"
              />
            }
          >
            <ScanIcon />
          </TooltipTrigger>
          <TooltipContent>Fit to area</TooltipContent>
        </Tooltip>
      </ToggleGroup>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 rounded-md px-1.5 font-mono text-[11px] text-muted-foreground"
              aria-label="Exact width"
              data-testid="viewport-width"
            />
          }
        >
          {width === "fit" ? "auto" : `${width} px`}
          <ChevronDownIcon className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuRadioGroup
            value={String(width)}
            onValueChange={(value: string) =>
              updateView({ width: value === "fit" ? "fit" : Number(value) })
            }
          >
            {devices.map((item, index) => (
              <DropdownMenuGroup key={item.id}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                {[...item.widths]
                  .sort((a, b) => b.width - a.width)
                  .map(preset => (
                    <DropdownMenuRadioItem key={preset.width} value={String(preset.width)}>
                      <span className="flex-1">{preset.label}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {preset.width}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
              </DropdownMenuGroup>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="fit">Fit to area</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 text-[12px] text-muted-foreground">
            Drag the canvas edges to any width.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
