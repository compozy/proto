// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire";
import { cn } from "@proto/ui/lib/utils";

import { buttonVariants, type Button } from "@proto/ui/components/button";
import { CheckIcon } from "@proto/ui/lib/icons";

function Questionnaire({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Root>) {
  return (
    <QuestionnairePrimitive.Root
      data-slot="questionnaire"
      className={cn(
        "defaults:flex defaults:w-full defaults:min-w-0 defaults:flex-col defaults:gap-4",
        className
      )}
      {...props}
    />
  );
}

function QuestionnaireProgress({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Progress>) {
  return (
    <QuestionnairePrimitive.Progress
      data-slot="questionnaire-progress"
      className={cn(
        "defaults:min-h-[1lh] defaults:w-fit defaults:min-w-[14ch] defaults:text-xs defaults:font-medium defaults:text-muted-foreground defaults:tabular-nums",
        className
      )}
      {...props}
    />
  );
}

function QuestionnaireItem({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Item>) {
  return (
    <QuestionnairePrimitive.Item
      data-slot="questionnaire-item"
      className={cn(
        "defaults:flex defaults:min-w-0 defaults:flex-col defaults:gap-4 defaults:border-0 defaults:p-0 defaults:outline-none",
        className
      )}
      {...props}
    />
  );
}

function QuestionnaireTitle({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Title>) {
  return (
    <QuestionnairePrimitive.Title
      data-slot="questionnaire-title"
      className={cn(
        "defaults:font-heading defaults:text-base defaults:leading-snug defaults:font-medium defaults:text-pretty defaults:[&:not(:has(~[data-slot=questionnaire-description]))]:mb-4",
        className
      )}
      {...props}
    />
  );
}

function QuestionnaireDescription({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Description>) {
  return (
    <QuestionnairePrimitive.Description
      data-slot="questionnaire-description"
      className={cn(
        "defaults:text-sm defaults:text-pretty defaults:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function QuestionnaireChoices({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Choices>) {
  return (
    <QuestionnairePrimitive.Choices
      data-slot="questionnaire-choices"
      className={cn(
        "group/questionnaire-choices defaults:grid defaults:min-w-0 defaults:gap-2",
        className
      )}
      {...props}
    />
  );
}

function QuestionnaireChoice({
  children,
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Choice>) {
  return (
    <QuestionnairePrimitive.Choice
      data-slot="questionnaire-choice"
      className={cn(
        "group/questionnaire-choice defaults:relative defaults:flex defaults:min-h-11 defaults:cursor-pointer defaults:items-start defaults:gap-2.5 defaults:rounded-lg defaults:border defaults:border-input defaults:bg-transparent defaults:px-3 defaults:py-2.5 defaults:text-start defaults:text-sm defaults:transition-colors defaults:outline-none defaults:select-none defaults:hover:bg-muted/50 defaults:has-[>input:focus-visible]:border-ring defaults:has-[>input:focus-visible]:ring-3 defaults:has-[>input:focus-visible]:ring-ring/50 defaults:data-invalid:border-destructive defaults:dark:bg-input/20 defaults:data-checked:border-primary/40 defaults:data-checked:bg-muted defaults:dark:data-checked:bg-muted",
        "defaults:data-disabled:pointer-events-none defaults:data-disabled:cursor-not-allowed defaults:data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <QuestionnairePrimitive.ChoiceInput
        data-slot="questionnaire-choice-input"
        className="defaults:absolute defaults:inset-0 defaults:z-10 defaults:size-full defaults:cursor-pointer defaults:opacity-0"
      />
      <span
        aria-hidden="true"
        data-slot="questionnaire-choice-indicator"
        className="defaults:pointer-events-none defaults:relative defaults:flex defaults:size-4 defaults:shrink-0 defaults:translate-y-[--spacing(0.45)] defaults:items-center defaults:justify-center defaults:rounded-[4px] defaults:border defaults:border-input defaults:group-has-data-[slot=questionnaire-choice-description]/questionnaire-choice:translate-y-0.5 defaults:group-data-[type=radio]/questionnaire-choice:rounded-full defaults:group-data-checked/questionnaire-choice:border-primary defaults:group-data-checked/questionnaire-choice:bg-primary defaults:group-data-checked/questionnaire-choice:text-primary-foreground defaults:dark:bg-input/30 defaults:dark:group-data-checked/questionnaire-choice:bg-primary"
      >
        <span
          data-slot="questionnaire-choice-indicator-dot"
          className="defaults:hidden defaults:size-2 defaults:rounded-full defaults:bg-primary-foreground defaults:group-data-[type=checkbox]/questionnaire-choice:hidden defaults:group-data-checked/questionnaire-choice:block"
        />
        <CheckIcon
          data-slot="questionnaire-choice-indicator-check"
          className="defaults:hidden defaults:size-3.5 defaults:group-data-[type=radio]/questionnaire-choice:hidden defaults:group-data-checked/questionnaire-choice:block"
        />
      </span>
      <QuestionnairePrimitive.ChoiceLabel
        data-slot="questionnaire-choice-label"
        className="defaults:flex defaults:min-w-0 defaults:flex-1 defaults:flex-col defaults:gap-0.5 defaults:leading-snug"
      >
        {children}
      </QuestionnairePrimitive.ChoiceLabel>
      <QuestionnairePrimitive.ChoiceShortcut
        data-slot="questionnaire-choice-shortcut"
        className="defaults:pointer-events-none defaults:ms-auto defaults:hidden defaults:size-5 defaults:shrink-0 defaults:translate-y-[--spacing(0.45)] defaults:items-center defaults:justify-center defaults:rounded-md defaults:border defaults:border-input defaults:bg-background defaults:font-mono defaults:text-[0.625rem] defaults:leading-none defaults:font-medium defaults:text-muted-foreground defaults:group-has-data-[slot=questionnaire-choice-description]/questionnaire-choice:translate-y-0.5 defaults:group-data-[shortcut]/questionnaire-choice:inline-flex"
      />
    </QuestionnairePrimitive.Choice>
  );
}

function QuestionnaireChoiceDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="questionnaire-choice-description"
      className={cn("defaults:text-muted-foreground", className)}
      {...props}
    />
  );
}

function QuestionnaireInput({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Input>) {
  return (
    <div
      data-slot="questionnaire-input-wrapper"
      className="group/questionnaire-input defaults:relative defaults:w-full defaults:min-w-0"
    >
      <QuestionnairePrimitive.Input
        data-slot="questionnaire-input"
        className={cn(
          "defaults:h-8 defaults:min-h-11 defaults:w-full defaults:min-w-0 defaults:rounded-lg defaults:border defaults:border-input defaults:bg-transparent defaults:px-2.5 defaults:py-1 defaults:text-base defaults:transition-[color,box-shadow,background-color] defaults:outline-none defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:disabled:pointer-events-none defaults:disabled:cursor-not-allowed defaults:disabled:bg-input/50 defaults:disabled:opacity-50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:sm:min-h-0 defaults:md:text-sm defaults:dark:bg-input/30 defaults:dark:disabled:bg-input/80 defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40",
          "defaults:selection:bg-primary defaults:selection:text-primary-foreground defaults:placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
    </div>
  );
}

function QuestionnaireError({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Error>) {
  return (
    <QuestionnairePrimitive.Error
      data-slot="questionnaire-error"
      className={cn("defaults:mt-2 defaults:text-sm defaults:text-destructive", className)}
      {...props}
    />
  );
}

function QuestionnaireActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="questionnaire-actions"
      className={cn(
        "defaults:grid defaults:min-h-11 defaults:w-full defaults:grid-cols-[minmax(0,1fr)_auto_auto] defaults:items-center defaults:gap-2 defaults:sm:min-h-8",
        className
      )}
      {...props}
    />
  );
}

function QuestionnairePrevious({
  children,
  className,
  size = "default",
  variant = "outline",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Previous> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <QuestionnairePrimitive.Previous
      data-slot="questionnaire-previous"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "defaults:col-start-1 defaults:row-start-1 defaults:min-h-11 defaults:justify-self-start defaults:sm:min-h-0",
        className
      )}
      {...props}
    >
      {children ?? "Previous"}
    </QuestionnairePrimitive.Previous>
  );
}

function QuestionnaireSkip({
  children,
  className,
  size = "default",
  variant = "outline",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Skip> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <QuestionnairePrimitive.Skip
      data-slot="questionnaire-skip"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "defaults:col-start-2 defaults:row-start-1 defaults:min-h-11 defaults:justify-self-end defaults:sm:min-h-0",
        className
      )}
      {...props}
    >
      {children ?? "Skip"}
    </QuestionnairePrimitive.Skip>
  );
}

function QuestionnaireNext({
  children,
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Next> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <QuestionnairePrimitive.Next
      data-slot="questionnaire-next"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "defaults:col-start-3 defaults:row-start-1 defaults:min-h-11 defaults:justify-self-end defaults:sm:min-h-0",
        className
      )}
      {...props}
    >
      {children ?? "Next"}
    </QuestionnairePrimitive.Next>
  );
}

function QuestionnaireSubmit({
  children,
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Submit> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <QuestionnairePrimitive.Submit
      data-slot="questionnaire-submit"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "defaults:col-start-3 defaults:row-start-1 defaults:min-h-11 defaults:justify-self-end defaults:sm:min-h-0",
        className
      )}
      {...props}
    >
      {children ?? "Submit"}
    </QuestionnairePrimitive.Submit>
  );
}

export {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
};
