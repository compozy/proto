// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@proto/ui/lib/utils";

// Types
type TimelineContextValue = {
  activeStep: number;
  setActiveStep: (step: number) => void;
};

// Context
const TimelineContext = createContext<TimelineContextValue | undefined>(undefined);

const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a Timeline");
  }
  return context;
};

// Components
interface TimelineProps extends useRender.ComponentProps<"div"> {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
}

function Timeline({
  defaultValue = 1,
  value,
  onValueChange,
  orientation = "vertical",
  className,
  render,
  children,
  ...props
}: TimelineProps) {
  const [activeStep, setInternalStep] = useState(defaultValue);

  const setActiveStep = useCallback(
    (step: number) => {
      if (value === undefined) {
        setInternalStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange]
  );

  const currentStep = value ?? activeStep;

  const defaultProps = {
    className: cn(
      "group/timeline defaults:flex defaults:data-[orientation=horizontal]:w-full defaults:data-[orientation=horizontal]:flex-row defaults:data-[orientation=vertical]:flex-col",
      className
    ),
    "data-orientation": orientation,
    "data-slot": "timeline",
    children,
  };

  return (
    <TimelineContext.Provider value={{ activeStep: currentStep, setActiveStep }}>
      {useRender({
        defaultTagName: "div",
        render,
        props: mergeProps<"div">(defaultProps, props),
      })}
    </TimelineContext.Provider>
  );
}

// TimelineContent
function TimelineContent({
  className,
  render,
  children,
  ...props
}: useRender.ComponentProps<"div">) {
  const defaultProps = {
    className: cn("defaults:text-muted-foreground defaults:text-sm", className),
    "data-slot": "timeline-content",
    children,
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

// TimelineDate
type TimelineDateProps = useRender.ComponentProps<"time">;

function TimelineDate({ className, render, children, ...props }: TimelineDateProps) {
  const defaultProps = {
    className: cn(
      "defaults:mb-1 defaults:block defaults:font-medium defaults:text-muted-foreground defaults:text-xs defaults:group-data-[orientation=vertical]/timeline:max-sm:h-4",
      className
    ),
    "data-slot": "timeline-date",
    children,
  };

  return useRender({
    defaultTagName: "time",
    render,
    props: mergeProps<"time">(defaultProps, props),
  });
}

// TimelineHeader
function TimelineHeader({
  className,
  render,
  children,
  ...props
}: useRender.ComponentProps<"div">) {
  const defaultProps = {
    className: cn(className),
    "data-slot": "timeline-header",
    children,
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

// TimelineIndicator
type TimelineIndicatorProps = useRender.ComponentProps<"div">;

function TimelineIndicator({ className, children, render, ...props }: TimelineIndicatorProps) {
  const defaultProps = {
    "aria-hidden": true,
    className: cn(
      "defaults:group-data-[orientation=horizontal]/timeline:-top-6 defaults:group-data-[orientation=horizontal]/timeline:-translate-y-1/2 defaults:group-data-[orientation=vertical]/timeline:-left-6 defaults:group-data-[orientation=vertical]/timeline:-translate-x-1/2 defaults:absolute defaults:size-4 defaults:rounded-full defaults:border-2 defaults:border-primary/20 defaults:group-data-[orientation=vertical]/timeline:top-0 defaults:group-data-[orientation=horizontal]/timeline:left-0 defaults:group-data-completed/timeline-item:border-primary",
      className
    ),
    "data-slot": "timeline-indicator",
    children,
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

// TimelineItem
interface TimelineItemProps extends useRender.ComponentProps<"div"> {
  step: number;
}

function TimelineItem({ step, className, render, children, ...props }: TimelineItemProps) {
  const { activeStep } = useTimeline();

  const defaultProps = {
    className: cn(
      "group/timeline-item defaults:relative defaults:flex defaults:flex-1 defaults:flex-col defaults:gap-0.5 defaults:group-data-[orientation=vertical]/timeline:ms-8 defaults:group-data-[orientation=horizontal]/timeline:mt-8 defaults:group-data-[orientation=horizontal]/timeline:not-last:pe-8 defaults:group-data-[orientation=vertical]/timeline:not-last:pb-6 defaults:has-[+[data-completed]]:**:data-[slot=timeline-separator]:bg-primary",
      className
    ),
    "data-completed": step <= activeStep || undefined,
    "data-slot": "timeline-item",
    children,
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

// TimelineSeparator
function TimelineSeparator({
  className,
  render,
  children,
  ...props
}: useRender.ComponentProps<"div">) {
  const defaultProps = {
    "aria-hidden": true,
    className: cn(
      "defaults:group-data-[orientation=horizontal]/timeline:-top-6 defaults:group-data-[orientation=horizontal]/timeline:-translate-y-1/2 defaults:group-data-[orientation=vertical]/timeline:-left-6 defaults:group-data-[orientation=vertical]/timeline:-translate-x-1/2 defaults:absolute defaults:self-start defaults:bg-primary/10 defaults:group-last/timeline-item:hidden defaults:group-data-[orientation=horizontal]/timeline:h-0.5 defaults:group-data-[orientation=vertical]/timeline:h-[calc(100%-1rem-0.25rem)] defaults:group-data-[orientation=horizontal]/timeline:w-[calc(100%-1rem-0.25rem)] defaults:group-data-[orientation=vertical]/timeline:w-0.5 defaults:group-data-[orientation=horizontal]/timeline:translate-x-4.5 defaults:group-data-[orientation=vertical]/timeline:translate-y-4.5",
      className
    ),
    "data-slot": "timeline-separator",
    children,
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

// TimelineTitle
function TimelineTitle({ className, render, children, ...props }: useRender.ComponentProps<"h3">) {
  const defaultProps = {
    className: cn("defaults:font-medium defaults:text-sm", className),
    "data-slot": "timeline-title",
    children,
  };

  return useRender({
    defaultTagName: "h3",
    render,
    props: mergeProps<"h3">(defaultProps, props),
  });
}

export {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
};
