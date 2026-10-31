// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@proto/ui/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "@proto/ui/lib/icons";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("defaults:flex defaults:w-full defaults:flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("defaults:not-last:border-b", className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="defaults:flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger defaults:relative defaults:flex defaults:flex-1 defaults:items-start defaults:justify-between defaults:rounded-lg defaults:border defaults:border-transparent defaults:py-2.5 defaults:text-left defaults:text-sm defaults:font-medium defaults:transition-all defaults:outline-none defaults:hover:underline defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:focus-visible:after:border-ring defaults:aria-disabled:pointer-events-none defaults:aria-disabled:opacity-50 defaults:**:data-[slot=accordion-trigger-icon]:ml-auto defaults:**:data-[slot=accordion-trigger-icon]:size-4 defaults:**:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          data-slot="accordion-trigger-icon"
          className="defaults:pointer-events-none defaults:shrink-0 defaults:group-aria-expanded/accordion-trigger:hidden"
        />
        <ChevronUpIcon
          data-slot="accordion-trigger-icon"
          className="defaults:pointer-events-none defaults:hidden defaults:shrink-0 defaults:group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="defaults:overflow-hidden defaults:text-sm defaults:data-open:animate-accordion-down defaults:data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "defaults:h-(--accordion-panel-height) defaults:pt-0 defaults:pb-2.5 defaults:data-ending-style:h-0 defaults:data-starting-style:h-0 defaults:[&_a]:underline defaults:[&_a]:underline-offset-3 defaults:[&_a]:hover:text-foreground defaults:[&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
