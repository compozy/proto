import { Avatar, AvatarFallback } from "@proto/ui/components/avatar";
import { Button } from "@proto/ui/components/button";
import { ArrowUpRight, Bot, MessageSquare, Plus, Workflow } from "@proto/ui/lib/icons";
import { cn } from "@proto/ui/lib/utils";

import { comments, flow, specs } from "./data";
import { FitPreview } from "./preview";
import { StatusPill } from "./shell";

/** Overview: every spec as a live card, then what needs review across the app. */
export function Overview() {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="shell-dots min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-6 xl:px-8 xl:py-7">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                Specs
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight xl:text-xl">
                3 specs · 4 flows · 9 screens
              </h2>
            </div>
            <Button variant="outline" className="h-8 shrink-0 rounded-full">
              <Plus data-icon="inline-start" />
              New draft
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {specs.map((spec, index) => (
              <article
                key={spec.id}
                className={cn(
                  "group overflow-hidden rounded-2xl border border-border bg-[var(--shell-panel)] transition-colors hover:border-primary/50",
                  index === 0 && "border-primary/60 shadow-[0_0_0_4px_var(--shell-primary-soft)]"
                )}
              >
                <div className="relative border-b border-border">
                  <FitPreview src={spec.preview} title={`${spec.title} preview`} />
                  <span className="absolute top-2.5 left-2.5 rounded-md bg-background/85 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
                    {String(index + 1).padStart(2, "0")} · {spec.id}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">
                      {spec.title}
                    </h3>
                    <StatusPill open={spec.open} approved={spec.approved} />
                  </div>
                  <div className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground">
                    {spec.flows} flows · {spec.screens} screens · {spec.states} states
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {["PN", "AL"].slice(0, spec.open > 0 ? 2 : 1).map(initials => (
                        <Avatar key={initials} className="size-6">
                          <AvatarFallback className="bg-muted text-[9px] font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="truncate text-[11px] text-muted-foreground">
                      Updated {spec.updated}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-9 mb-3 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            Journeys
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              { title: flow.title, spec: "Authentication", steps: 6, warn: 1 },
              { title: "First report", spec: "Onboarding", steps: 9, warn: 0 },
            ].map(item => (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-xl border border-border bg-[var(--shell-panel)] px-4 py-3"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-[var(--shell-primary-soft)] text-primary">
                  <Workflow className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{item.title}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {item.spec} · {item.steps} steps
                    {item.warn > 0 && (
                      <span className="text-[var(--tone-warning)]"> · {item.warn} uncovered</span>
                    )}
                  </div>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-[var(--shell-panel)] lg:flex xl:w-[340px]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Needs review</h2>
          <span className="font-mono text-[11px] text-muted-foreground">4 open</span>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto px-5 pb-5">
          {comments
            .filter(item => !item.resolved)
            .map(item => (
              <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="grid size-4.5 place-items-center rounded-full bg-primary font-mono text-[9px] font-semibold text-primary-foreground">
                    {item.id}
                  </span>
                  <span className="truncate font-mono">login-form · {item.state}</span>
                  <span className="ml-auto shrink-0">{item.at}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed">{item.text}</p>
                {item.replies?.length ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-primary">
                    <Bot className="size-3" />
                    Agent replied · waiting for you
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MessageSquare className="size-3" />
                    No replies yet
                  </div>
                )}
              </div>
            ))}
        </div>
      </aside>
    </div>
  );
}
