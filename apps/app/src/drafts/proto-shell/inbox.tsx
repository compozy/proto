import { Avatar, AvatarFallback } from "@proto/ui/components/avatar";
import { Button } from "@proto/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@proto/ui/components/tabs";
import { Bot, ExternalLink, Filter, Monitor, Workflow } from "@proto/ui/lib/icons";
import { cn } from "@proto/ui/lib/utils";

import { inbox, previewUrl } from "./data";
import { CommentCard } from "./inspector";
import { FitPreview } from "./preview";

/** Comments inbox: every open thread across screens and flows, then the selected one in context. */
export function Inbox({ selected = 0 }: { selected?: number }) {
  const active = inbox[selected];
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-full max-w-[420px] min-w-0 shrink-0 flex-col border-r border-border bg-[var(--shell-panel)] max-md:max-w-none">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Tabs value="open" className="min-w-0 flex-1">
            <TabsList className="h-8 w-full rounded-lg">
              <TabsTrigger value="open" className="text-xs">
                Open · {inbox.length}
              </TabsTrigger>
              <TabsTrigger value="waiting" className="text-xs">
                Waiting · 2
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">
                Resolved
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon-sm" aria-label="Filter">
            <Filter />
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {inbox.map((item, index) => {
            const waiting = item.comment.replies?.at(-1)?.role === "agent";
            return (
              <li key={`${item.key}-${item.comment.id}`}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full gap-3 rounded-xl px-3 py-3 text-left hover:bg-accent",
                    index === selected &&
                      "bg-[var(--shell-primary-soft)] hover:bg-[var(--shell-primary-soft)]"
                  )}
                >
                  <Avatar className="mt-0.5 size-7 shrink-0">
                    <AvatarFallback className="bg-muted text-[10px] font-semibold">
                      {item.comment.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {item.kind === "flow" ? (
                        <Workflow className="size-3 shrink-0" />
                      ) : (
                        <Monitor className="size-3 shrink-0" />
                      )}
                      <span className="truncate font-mono">
                        {item.key} · #{item.comment.id} · {item.comment.state}
                      </span>
                      <span className="ml-auto shrink-0 whitespace-nowrap">{item.comment.at}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[13px] leading-snug">
                      {item.comment.text}
                    </span>
                    {waiting && (
                      <span className="mt-1.5 flex items-center gap-1 text-[11px] text-primary">
                        <Bot className="size-3" />
                        {item.comment.replies?.at(-1)?.author} replied · waiting for you
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {active && (
        <div className="shell-dots hidden min-h-0 min-w-0 flex-1 flex-col md:flex">
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/60 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{active.title}</div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {active.spec} · {active.comment.state}
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0">
              <ExternalLink data-icon="inline-start" />
              Open in context
            </Button>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <FitPreview
              src={previewUrl(
                active.key.startsWith("flow-") ? "login-form" : active.key,
                active.comment.state
              )}
              title={active.title}
              width={1024}
              height={640}
              frameClassName="shell-frame rounded-xl"
              overlay={
                active.comment.pin && (
                  <span
                    className="shell-pin absolute grid size-6 -translate-y-full place-items-center rounded-full rounded-bl-none bg-primary font-mono text-[11px] font-semibold text-primary-foreground"
                    style={{ left: `${active.comment.pin.x}%`, top: `${active.comment.pin.y}%` }}
                  >
                    {active.comment.id}
                  </span>
                )
              }
            />
            <div className="min-w-0">
              <CommentCard comment={active.comment} active />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
