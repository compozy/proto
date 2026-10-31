// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

import { cn } from "@proto/ui/lib/utils";
import { Label } from "@proto/ui/components/label";
import { MinusIcon, PlusIcon } from "@proto/ui/lib/icons";

const NumberFieldContext = createContext<{
  fieldId: string;
  size: "sm" | "default" | "lg";
} | null>(null);

const numberFieldGroupVariants = cva(
  "defaults:relative defaults:flex defaults:w-full defaults:justify-between defaults:border defaults:border-input defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:aria-invalid:ring-destructive/20 defaults:dark:aria-invalid:ring-destructive/40 defaults:aria-invalid:border-destructive defaults:focus-within:has-aria-invalid:border-destructive defaults:focus-within:has-aria-invalid:ring-destructive/20 defaults:dark:focus-within:has-aria-invalid:ring-destructive/40 defaults:rounded-lg defaults:bg-transparent defaults:dark:bg-input/30 defaults:transition-colors defaults:focus-within:border-ring defaults:focus-within:ring-ring/50 defaults:focus-within:ring-3",
  {
    variants: {
      size: {
        sm: "defaults:h-7 defaults:text-sm",
        default: "defaults:h-8 defaults:text-sm",
        lg: "defaults:h-9 defaults:text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const numberFieldButtonVariants = cva(
  "defaults:relative defaults:flex defaults:shrink-0 defaults:cursor-pointer defaults:items-center defaults:justify-center defaults:transition-colors defaults:pointer-coarse:after:absolute defaults:pointer-coarse:after:size-full defaults:pointer-coarse:after:min-h-11 defaults:pointer-coarse:after:min-w-11 defaults:hover:bg-accent",
  {
    variants: {
      // Ladders restored from the pre-rename source. Rhea was added after they
      // were written, so its rungs are new: rhea tracks nova here because the
      // shadcn Input is h-8 px-2.5 in both sheets, where luma is h-9 px-3.
      size: {
        sm: ["defaults:px-1.5", "defaults:[&_svg:not([class*='size-'])]:size-3.5"],
        default: ["defaults:px-2", "defaults:[&_svg:not([class*='size-'])]:size-4"],
        lg: ["defaults:px-2.5", "defaults:[&_svg:not([class*='size-'])]:size-4"],
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const numberFieldInputVariants = cva(
  "defaults:w-full defaults:min-w-0 defaults:flex-1 defaults:bg-transparent defaults:text-center defaults:tabular-nums defaults:outline-none",
  {
    variants: {
      size: {
        sm: "defaults:px-2 defaults:py-0.5",
        default: "defaults:px-2.5 defaults:py-1",
        lg: "defaults:px-2.5 defaults:py-1.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

function NumberField({
  id,
  className,
  size = "default",
  ...props
}: NumberFieldPrimitive.Root.Props & VariantProps<typeof numberFieldGroupVariants>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const sizeValue = size ?? "default";

  return (
    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>
      <NumberFieldPrimitive.Root
        className={cn(
          "defaults:flex defaults:w-full defaults:flex-col defaults:items-start defaults:gap-2",
          className
        )}
        data-size={sizeValue}
        data-slot="number-field"
        id={fieldId}
        {...props}
      />
    </NumberFieldContext.Provider>
  );
}

function NumberFieldGroup({
  className,
  size: sizeProp,
  ...props
}: NumberFieldPrimitive.Group.Props & Partial<VariantProps<typeof numberFieldGroupVariants>>) {
  const context = useContext(NumberFieldContext);
  if (!context) {
    throw new Error("NumberFieldGroup must be used within a NumberField component.");
  }
  const size = sizeProp ?? context.size;

  return (
    <NumberFieldPrimitive.Group
      className={cn(numberFieldGroupVariants({ size }), className)}
      data-slot="number-field-group"
      {...props}
    />
  );
}

function NumberFieldDecrement({
  className,
  size: sizeProp,
  children,
  ...props
}: NumberFieldPrimitive.Decrement.Props &
  Partial<VariantProps<typeof numberFieldButtonVariants>> & {
    children?: React.ReactNode;
  }) {
  const context = useContext(NumberFieldContext);
  if (!context) {
    throw new Error("NumberFieldDecrement must be used within a NumberField component.");
  }
  const size = sizeProp ?? context.size;

  return (
    <NumberFieldPrimitive.Decrement
      className={cn(
        numberFieldButtonVariants({ size }),
        "defaults:rounded-s-lg defaults:border-e-0",
        className
      )}
      data-slot="number-field-decrement"
      {...props}
    >
      {children ?? <MinusIcon />}
    </NumberFieldPrimitive.Decrement>
  );
}

function NumberFieldIncrement({
  className,
  size: sizeProp,
  children,
  ...props
}: NumberFieldPrimitive.Increment.Props &
  Partial<VariantProps<typeof numberFieldButtonVariants>> & {
    children?: ReactNode;
  }) {
  const context = useContext(NumberFieldContext);
  if (!context) {
    throw new Error("NumberFieldIncrement must be used within a NumberField component.");
  }
  const size = sizeProp ?? context.size;

  return (
    <NumberFieldPrimitive.Increment
      className={cn(
        numberFieldButtonVariants({ size }),
        "defaults:rounded-e-lg defaults:border-s-0",
        className
      )}
      data-slot="number-field-increment"
      {...props}
    >
      {children ?? <PlusIcon />}
    </NumberFieldPrimitive.Increment>
  );
}

function NumberFieldInput({
  className,
  size: sizeProp,
  ...props
}: NumberFieldPrimitive.Input.Props & Partial<VariantProps<typeof numberFieldInputVariants>>) {
  const context = useContext(NumberFieldContext);
  if (!context) {
    throw new Error("NumberFieldInput must be used within a NumberField component.");
  }
  const size = sizeProp ?? context.size;

  return (
    <NumberFieldPrimitive.Input
      className={cn(numberFieldInputVariants({ size }), className)}
      data-slot="number-field-input"
      {...props}
    />
  );
}

function NumberFieldScrubArea({
  className,
  label,
  ...props
}: NumberFieldPrimitive.ScrubArea.Props & {
  label: string;
}) {
  const context = useContext(NumberFieldContext);
  if (!context) {
    throw new Error(
      "NumberFieldScrubArea must be used within a NumberField component for accessibility."
    );
  }

  return (
    <NumberFieldPrimitive.ScrubArea
      className={cn("defaults:flex defaults:cursor-ew-resize", className)}
      data-slot="number-field-scrub-area"
      {...props}
    >
      <Label className="defaults:cursor-ew-resize" htmlFor={context.fieldId}>
        {label}
      </Label>
      <NumberFieldPrimitive.ScrubAreaCursor className="defaults:drop-shadow-[0_1px_1px_#0008] defaults:filter">
        <CursorGrowIcon />
      </NumberFieldPrimitive.ScrubAreaCursor>
    </NumberFieldPrimitive.ScrubArea>
  );
}

function CursorGrowIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      fill="black"
      height="14"
      stroke="white"
      viewBox="0 0 24 14"
      width="26"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
    </svg>
  );
}

export {
  NumberField,
  NumberFieldScrubArea,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldGroup,
  NumberFieldInput,
};
