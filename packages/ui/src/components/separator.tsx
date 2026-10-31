// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "@proto/ui/lib/utils";

function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "defaults:shrink-0 defaults:bg-border defaults:data-horizontal:h-px defaults:data-horizontal:w-full defaults:data-vertical:w-px defaults:data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
