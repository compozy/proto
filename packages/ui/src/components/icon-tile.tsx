// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
// Title: Icon Tile
// Description: Square container that gives icons a consistent surface

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@proto/ui/lib/utils";

/**
 * CSS variable architecture:
 *
 * The root owns four variables so every part of the tile stays in proportion
 * and stays overridable from a single `className`:
 *
 *   --icon-tile-size       tile width/height
 *   --icon-tile-icon-size  glyph size applied to child svgs
 *   --icon-tile-radius     corner radius (also drives the nested inner card)
 *   --icon-tile-inset      gap between the outer ring and the inner card
 *
 * The `frame` and `soft` variants paint their inner card with an `::after`
 * pseudo element instead of a wrapper node. `isolate` makes the root a stacking
 * context, so the negative z-index pseudo paints above the root background but
 * below the in-flow icon - no extra DOM, and `render` composition keeps working.
 *
 * Tone: `soft` and `solid` derive every fill and border from `currentColor`, so
 * a single text color class (e.g. `text-success`) retints the whole tile. They
 * default to `text-primary`; override it to recolor without touching internals.
 */
const iconTileVariants = cva(
  [
    "defaults:relative defaults:inline-flex defaults:shrink-0 defaults:items-center defaults:justify-center defaults:align-middle",
    "defaults:size-(--icon-tile-size) defaults:rounded-[var(--icon-tile-radius,min(var(--radius-md),calc(var(--icon-tile-size)/3)))]",
    "defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*=size-])]:size-(--icon-tile-icon-size)",
  ],
  {
    variants: {
      variant: {
        /** Plain bordered surface. The quiet default for list rows and toolbars. */
        outline:
          "defaults:border defaults:border-border defaults:bg-background defaults:dark:bg-input/32",
        /** Raised muted fill with a background-colored ring. Reads as a physical chip. */
        elevated:
          "defaults:border-2 defaults:border-background defaults:bg-muted defaults:text-accent-foreground defaults:shadow-[0_1px_3px_0_rgb(0_0_0/0.14)] defaults:dark:border",
        /**
         * Tinted double container: an opacity-filled outer ring with no border
         * around a bordered inner card, all derived from `currentColor`. The
         * quiet, colorful sibling of `frame`. Retint with a text color class.
         */
        soft: [
          "defaults:isolate defaults:p-(--icon-tile-inset) defaults:text-primary defaults:bg-current/10",
          "defaults:after:absolute defaults:after:-z-10 defaults:after:inset-(--icon-tile-inset)",
          "defaults:after:rounded-[calc(var(--icon-tile-radius,min(var(--radius-md),calc(var(--icon-tile-size)/3)))-var(--icon-tile-inset))]",
          "defaults:after:border defaults:after:border-current/20 defaults:after:bg-current/5",
        ],
        /** Filled tone with a contrasting glyph. Retint with `bg-*` + a text color. */
        solid: "defaults:bg-primary defaults:text-primary-foreground",
        /** Double container - a muted ring around an inset card, matching Frame. */
        frame: [
          "defaults:isolate defaults:border defaults:border-border defaults:bg-muted/50 defaults:p-(--icon-tile-inset)",
          "defaults:after:absolute defaults:after:-z-10 defaults:after:inset-(--icon-tile-inset)",
          "defaults:after:rounded-[calc(var(--icon-tile-radius,min(var(--radius-md),calc(var(--icon-tile-size)/3)))-var(--icon-tile-inset))]",
          "defaults:after:border defaults:after:border-border defaults:after:bg-card defaults:after:shadow-xs",
        ],
      },
      size: {
        xs: "defaults:[--icon-tile-size:--spacing(6)] defaults:[--icon-tile-icon-size:--spacing(3.5)] defaults:[--icon-tile-inset:--spacing(0.5)]",
        sm: "defaults:[--icon-tile-size:--spacing(8)] defaults:[--icon-tile-icon-size:--spacing(4)] defaults:[--icon-tile-inset:--spacing(0.5)]",
        default:
          "defaults:[--icon-tile-size:--spacing(10)] defaults:[--icon-tile-icon-size:--spacing(4.5)] defaults:[--icon-tile-inset:--spacing(0.75)]",
        lg: "defaults:[--icon-tile-size:--spacing(12)] defaults:[--icon-tile-icon-size:--spacing(5.5)] defaults:[--icon-tile-inset:--spacing(0.75)]",
        xl: "defaults:[--icon-tile-size:--spacing(14)] defaults:[--icon-tile-icon-size:--spacing(7)] defaults:[--icon-tile-inset:--spacing(1)]",
      },
      /**
       * `default`: active style radius. `full`: circular.
       * No bare rung beside the ladder: the registry transform writes the
       * installed style's rung bare, and a second bare rung would leave class
       * order to pick the winner. The no-style fallback lives in the var()
       * that reads the radius instead.
       *
       * Each style token is clamped to a fraction of the tile. A flat radius
       * is a circle once it reaches half the box, so the soft styles used to
       * render `xs` (24px) and `sm` (32px) as plain circles and swallow the
       * `full` variant's meaning. Clamping keeps one corner ratio at every
       * size instead, so a tile still reads as the same shape when it scales.
       * Luma and Rhea take the gentler quarter ratio; Maia stays at a third.
       */
      radius: {
        default:
          "defaults:[--icon-tile-radius:min(var(--radius-md),calc(var(--icon-tile-size)/3))]",
        full: "defaults:[--icon-tile-radius:calc(infinity*1px)]",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
      radius: "default",
    },
  }
);

interface IconTileProps extends useRender.ComponentProps<"span"> {
  variant?: VariantProps<typeof iconTileVariants>["variant"];
  size?: VariantProps<typeof iconTileVariants>["size"];
  radius?: VariantProps<typeof iconTileVariants>["radius"];
}

function IconTile({
  className,
  variant = "outline",
  size = "default",
  radius = "default",
  render,
  ...props
}: IconTileProps) {
  const defaultProps = {
    "data-slot": "icon-tile",
    "data-variant": variant,
    "data-size": size,
    className: cn(iconTileVariants({ variant, size, radius, className })),
  };

  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(defaultProps, props),
  });
}

export { IconTile, iconTileVariants, type IconTileProps };
