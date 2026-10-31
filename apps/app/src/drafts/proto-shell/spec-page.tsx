import { Badge } from "@proto/ui/components/badge";
import { ArrowUpRight, MessageSquare, TriangleAlert, Workflow } from "@proto/ui/lib/icons";
import { cn } from "@proto/ui/lib/utils";

import { flow, kindLabel, previewUrl, screens } from "./data";
import { FitPreview } from "./preview";

/** Spec page: the journeys and the screens of one spec, each with its review signal. */
export function SpecPage() {
  return (
    <div className="shell-dots min-h-0 flex-1 overflow-y-auto px-5 py-6 xl:px-8 xl:py-7">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <section>
          <SectionTitle title="Journeys" count={1} />
          <article className="overflow-hidden rounded-2xl border border-border bg-[var(--shell-panel)]">
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--shell-primary-soft)] text-primary">
                <Workflow className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[14px] font-semibold">{flow.title}</h3>
                <p className="truncate text-xs text-muted-foreground">{flow.description}</p>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 rounded-md bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)] px-2 py-1 text-[11px] text-[var(--tone-warning)] md:flex">
                <TriangleAlert className="size-3" />1 uncovered
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
            </header>
            <ol className="flex gap-2 overflow-x-auto p-4 [scrollbar-width:thin]">
              {flow.steps.map((step, index) => (
                <li key={step.id} className="flex shrink-0 items-center gap-2">
                  <div className="w-[168px] rounded-xl border border-border bg-background p-2">
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[9.5px] tracking-[0.08em] uppercase">
                      <span className="text-muted-foreground">
                        {String(index + 1).padStart(2, "0")} · {kindLabel[step.kind]}
                      </span>
                      {step.comments > 0 && <span className="text-primary">{step.comments}</span>}
                    </div>
                    {step.proto && step.state ? (
                      <div className="overflow-hidden rounded-md border border-border">
                        <FitPreview
                          src={previewUrl(step.proto, step.state)}
                          title={step.title}
                          width={720}
                          height={420}
                        />
                      </div>
                    ) : (
                      <div className="grid aspect-[720/420] place-items-center rounded-md border border-dashed border-border font-mono text-[10px] text-muted-foreground">
                        example.com
                      </div>
                    )}
                    <div className="mt-1.5 truncate text-xs font-medium">{step.title}</div>
                  </div>
                  {index < flow.steps.length - 1 && (
                    <span className="h-px w-3 bg-[var(--shell-edge)]" />
                  )}
                </li>
              ))}
            </ol>
          </article>
        </section>
        <section>
          <SectionTitle title="Screens" count={screens.length} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {screens.map((screen, index) => (
              <article
                key={screen.slug}
                className={cn(
                  "overflow-hidden rounded-2xl border border-border bg-[var(--shell-panel)]",
                  index === 0 && "border-primary/50"
                )}
              >
                <div className="border-b border-border">
                  <FitPreview
                    src={previewUrl(screen.slug, screen.states[0]?.id ?? "default")}
                    title={screen.title}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                      {screen.title}
                    </h3>
                    {screen.kind === "draft" && (
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px] uppercase">
                        Draft
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {screen.surface} · {screen.route} · {screen.slug}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {screen.states.map(state => (
                      <li
                        key={state.id}
                        className="flex h-6 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[11.5px] whitespace-nowrap"
                      >
                        {state.label}
                        {state.comments > 0 && (
                          <span className="flex items-center gap-0.5 font-mono text-[10px] text-primary">
                            <MessageSquare className="size-2.5" />
                            {state.comments}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
        {title}
      </h2>
      <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
    </div>
  );
}
