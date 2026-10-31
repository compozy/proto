// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { cn } from "@proto/ui/lib/utils";
import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "@proto/ui/lib/icons";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "defaults:gap-2 defaults:flex defaults:items-center defaults:has-disabled:opacity-50",
        containerClassName
      )}
      spellCheck={false}
      className={cn("defaults:disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn(
        "defaults:flex defaults:items-center defaults:rounded-lg defaults:has-aria-invalid:border-destructive defaults:has-aria-invalid:ring-3 defaults:has-aria-invalid:ring-destructive/20 defaults:dark:has-aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "defaults:relative defaults:flex defaults:size-8 defaults:items-center defaults:justify-center defaults:border-y defaults:border-r defaults:border-input defaults:text-sm defaults:transition-all defaults:outline-none defaults:first:rounded-l-lg defaults:first:border-l defaults:last:rounded-r-lg defaults:aria-invalid:border-destructive defaults:data-[active=true]:z-10 defaults:data-[active=true]:border-ring defaults:data-[active=true]:ring-3 defaults:data-[active=true]:ring-ring/50 defaults:data-[active=true]:aria-invalid:border-destructive defaults:data-[active=true]:aria-invalid:ring-destructive/20 defaults:dark:bg-input/30 defaults:dark:data-[active=true]:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="defaults:pointer-events-none defaults:absolute defaults:inset-0 defaults:flex defaults:items-center defaults:justify-center">
          <div className="defaults:h-4 defaults:w-px defaults:animate-caret-blink defaults:bg-foreground defaults:duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      className="defaults:flex defaults:items-center defaults:[&_svg:not([class*='size-'])]:size-4"
      role="separator"
      {...props}
    >
      <MinusIcon />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
