// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proto/ui/lib/utils";

import { Label } from "@proto/ui/components/label";
import { Separator } from "@proto/ui/components/separator";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "defaults:flex defaults:flex-col defaults:gap-4 defaults:has-[>[data-slot=checkbox-group]]:gap-3 defaults:has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & {
  variant?: "legend" | "label";
}) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "defaults:mb-1.5 defaults:font-medium defaults:data-[variant=label]:text-sm defaults:data-[variant=legend]:text-base",
        className
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group defaults:@container/field-group defaults:flex defaults:w-full defaults:flex-col defaults:gap-5 defaults:data-[slot=checkbox-group]:gap-3 defaults:*:data-[slot=field-group]:gap-4",
        className
      )}
      {...props}
    />
  );
}

const fieldVariants = cva(
  "group/field defaults:flex defaults:w-full defaults:gap-2 defaults:data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "defaults:flex-col defaults:*:w-full defaults:[&>.sr-only]:w-auto",
        horizontal:
          "defaults:flex-row defaults:items-center defaults:has-[>[data-slot=field-content]]:items-start defaults:*:data-[slot=field-label]:flex-auto defaults:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "defaults:flex-col defaults:*:w-full defaults:@md/field-group:flex-row defaults:@md/field-group:items-center defaults:@md/field-group:*:w-auto defaults:@md/field-group:has-[>[data-slot=field-content]]:items-start defaults:@md/field-group:*:data-[slot=field-label]:flex-auto defaults:[&>.sr-only]:w-auto defaults:@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
);

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content defaults:flex defaults:flex-1 defaults:flex-col defaults:gap-0.5 defaults:leading-snug",
        className
      )}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label defaults:flex defaults:w-fit defaults:gap-2 defaults:leading-snug defaults:group-data-[disabled=true]/field:opacity-50 defaults:has-data-checked:border-primary/30 defaults:has-data-checked:bg-primary/5 defaults:has-[>[data-slot=field]]:rounded-lg defaults:has-[>[data-slot=field]]:border defaults:has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 defaults:has-[>[data-slot=field]]:has-[:focus-visible]:border-ring defaults:has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 defaults:has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 defaults:*:data-[slot=field]:p-2.5 defaults:dark:has-data-checked:border-primary/20 defaults:dark:has-data-checked:bg-primary/10",
        "defaults:has-[>[data-slot=field]]:w-full defaults:has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "defaults:flex defaults:w-fit defaults:items-center defaults:gap-2 defaults:text-sm defaults:font-medium defaults:group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "defaults:text-left defaults:text-sm defaults:leading-normal defaults:font-normal defaults:text-muted-foreground defaults:group-has-data-horizontal/field:text-balance defaults:[[data-variant=legend]+&]:-mt-1.5",
        "defaults:last:mt-0 defaults:nth-last-2:-mt-1",
        "defaults:[&>a]:underline defaults:[&>a]:underline-offset-4 defaults:[&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "defaults:relative defaults:-my-2 defaults:h-5 defaults:text-sm defaults:group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="defaults:absolute defaults:inset-0 defaults:top-1/2" />
      {children && (
        <span
          className="defaults:relative defaults:mx-auto defaults:block defaults:w-fit defaults:bg-background defaults:px-2 defaults:text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<
    | {
        message?: string;
      }
    | undefined
  >;
}) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="defaults:ml-4 defaults:flex defaults:list-disc defaults:flex-col defaults:gap-1">
        {uniqueErrors.map((error, index) => error?.message && <li key={index}>{error.message}</li>)}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("defaults:text-sm defaults:font-normal defaults:text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  );
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};
