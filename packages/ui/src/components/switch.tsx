// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@proto/ui/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch defaults:relative defaults:inline-flex defaults:shrink-0 defaults:items-center defaults:rounded-full defaults:border defaults:border-transparent defaults:transition-all defaults:outline-none defaults:group-has-[:focus-visible]/field-label:border-transparent defaults:group-has-[:focus-visible]/field-label:ring-0 defaults:after:absolute defaults:after:-inset-x-3 defaults:after:-inset-y-2 defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:data-[size=default]:h-[18.4px] defaults:data-[size=default]:w-[32px] defaults:data-[size=sm]:h-[14px] defaults:data-[size=sm]:w-[24px] defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40 defaults:data-checked:bg-primary defaults:data-unchecked:bg-input defaults:dark:data-unchecked:bg-input/80 defaults:data-disabled:cursor-not-allowed defaults:data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="defaults:pointer-events-none defaults:block defaults:rounded-full defaults:bg-background defaults:ring-0 defaults:transition-transform defaults:group-data-[size=default]/switch:size-4 defaults:group-data-[size=sm]/switch:size-3 defaults:group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] defaults:group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] defaults:dark:data-checked:bg-primary-foreground defaults:group-data-[size=default]/switch:data-unchecked:translate-x-0 defaults:group-data-[size=sm]/switch:data-unchecked:translate-x-0 defaults:dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
