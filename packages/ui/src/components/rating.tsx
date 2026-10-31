// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@proto/ui/lib/utils";
import { StarIcon } from "@proto/ui/lib/icons";

const ratingVariants = cva("defaults:flex defaults:items-center", {
  variants: {
    size: {
      sm: "defaults:gap-2",
      default: "defaults:gap-2.5",
      lg: "defaults:gap-3",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const starVariants = cva("", {
  variants: {
    size: {
      sm: "defaults:w-4 defaults:h-4",
      default: "defaults:w-5 defaults:h-5",
      lg: "defaults:w-6 defaults:h-6",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const valueVariants = cva("defaults:text-muted-foreground defaults:w-5", {
  variants: {
    size: {
      sm: "defaults:text-xs",
      default: "defaults:text-sm",
      lg: "defaults:text-base",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

function Rating({
  rating,
  maxRating = 5,
  size,
  className,
  starClassName,
  showValue = false,
  editable = false,
  onRatingChange,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof ratingVariants> & {
    /**
     * Current rating value (supports decimal values for partial stars)
     */
    rating: number;
    /**
     * Maximum rating value (number of stars to show)
     */
    maxRating?: number;
    /**
     * Whether to show the numeric rating value
     */
    showValue?: boolean;
    /**
     * Class name for the value span
     */
    starClassName?: string;
    /**
     * Whether the rating is editable (clickable)
     */
    editable?: boolean;
    /**
     * Callback function called when rating changes
     */
    onRatingChange?: (rating: number) => void;
  }) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const displayRating = editable && hoveredRating !== null ? hoveredRating : rating;

  const handleStarClick = (starRating: number) => {
    if (editable && onRatingChange) {
      onRatingChange(starRating);
    }
  };

  const handleStarMouseEnter = (starRating: number) => {
    if (editable) {
      setHoveredRating(starRating);
    }
  };

  const handleStarMouseLeave = () => {
    if (editable) {
      setHoveredRating(null);
    }
  };

  const renderStars = () => {
    const stars = [];

    for (let i = 1; i <= maxRating; i++) {
      const filled = displayRating >= i;
      const partiallyFilled = displayRating > i - 1 && displayRating < i;
      const fillPercentage = partiallyFilled ? (displayRating - (i - 1)) * 100 : 0;

      stars.push(
        <div
          key={i}
          className={cn("defaults:relative", editable && "defaults:cursor-pointer")}
          onClick={() => handleStarClick(i)}
          onMouseEnter={() => handleStarMouseEnter(i)}
          onMouseLeave={handleStarMouseLeave}
        >
          {/* Background star (empty) */}
          <StarIcon
            data-slot="rating-star-empty"
            className={cn(starVariants({ size }), "defaults:text-muted-foreground/30")}
          />

          {/* Filled star */}
          <div
            className="defaults:absolute defaults:inset-0 defaults:overflow-hidden"
            style={{
              width: filled ? "100%" : `${fillPercentage}%`,
            }}
          >
            <StarIcon
              weight="Filled"
              data-slot="rating-star-filled"
              className={cn(
                starVariants({ size }),
                "defaults:fill-yellow-400 defaults:text-yellow-400"
              )}
            />
          </div>
        </div>
      );
    }

    return stars;
  };

  return (
    <div data-slot="rating" className={cn(ratingVariants({ size }), className)} {...props}>
      <div className="defaults:flex defaults:items-center">{renderStars()}</div>
      {showValue && (
        <span data-slot="rating-value" className={cn(valueVariants({ size }), starClassName)}>
          {displayRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export { Rating };
