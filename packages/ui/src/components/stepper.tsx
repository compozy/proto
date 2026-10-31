// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import type { HTMLAttributes, ReactElement } from "react";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useId,
  useRef,
  useState,
} from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@proto/ui/lib/utils";

// Types
type StepperOrientation = "horizontal" | "vertical";
type StepState = "active" | "completed" | "inactive" | "loading";
type StepIndicators = {
  active?: React.ReactNode;
  completed?: React.ReactNode;
  inactive?: React.ReactNode;
  loading?: React.ReactNode;
};

interface StepperContextValue {
  instanceId: string;
  activeStep: number;
  setActiveStep: (step: number) => void;
  stepsCount: number;
  orientation: StepperOrientation;
  registerTrigger: (node: HTMLButtonElement) => () => void;
  triggerNodes: HTMLButtonElement[];
  focusNext: (currentIdx: number) => void;
  focusPrev: (currentIdx: number) => void;
  focusFirst: () => void;
  focusLast: () => void;
  indicators: StepIndicators;
}

interface StepItemContextValue {
  step: number;
  state: StepState;
  isDisabled: boolean;
  isLoading: boolean;
}

const StepperContext = createContext<StepperContextValue | undefined>(undefined);
const StepItemContext = createContext<StepItemContextValue | undefined>(undefined);

function useStepper() {
  const ctx = useContext(StepperContext);
  if (!ctx) throw new Error("useStepper must be used within a Stepper");
  return ctx;
}

function useStepItem() {
  const ctx = useContext(StepItemContext);
  if (!ctx) throw new Error("useStepItem must be used within a StepperItem");
  return ctx;
}

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: StepperOrientation;
  indicators?: StepIndicators;
}

function Stepper({
  defaultValue = 1,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
  indicators = {},
  ...props
}: StepperProps) {
  const instanceId = useId();
  const [activeStep, setActiveStep] = useState(defaultValue);
  const [triggerNodes, setTriggerNodes] = useState<HTMLButtonElement[]>([]);
  const registerTrigger = useCallback((node: HTMLButtonElement) => {
    setTriggerNodes((previous) => (previous.includes(node) ? previous : [...previous, node]));
    return () => setTriggerNodes((previous) => previous.filter((item) => item !== node));
  }, []);

  const handleSetActiveStep = useCallback(
    (step: number) => {
      if (value === undefined) {
        setActiveStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange]
  );

  const currentStep = value ?? activeStep;
  const focusTrigger = useCallback(
    (index: number, direction = 1) => {
      for (let offset = 0; offset < triggerNodes.length; offset++) {
        const position = (index + offset * direction + triggerNodes.length) % triggerNodes.length;
        const node = triggerNodes[position];
        if (node?.isConnected && !node.disabled) {
          node.focus();
          return;
        }
      }
    },
    [triggerNodes]
  );
  const focusNext = useCallback((index: number) => focusTrigger(index + 1), [focusTrigger]);
  const focusPrev = useCallback((index: number) => focusTrigger(index - 1, -1), [focusTrigger]);
  const focusFirst = useCallback(() => focusTrigger(0), [focusTrigger]);
  const focusLast = useCallback(
    () => focusTrigger(triggerNodes.length - 1, -1),
    [focusTrigger, triggerNodes.length]
  );
  // Context value
  const contextValue = useMemo<StepperContextValue>(
    () => ({
      instanceId,
      activeStep: currentStep,
      setActiveStep: handleSetActiveStep,
      stepsCount: Children.toArray(children).filter(
        (child): child is ReactElement =>
          isValidElement(child) &&
          (
            child.type as {
              displayName?: string;
            }
          ).displayName === "StepperItem"
      ).length,
      orientation,
      registerTrigger,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      triggerNodes,
      indicators,
    }),
    [
      currentStep,
      handleSetActiveStep,
      children,
      orientation,
      registerTrigger,
      triggerNodes,
      instanceId,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      indicators,
    ]
  );

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        data-slot="stepper"
        className={cn("defaults:w-full", className)}
        data-orientation={orientation}
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  );
}

interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
  completed?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

function StepperItem({
  step,
  completed = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const { activeStep } = useStepper();

  const state: StepState =
    completed || step < activeStep ? "completed" : activeStep === step ? "active" : "inactive";

  const isLoading = loading && step === activeStep;

  return (
    <StepItemContext.Provider value={{ step, state, isDisabled: disabled, isLoading }}>
      <div
        data-slot="stepper-item"
        className={cn(
          "group/step defaults:flex defaults:items-center defaults:justify-center defaults:not-last:flex-1 defaults:group-data-[orientation=horizontal]/stepper-nav:flex-row defaults:group-data-[orientation=vertical]/stepper-nav:flex-col",
          className
        )}
        data-step-state={state}
        {...(isLoading ? { "data-loading": true } : {})}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  );
}

type StepperTriggerProps = useRender.ComponentProps<"button">;
function StepperTrigger({
  className,
  children,
  tabIndex,
  onClick,
  onKeyDown,
  render,
  ...props
}: StepperTriggerProps) {
  const { state, isLoading } = useStepItem();
  const stepperCtx = useStepper();
  const {
    instanceId,
    setActiveStep,
    activeStep,
    registerTrigger,
    triggerNodes,
    focusNext,
    focusPrev,
    focusFirst,
    focusLast,
  } = stepperCtx;
  const { step, isDisabled } = useStepItem();
  const isSelected = activeStep === step;
  const id = `${instanceId}-stepper-tab-${step}`;
  const panelId = `${instanceId}-stepper-panel-${step}`;
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const node = btnRef.current;
    if (node) return registerTrigger(node);
  }, [registerTrigger]);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const myIdx = triggerNodes.indexOf(e.currentTarget);
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        if (myIdx !== -1 && focusNext) focusNext(myIdx);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        if (myIdx !== -1 && focusPrev) focusPrev(myIdx);
        break;
      case "Home":
        e.preventDefault();
        if (focusFirst) focusFirst();
        break;
      case "End":
        e.preventDefault();
        if (focusLast) focusLast();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setActiveStep(step);
        break;
    }
  };

  const defaultProps = {
    role: "tab",
    id,
    "aria-selected": isSelected,
    "aria-controls": panelId,
    tabIndex: typeof tabIndex === "number" ? tabIndex : isSelected ? 0 : -1,
    "data-slot": "stepper-trigger",
    "data-step-state": state,
    "data-loading": isLoading,
    className: cn(
      "defaults:focus-visible:border-ring defaults:focus-visible:ring-ring/50 defaults:inline-flex defaults:cursor-pointer defaults:items-center defaults:outline-none defaults:focus-visible:z-10 defaults:focus-visible:ring-3 defaults:disabled:pointer-events-none defaults:disabled:opacity-60",
      "defaults:gap-2.5 defaults:rounded-full",
      className
    ),
    type: "button" as const,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) setActiveStep(step);
    },
    onKeyDown: handleKeyDown,
    disabled: isDisabled,
    children,
  };

  return useRender({
    defaultTagName: "button",
    render,
    ref: btnRef,
    props: mergeProps<"button">(defaultProps, props),
  });
}
function StepperIndicator({ children, className, ...props }: React.ComponentProps<"div">) {
  const { state, isLoading } = useStepItem();
  const { indicators } = useStepper();

  return (
    <div
      {...props}
      data-slot="stepper-indicator"
      data-step-state={state}
      className={cn(
        "defaults:border-background defaults:bg-accent defaults:text-accent-foreground defaults:data-[step-state=completed]:bg-primary defaults:data-[step-state=completed]:text-primary-foreground defaults:data-[step-state=active]:bg-primary defaults:data-[step-state=active]:text-primary-foreground defaults:relative defaults:flex defaults:size-6 defaults:shrink-0 defaults:items-center defaults:justify-center defaults:overflow-hidden",
        "defaults:rounded-full defaults:text-xs",
        className
      )}
    >
      <div className="defaults:absolute">
        {indicators &&
        ((isLoading && indicators.loading) ||
          (state === "completed" && indicators.completed) ||
          (state === "active" && indicators.active) ||
          (state === "inactive" && indicators.inactive))
          ? (isLoading && indicators.loading) ||
            (state === "completed" && indicators.completed) ||
            (state === "active" && indicators.active) ||
            (state === "inactive" && indicators.inactive)
          : children}
      </div>
    </div>
  );
}
function StepperSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const { state } = useStepItem();

  return (
    <div
      {...props}
      data-slot="stepper-separator"
      data-step-state={state}
      className={cn(
        "defaults:bg-muted defaults:rounded-sm defaults:m-0.5 defaults:group-data-[orientation=horizontal]/stepper-nav:h-0.5 defaults:group-data-[orientation=horizontal]/stepper-nav:flex-1 defaults:group-data-[orientation=vertical]/stepper-nav:h-12 defaults:group-data-[orientation=vertical]/stepper-nav:w-0.5",
        className
      )}
    />
  );
}
function StepperTitle({ children, className, ...props }: React.ComponentProps<"h3">) {
  const { state } = useStepItem();

  return (
    <h3
      {...props}
      data-slot="stepper-title"
      data-step-state={state}
      className={cn("defaults:text-sm defaults:[line-height:1] defaults:font-medium", className)}
    >
      {children}
    </h3>
  );
}
function StepperDescription({ children, className, ...props }: React.ComponentProps<"div">) {
  const { state } = useStepItem();

  return (
    <div
      {...props}
      data-slot="stepper-description"
      data-step-state={state}
      className={cn("defaults:text-muted-foreground defaults:text-sm", className)}
    >
      {children}
    </div>
  );
}
function StepperNav({ children, className, ...props }: React.ComponentProps<"nav">) {
  const { activeStep, orientation } = useStepper();

  return (
    <nav
      {...props}
      role="tablist"
      aria-orientation={orientation}
      data-slot="stepper-nav"
      data-step-state={activeStep}
      data-orientation={orientation}
      className={cn(
        "group/stepper-nav defaults:inline-flex defaults:data-[orientation=horizontal]:w-full defaults:data-[orientation=horizontal]:flex-row defaults:data-[orientation=vertical]:flex-col",
        className
      )}
    >
      {children}
    </nav>
  );
}
function StepperPanel({ children, className, ...props }: React.ComponentProps<"div">) {
  const { activeStep } = useStepper();

  return (
    <div
      {...props}
      data-slot="stepper-panel"
      data-step-state={activeStep}
      className={cn("defaults:w-full", className)}
    >
      {children}
    </div>
  );
}

interface StepperContentProps extends React.ComponentProps<"div"> {
  value: number;
  forceMount?: boolean;
}
function StepperContent({ value, forceMount, children, className, ...props }: StepperContentProps) {
  const { activeStep, instanceId } = useStepper();
  const isActive = value === activeStep;

  if (!forceMount && !isActive) {
    return null;
  }

  return (
    <div
      {...props}
      role="tabpanel"
      id={`${instanceId}-stepper-panel-${value}`}
      aria-labelledby={`${instanceId}-stepper-tab-${value}`}
      tabIndex={0}
      data-slot="stepper-content"
      data-step-state={activeStep}
      className={cn("defaults:w-full", className, !isActive && forceMount && "defaults:hidden")}
      hidden={!isActive && forceMount}
    >
      {children}
    </div>
  );
}

export {
  useStepper,
  useStepItem,
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  StepperDescription,
  StepperPanel,
  StepperContent,
  StepperNav,
  type StepperProps,
  type StepperItemProps,
  type StepperTriggerProps,
  type StepperContentProps,
};
