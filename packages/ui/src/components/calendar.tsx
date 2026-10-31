// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { cn } from "@proto/ui/lib/utils";
import { DayPicker, getDefaultClassNames, type DayButton, type Locale } from "react-day-picker";

import { Button, buttonVariants } from "@proto/ui/components/button";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@proto/ui/lib/icons";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar defaults:bg-background defaults:p-2 defaults:[--cell-radius:var(--radius-md)] defaults:[--cell-size:--spacing(7)] defaults:in-data-[slot=card-content]:bg-transparent defaults:in-data-[slot=popover-content]:bg-transparent",
        String.raw`defaults:rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`defaults:rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("defaults:w-fit", defaultClassNames.root),
        months: cn(
          "defaults:relative defaults:flex defaults:flex-col defaults:gap-4 defaults:md:flex-row",
          defaultClassNames.months
        ),
        month: cn(
          "defaults:flex defaults:w-full defaults:flex-col defaults:gap-4",
          defaultClassNames.month
        ),
        nav: cn(
          "defaults:absolute defaults:inset-x-0 defaults:top-0 defaults:flex defaults:w-full defaults:items-center defaults:justify-between defaults:gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "defaults:size-(--cell-size) defaults:p-0 defaults:select-none defaults:aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "defaults:size-(--cell-size) defaults:p-0 defaults:select-none defaults:aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "defaults:flex defaults:h-(--cell-size) defaults:w-full defaults:items-center defaults:justify-center defaults:px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "defaults:flex defaults:h-(--cell-size) defaults:w-full defaults:items-center defaults:justify-center defaults:gap-1.5 defaults:text-sm defaults:font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "defaults:has-focus:border-ring defaults:border-input defaults:has-focus:ring-ring/50 defaults:border defaults:has-focus:ring-3 defaults:relative defaults:rounded-(--cell-radius)",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "defaults:absolute defaults:inset-0 defaults:bg-popover defaults:opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "defaults:font-medium defaults:select-none",
          captionLayout === "label"
            ? "defaults:text-sm"
            : "defaults:h-6 defaults:pr-1 defaults:pl-1.5 defaults:flex defaults:items-center defaults:gap-1 defaults:rounded-(--cell-radius) defaults:text-sm defaults:[&>svg]:size-3.5 defaults:[&>svg]:text-muted-foreground",
          defaultClassNames.caption_label
        ),
        month_grid: cn("defaults:w-full defaults:border-collapse", defaultClassNames.month_grid),
        weekdays: cn("defaults:flex", defaultClassNames.weekdays),
        weekday: cn(
          "defaults:flex-1 defaults:rounded-(--cell-radius) defaults:text-[0.8rem] defaults:font-normal defaults:text-muted-foreground defaults:select-none",
          defaultClassNames.weekday
        ),
        week: cn("defaults:mt-2 defaults:flex defaults:w-full", defaultClassNames.week),
        week_number_header: cn(
          "defaults:w-(--cell-size) defaults:select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "defaults:text-[0.8rem] defaults:text-muted-foreground defaults:select-none",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day defaults:relative defaults:aspect-square defaults:h-full defaults:w-full defaults:rounded-(--cell-radius) defaults:p-0 defaults:text-center defaults:select-none defaults:[&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
          props.showWeekNumber
            ? "defaults:[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
            : "defaults:[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
          defaultClassNames.day
        ),
        range_start: cn(
          "defaults:relative defaults:isolate defaults:z-0 defaults:rounded-l-(--cell-radius) defaults:bg-muted defaults:after:absolute defaults:after:inset-y-0 defaults:after:right-0 defaults:after:w-4 defaults:after:bg-muted",
          defaultClassNames.range_start
        ),
        range_middle: cn("defaults:rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "defaults:relative defaults:isolate defaults:z-0 defaults:rounded-r-(--cell-radius) defaults:bg-muted defaults:after:absolute defaults:after:inset-y-0 defaults:after:left-0 defaults:after:w-4 defaults:after:bg-muted",
          defaultClassNames.range_end
        ),
        today: cn(
          "defaults:rounded-(--cell-radius) defaults:bg-muted defaults:text-foreground defaults:data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "defaults:text-muted-foreground defaults:aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "defaults:text-muted-foreground defaults:opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("defaults:invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon
                className={cn("defaults:rtl:rotate-180 defaults:size-4", className)}
                {...props}
              />
            );
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("defaults:rtl:rotate-180 defaults:size-4", className)}
                {...props}
              />
            );
          }

          return <ChevronDownIcon className={cn("defaults:size-4", className)} {...props} />;
        },
        DayButton: ({ ...props }) => <CalendarDayButton locale={locale} {...props} />,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="defaults:flex defaults:size-(--cell-size) defaults:items-center defaults:justify-center defaults:text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  locale?: Partial<Locale>;
}) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "defaults:relative defaults:isolate defaults:z-10 defaults:flex defaults:aspect-square defaults:size-auto defaults:w-full defaults:min-w-(--cell-size) defaults:flex-col defaults:gap-1 defaults:border-0 defaults:leading-none defaults:font-normal defaults:group-data-[focused=true]/day:relative defaults:group-data-[focused=true]/day:z-10 defaults:group-data-[focused=true]/day:border-ring defaults:group-data-[focused=true]/day:ring-[3px] defaults:group-data-[focused=true]/day:ring-ring/50 defaults:data-[range-end=true]:rounded-(--cell-radius) defaults:data-[range-end=true]:rounded-r-(--cell-radius) defaults:data-[range-end=true]:bg-primary defaults:data-[range-end=true]:text-primary-foreground defaults:data-[range-middle=true]:rounded-none defaults:data-[range-middle=true]:bg-muted defaults:data-[range-middle=true]:text-foreground defaults:data-[range-start=true]:rounded-(--cell-radius) defaults:data-[range-start=true]:rounded-l-(--cell-radius) defaults:data-[range-start=true]:bg-primary defaults:data-[range-start=true]:text-primary-foreground defaults:data-[selected-single=true]:bg-primary defaults:data-[selected-single=true]:text-primary-foreground defaults:dark:hover:text-foreground defaults:[&>span]:text-xs defaults:[&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
