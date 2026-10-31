// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@proto/ui/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props<number[]>) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max];

  return (
    <SliderPrimitive.Root
      className={cn("defaults:data-horizontal:w-full defaults:data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="defaults:relative defaults:flex defaults:w-full defaults:touch-none defaults:items-center defaults:select-none defaults:data-disabled:opacity-50 defaults:data-vertical:h-full defaults:data-vertical:min-h-40 defaults:data-vertical:w-auto defaults:data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="defaults:relative defaults:grow defaults:overflow-hidden defaults:rounded-full defaults:bg-muted defaults:select-none defaults:data-horizontal:h-1 defaults:data-horizontal:w-full defaults:data-vertical:h-full defaults:data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="defaults:bg-primary defaults:select-none defaults:data-horizontal:h-full defaults:data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="defaults:relative defaults:block defaults:size-3 defaults:shrink-0 defaults:rounded-full defaults:border defaults:border-ring defaults:bg-white defaults:ring-ring/50 defaults:transition-[color,box-shadow] defaults:select-none defaults:after:absolute defaults:after:-inset-2 defaults:hover:ring-3 defaults:focus-visible:ring-3 defaults:focus-visible:outline-hidden defaults:active:ring-3 defaults:disabled:pointer-events-none defaults:disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
