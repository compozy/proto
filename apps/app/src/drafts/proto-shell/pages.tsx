import { Badge } from "@proto/ui/components/badge";
import { Button } from "@proto/ui/components/button";
import { BookOpen, Copy, Layers, Plus, Sparkles, Terminal } from "@proto/ui/lib/icons";

import { app, drafts, previewUrl } from "./data";
import { FitPreview } from "./preview";

function Command({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
      <span className="text-primary">$</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <Copy className="size-3.5 shrink-0 text-muted-foreground" />
    </div>
  );
}

/** Drafts: free-markup explorations, each one a step away from a component prototype. */
export function Drafts() {
  return (
    <div className="shell-dots min-h-0 flex-1 overflow-y-auto px-5 py-6 xl:px-8 xl:py-7">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              Drafts
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight xl:text-xl">
              2 drafts · free markup
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map(item => (
            <article
              key={item.title}
              className="overflow-hidden rounded-2xl border border-border bg-[var(--shell-panel)]"
            >
              <div className="border-b border-border">
                <FitPreview src={previewUrl(item.slug, item.state)} title={item.title} />
              </div>
              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-semibold">{item.title}</h3>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    src/drafts/{item.title.toLowerCase().replace(/ /g, "-")} · {item.states} states
                    · {item.updated}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 font-mono text-[10px] uppercase">
                  Draft
                </Badge>
              </div>
            </article>
          ))}
          <article className="flex min-h-[260px] flex-col justify-center gap-3 rounded-2xl border border-dashed border-border p-5">
            <span className="grid size-9 place-items-center rounded-lg bg-[var(--shell-primary-soft)] text-primary">
              <Plus className="size-4" />
            </span>
            <h3 className="text-[14px] font-semibold">New draft</h3>
            <Command>proto new pricing-page --draft</Command>
          </article>
        </div>
      </div>
    </div>
  );
}

/** First run: no prototypes discovered yet. */
export function EmptyGallery() {
  return (
    <div className="shell-dots grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-[520px] rounded-2xl border border-border bg-[var(--shell-panel)] p-7">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--shell-primary-soft)] text-primary">
          <Sparkles className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">No prototypes yet</h2>
        <ol className="mt-5 flex flex-col gap-4 text-[13px]">
          <li className="flex flex-col gap-2">
            <span>
              <span className="mr-2 font-mono text-[11px] text-primary">01</span>Start a draft with
              free markup
            </span>
            <Command>proto new welcome --draft</Command>
          </li>
          <li className="flex flex-col gap-2">
            <span>
              <span className="mr-2 font-mono text-[11px] text-primary">02</span>Or prototype a view
              you already have
            </span>
            <Command>proto new --in src/components/login-form.tsx</Command>
          </li>
        </ol>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--tone-end)]" />
            Watching src/**/*.proto.tsx
          </span>
          <Button variant="outline" size="sm">
            <BookOpen data-icon="inline-start" />
            Docs
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Deployed gallery with remote review: who may read and comment. */
export function SignInPage() {
  return (
    <div className="proto-shell h-svh min-h-[640px] w-full">
      <div className="shell-dots grid h-full place-items-center p-6">
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl border border-border bg-[var(--shell-panel)] p-7 shadow-2xl">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Layers className="size-5" />
            </div>
            <h1 className="mt-5 text-lg font-semibold tracking-tight">
              Sign in to review {app.name} prototypes
            </h1>
            <Button className="mt-6 h-10 w-full font-semibold">Continue to Acme sign-in</Button>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Agents and the CLI use credentials from Settings → Credentials.
            </p>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <Terminal className="size-3" />
            proto.acme.com · @compozy/proto 0.4.0
          </p>
        </div>
      </div>
    </div>
  );
}
