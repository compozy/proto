// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { cn } from "@proto/ui/lib/utils";
import { ChevronDownIcon } from "@proto/ui/lib/icons";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
};

function NativeSelect({ className, size = "default", ...props }: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select defaults:relative defaults:w-fit defaults:has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="defaults:h-8 defaults:w-full defaults:min-w-0 defaults:appearance-none defaults:rounded-lg defaults:border defaults:border-input defaults:bg-transparent defaults:py-1 defaults:pr-8 defaults:pl-2.5 defaults:text-sm defaults:transition-colors defaults:outline-none defaults:select-none defaults:selection:bg-primary defaults:selection:text-primary-foreground defaults:placeholder:text-muted-foreground defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:disabled:pointer-events-none defaults:disabled:cursor-not-allowed defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:data-[size=sm]:h-7 defaults:data-[size=sm]:rounded-[min(var(--radius-md),10px)] defaults:data-[size=sm]:py-0.5 defaults:dark:bg-input/30 defaults:dark:hover:bg-input/50 defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40"
        {...props}
      />
      <ChevronDownIcon
        className="defaults:pointer-events-none defaults:absolute defaults:top-1/2 defaults:right-2.5 defaults:size-4 defaults:-translate-y-1/2 defaults:text-muted-foreground defaults:select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("defaults:bg-[Canvas] defaults:text-[CanvasText]", className)}
      {...props}
    />
  );
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("defaults:bg-[Canvas] defaults:text-[CanvasText]", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
