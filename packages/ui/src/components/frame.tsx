// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@proto/ui/lib/utils";

/**
 * Frame sets --frame-panel-bg and --frame-panel-border-color; FramePanel reads
 * them back as bg-(--frame-panel-bg) and border-(--frame-panel-border-color).
 * So variant="inverse" re-points every panel from one place, and a consumer's
 * own bg-* on a panel still wins on source order, with no :not() and no `!`.
 */
const frameVariants = cva(
  [
    "defaults:relative defaults:flex defaults:flex-col defaults:bg-muted/50 defaults:gap-(--frame-gap) defaults:px-(--frame-px) defaults:py-(--frame-py) defaults:rounded-(--frame-radius)",
    // Each rung is the radius that style's own shadcn Card resolves through, so
    // a Frame and a Card side by side agree. lyra/sera are 0px, NOT
    // var(--radius-none): no such token exists, and it only reached 0 by being
    // invalid, which also left --frame-radius empty for anything reading it.
    "defaults:[--frame-radius:var(--radius-xl)]",
    "defaults:[--frame-gap:--spacing(0.75)] defaults:[--frame-px:--spacing(0.75)] defaults:[--frame-py:--spacing(0.75)] defaults:[--frame-panel-header-gap:0rem] defaults:[--frame-panel-footer-gap:--spacing(1)]",
    "defaults:[--frame-panel-px-adjust:0px] defaults:[--frame-panel-py-adjust:0px] defaults:[--frame-panel-header-px-adjust:0px] defaults:[--frame-panel-header-py-adjust:0px] defaults:[--frame-panel-footer-px-adjust:0px] defaults:[--frame-panel-footer-py-adjust:0px]",
    "defaults:[--frame-panel-px:calc(var(--frame-panel-px-base)+var(--frame-panel-px-adjust))] defaults:[--frame-panel-py:calc(var(--frame-panel-py-base)+var(--frame-panel-py-adjust))] defaults:[--frame-panel-header-px:calc(var(--frame-panel-header-px-base)+var(--frame-panel-header-px-adjust))] defaults:[--frame-panel-header-py:calc(var(--frame-panel-header-py-base)+var(--frame-panel-header-py-adjust))] defaults:[--frame-panel-footer-px:calc(var(--frame-panel-footer-px-base)+var(--frame-panel-footer-px-adjust))] defaults:[--frame-panel-footer-py:calc(var(--frame-panel-footer-py-base)+var(--frame-panel-footer-py-adjust))]",
    // Luma alone re-times the frame: wider gap and padding, roomier bars.
    "",
    "defaults:[--frame-panel-bg:var(--color-card)] defaults:[--frame-panel-border-color:var(--color-border)] defaults:[--frame-border-color:var(--color-border)]",
    // Concentric: the panel nests inside the frame's corner rather than copying
    // it. It is inset by the 1px border plus --frame-px, so subtracting exactly
    // that keeps the two arcs parallel. `ghost` drops the border term (no
    // border), `dense` pins it to the frame radius (panels sit flush).
    "defaults:[--frame-panel-radius:calc(var(--frame-radius)-var(--frame-px)-1px)]",
  ],
  {
    variants: {
      variant: {
        default:
          "defaults:border defaults:border-[var(--frame-border-color)] defaults:bg-clip-padding",
        inverse:
          "defaults:[--frame-panel-bg:color-mix(in_oklch,var(--color-muted)_40%,transparent)] defaults:border defaults:border-[var(--frame-border-color)] defaults:bg-background defaults:bg-clip-padding",
        ghost: "defaults:[--frame-panel-radius:calc(var(--frame-radius)-var(--frame-px))]",
      },
      // Bars read as chrome, not a second content block: py runs 0.5/1.5/2/2.5
      // against a body py of 2/3.5/4/5, while px stays level with the body so
      // header, content and footer left-align. xs floors at 0.5 (2px), below
      // which it stops reading as padding. No style-*.css overrides these.
      spacing: {
        xs: "defaults:[--frame-panel-px-base:--spacing(2)] defaults:[--frame-panel-py-base:--spacing(2)] defaults:[--frame-panel-header-px-base:--spacing(2)] defaults:[--frame-panel-header-py-base:--spacing(0.5)] defaults:[--frame-panel-footer-px-base:--spacing(2)] defaults:[--frame-panel-footer-py-base:--spacing(0.5)]",
        sm: "defaults:[--frame-panel-px-base:--spacing(3)] defaults:[--frame-panel-py-base:--spacing(3.5)] defaults:[--frame-panel-header-px-base:--spacing(3)] defaults:[--frame-panel-header-py-base:--spacing(1.5)] defaults:[--frame-panel-footer-px-base:--spacing(3)] defaults:[--frame-panel-footer-py-base:--spacing(1.5)]",
        default:
          "defaults:[--frame-panel-px-base:--spacing(4)] defaults:[--frame-panel-py-base:--spacing(4)] defaults:[--frame-panel-header-px-base:--spacing(4)] defaults:[--frame-panel-header-py-base:--spacing(2)] defaults:[--frame-panel-footer-px-base:--spacing(4)] defaults:[--frame-panel-footer-py-base:--spacing(2)]",
        lg: "defaults:[--frame-panel-px-base:--spacing(5)] defaults:[--frame-panel-py-base:--spacing(5)] defaults:[--frame-panel-header-px-base:--spacing(5)] defaults:[--frame-panel-header-py-base:--spacing(2.5)] defaults:[--frame-panel-footer-px-base:--spacing(5)] defaults:[--frame-panel-footer-py-base:--spacing(2.5)]",
      },
      stacked: {
        true: [
          "defaults:gap-0 defaults:*:has-[+[data-slot=frame-panel]]:rounded-b-none",
          "defaults:*:has-[+[data-slot=frame-panel]]:before:hidden",
          "defaults:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:rounded-t-none",
          "defaults:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:border-t-0",
        ],
        false: [
          "defaults:data-[spacing=sm]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-0.5",
          "defaults:data-[spacing=default]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
          "defaults:data-[spacing=lg]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-2",
        ],
      },
      dense: {
        // Parent selectors, not CSS vars: these are positional. Panels are
        // pulled flush (-mx-px), so corners align with the frame's own radius.
        true: "defaults:p-0 defaults:gap-0 defaults:border-[var(--frame-border-color)] defaults:[--frame-panel-radius:var(--frame-radius)] defaults:[&_[data-slot=frame-panel]]:-mx-px defaults:[&_[data-slot=frame-panel]]:before:hidden defaults:[&_[data-slot=frame-panel]:last-child]:-mb-px defaults:[&:not(:has([data-slot=frame-panel-header]))_[data-slot=frame-panel]:is(:first-child)]:-mt-px",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      spacing: "default",
      stacked: false,
      dense: false,
    },
  }
);

function Frame({
  className,
  variant,
  spacing,
  stacked,
  dense,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof frameVariants>) {
  return (
    <div
      className={cn(frameVariants({ variant, spacing, stacked, dense }), className)}
      data-slot="frame"
      data-spacing={spacing}
      {...props}
    />
  );
}

function FramePanel({ className, fit, ...props }: React.ComponentProps<"div"> & { fit?: boolean }) {
  return (
    <div
      className={cn(
        "defaults:relative defaults:overflow-hidden defaults:rounded-(--frame-panel-radius) defaults:border defaults:border-(--frame-panel-border-color) defaults:bg-(--frame-panel-bg) defaults:bg-clip-padding defaults:shadow-xs",
        /* `fit` sizes the panel to its content; otherwise it grows to fill
           the frame. */
        !fit && "defaults:grow",
        "defaults:before:pointer-events-none defaults:before:absolute defaults:before:inset-0 defaults:before:rounded-[calc(var(--frame-panel-radius)-1px)] defaults:before:shadow-black/5",
        "defaults:dark:bg-clip-border defaults:dark:before:shadow-white/5",
        "defaults:px-(--frame-panel-px) defaults:py-(--frame-panel-py)",
        className
      )}
      data-slot="frame-panel"
      {...props}
    />
  );
}

function FrameHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "defaults:flex defaults:flex-col defaults:gap-(--frame-panel-header-gap) defaults:px-(--frame-panel-header-px) defaults:py-(--frame-panel-header-py)",
        className
      )}
      data-slot="frame-panel-header"
      {...props}
    />
  );
}

function FrameTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("defaults:text-sm defaults:font-semibold", className)}
      data-slot="frame-panel-title"
      {...props}
    />
  );
}

function FrameDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("defaults:text-muted-foreground defaults:text-sm", className)}
      data-slot="frame-panel-description"
      {...props}
    />
  );
}

function FrameFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      className={cn(
        "defaults:flex defaults:flex-col defaults:gap-(--frame-panel-footer-gap) defaults:px-(--frame-panel-footer-px) defaults:py-(--frame-panel-footer-py)",
        className
      )}
      data-slot="frame-panel-footer"
      {...props}
    />
  );
}

export { Frame, FramePanel, FrameHeader, FrameTitle, FrameDescription, FrameFooter, frameVariants };
