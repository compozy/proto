import { Avatar, AvatarFallback } from "@proto/ui/components/avatar";
import { Button } from "@proto/ui/components/button";
import { Kbd } from "@proto/ui/components/kbd";
import { Tabs, TabsList, TabsTrigger } from "@proto/ui/components/tabs";
import { Textarea } from "@proto/ui/components/textarea";
import {
  ArrowRight,
  Bot,
  CircleCheck,
  Code,
  CornerDownRight,
  ExternalLink,
  Layers,
  MessageSquarePlus,
  Paperclip,
  Send,
  X,
} from "@proto/ui/lib/icons";
import { cn } from "@proto/ui/lib/utils";
import type { ReactNode } from "react";

import { comments, flow, kindLabel, previewUrl, type ShellComment } from "./data";
import { FitPreview } from "./preview";

export type InspectorTab = "step" | "comments" | "source";

/** Right panel frame: identity header, tabs and a sticky footer, after the reference inspector. */
export function Inspector({
  title,
  eyebrow,
  tab,
  tabs,
  footer,
  children,
}: {
  title: string;
  eyebrow: string;
  tab: InspectorTab;
  tabs: { id: InspectorTab; label: string; count?: number }[];
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-[var(--shell-panel)] lg:flex xl:w-[340px] 2xl:w-[360px]">
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="grid size-9 place-items-center rounded-lg border border-border bg-background text-primary">
          <Layers className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-tight">{title}</div>
          <div className="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            {eyebrow}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close panel"
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
      <Tabs value={tab} className="mt-4">
        <TabsList
          variant="line"
          className="h-9 w-full justify-start gap-5 border-b border-border px-5"
        >
          {tabs.map(item => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="flex-none px-0 text-[13px] after:!bg-primary data-active:text-foreground"
            >
              {item.label}
              {item.count !== undefined && (
                <span className="rounded-full bg-[var(--shell-primary-soft)] px-1.5 font-mono text-[10px] text-primary">
                  {item.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex gap-2 border-t border-border p-4">{footer}</div>}
    </aside>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Step tab: the live state, where it sits in the product and how people reach it. */
export function StepPanel({ stepId }: { stepId: string }) {
  const step = flow.steps.find(item => item.id === stepId);
  if (!step) return null;
  const title = (id: string) => flow.steps.find(item => item.id === id)?.title ?? id;
  const incoming = flow.links.filter(link => link.to === step.id);
  const outgoing = flow.links.filter(link => link.from === step.id);
  return (
    <>
      {step.proto && step.state && (
        <Section title="Preview" aside="960 · follows theme">
          <div className="overflow-hidden rounded-lg border border-border">
            <FitPreview
              src={previewUrl(step.proto, step.state)}
              title={`${step.title} preview`}
              width={960}
              height={600}
            />
          </div>
        </Section>
      )}
      <Section title="Screen">
        <dl className="grid grid-cols-[88px_1fr] gap-y-2 rounded-lg border border-border bg-background p-3 text-[13px]">
          <dt className="text-muted-foreground">Prototype</dt>
          <dd className="font-mono text-xs">{step.proto} · A1</dd>
          <dt className="text-muted-foreground">Route</dt>
          <dd className="font-mono text-xs">{step.route}</dd>
          <dt className="text-muted-foreground">State</dt>
          <dd className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            {step.title}
          </dd>
        </dl>
      </Section>
      <Section title="Arrives from" aside={`${incoming.length}`}>
        <Transitions
          direction="in"
          items={incoming.map(link => ({ on: link.on, step: title(link.from), kind: link.kind }))}
        />
      </Section>
      <Section title="Leads to" aside={`${outgoing.length}`}>
        <Transitions
          direction="out"
          items={outgoing.map(link => ({ on: link.on, step: title(link.to), kind: link.kind }))}
        />
      </Section>
    </>
  );
}

function Transitions({
  items,
  direction,
}: {
  items: { on: string; step: string; kind: string }[];
  direction: "in" | "out";
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map(item => (
        <li
          key={`${item.on}-${item.step}`}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
        >
          {direction === "in" && <span className="truncate font-medium">{item.step}</span>}
          <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
            {item.on}
            <ArrowRight className="size-3" />
          </span>
          {direction === "out" && <span className="truncate font-medium">{item.step}</span>}
          <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-muted-foreground uppercase xl:inline">
            {
              kindLabel[
                item.kind === "overlay"
                  ? "overlay"
                  : item.kind === "redirect"
                    ? "redirect"
                    : "screen"
              ]
            }
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Comments tab: open threads of the state, newest first, with the pin and the source line. */
export function CommentsPanel({ state, active }: { state?: string; active?: number }) {
  const visible = comments.filter(item => !item.resolved && (!state || item.state === state));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Tabs value="open">
          <TabsList className="h-7 rounded-md">
            <TabsTrigger value="open" className="px-2.5 text-xs">
              Open · {visible.length}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="px-2.5 text-xs">
              Resolved · 1
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-[11px] text-muted-foreground">
          {state ? "This state" : "All states"}
        </span>
      </div>
      {visible.map(item => (
        <CommentCard key={item.id} comment={item} active={item.id === active} />
      ))}
      <div className="grid place-items-center rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
        <span>
          Press <Kbd className="mx-1 align-middle">C</Kbd> and click the screen to pin a comment
        </span>
      </div>
    </div>
  );
}

function Author({
  name,
  initials,
  role,
}: {
  name: string;
  initials: string;
  role: "reviewer" | "agent";
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-5">
        <AvatarFallback
          className={cn(
            "text-[9px] font-semibold",
            role === "agent"
              ? "bg-[var(--shell-primary-soft)] text-primary"
              : "bg-muted text-foreground"
          )}
        >
          {role === "agent" ? <Bot className="size-3" /> : initials}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-[13px] font-medium">{name}</span>
    </span>
  );
}

export function CommentCard({
  comment,
  active = false,
}: {
  comment: ShellComment;
  active?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-background p-3",
        active && "border-primary/60 shadow-[0_0_0_3px_var(--shell-primary-soft)]"
      )}
    >
      <header className="flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
          {comment.id}
        </span>
        <Author name={comment.author} initials={comment.initials} role={comment.role} />
        <span className="ml-auto shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
          {comment.at}
        </span>
      </header>
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{comment.text}</p>
      {comment.source && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
          <Code className="size-3" />
          {comment.source}
        </span>
      )}
      {comment.replies?.map(reply => (
        <div key={reply.text} className="mt-3 border-l-2 border-primary/40 pl-3">
          <div className="flex items-center gap-2">
            <CornerDownRight className="size-3 text-muted-foreground" />
            <Author name={reply.author} initials={reply.initials} role={reply.role} />
            <span className="ml-auto shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
              {reply.at}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85">{reply.text}</p>
        </div>
      ))}
      {active && (
        <div className="mt-3 flex flex-col gap-2">
          <Textarea
            placeholder="Reply…"
            className="min-h-16 resize-none bg-[var(--shell-panel)] text-[13px]"
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" aria-label="Attach image">
              <Paperclip />
            </Button>
            <Button variant="outline" size="xs" className="ml-auto">
              <CircleCheck data-icon="inline-start" />
              Resolve
            </Button>
            <Button size="xs" className="font-semibold">
              <Send data-icon="inline-start" />
              Reply
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

export function StepFooter() {
  return (
    <>
      <Button variant="outline" className="h-9 flex-1">
        <ExternalLink data-icon="inline-start" />
        Open screen
      </Button>
      <Button className="h-9 flex-1 font-semibold">
        <MessageSquarePlus data-icon="inline-start" />
        Comment
      </Button>
    </>
  );
}
