// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { cn } from "@proto/ui/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "defaults:flex defaults:items-center defaults:gap-2 defaults:text-sm defaults:leading-none defaults:font-medium defaults:select-none defaults:group-data-[disabled=true]:pointer-events-none defaults:group-data-[disabled=true]:opacity-50 defaults:peer-disabled:cursor-not-allowed defaults:peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Label };
