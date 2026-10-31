import { Badge } from "@proto/ui/components/badge";
import { Button } from "@proto/ui/components/button";
import { Input } from "@proto/ui/components/input";
import {
  CircleCheck,
  Copy,
  FileCode,
  Globe,
  Info,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "@proto/ui/lib/icons";
import { cn } from "@proto/ui/lib/utils";
import type { ReactNode } from "react";

import { app, credentials, problems } from "./data";

export type SettingsSection = "project" | "review" | "credentials" | "health" | "about";

const sections: { id: SettingsSection; label: string; icon: typeof Info }[] = [
  { id: "project", label: "Project", icon: FileCode },
  { id: "review", label: "Review", icon: Globe },
  { id: "credentials", label: "Credentials", icon: KeyRound },
  { id: "health", label: "Health", icon: ShieldCheck },
  { id: "about", label: "About", icon: Info },
];

/** Settings: read-only project config, review mode, credentials, health and version. */
export function Settings({ section }: { section: SettingsSection }) {
  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label="Settings"
        className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-border p-3 max-md:w-14 max-md:items-center"
      >
        {sections.map(item => (
          <button
            key={item.id}
            type="button"
            aria-current={item.id === section ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground max-md:w-9 max-md:justify-center max-md:px-0",
              item.id === section &&
                "bg-[var(--shell-primary-soft)] text-foreground hover:bg-[var(--shell-primary-soft)]"
            )}
          >
            <item.icon className={cn("size-4 shrink-0", item.id === section && "text-primary")} />
            <span className="max-md:hidden">{item.label}</span>
            {item.id === "health" && (
              <span className="ml-auto rounded-full bg-destructive/12 px-1.5 font-mono text-[10px] text-destructive max-md:hidden">
                2
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6 xl:px-10">
        <div className="mx-auto max-w-[760px]">
          {section === "credentials" && <Credentials />}
          {section === "health" && <Health />}
          {section === "project" && <Project />}
        </div>
      </div>
    </div>
  );
}

function Header({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {aside}
    </div>
  );
}

function Credentials() {
  return (
    <>
      <Header
        title="Credentials"
        aside={
          <Button className="h-8 shrink-0 rounded-full font-semibold">
            <Plus data-icon="inline-start" />
            New credential
          </Button>
        }
      />
      <div className="mb-5 rounded-xl border border-primary/40 bg-[var(--shell-primary-soft)] p-4">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <CircleCheck className="size-4 text-primary" />
          "codex-ci" created · copy the token now, it is shown once
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            readOnly
            value="pcr_3b1f9e07c2d84a6f91b0e5d2a7c4f813"
            className="font-mono text-xs"
          />
          <Button variant="outline" className="shrink-0">
            <Copy data-icon="inline-start" />
            Copy
          </Button>
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          proto auth login --remote https://proto.acme.com
        </p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-[var(--shell-panel)]">
        {credentials.map(item => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <KeyRound className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{item.name}</div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {item.id} · last used {item.lastUsed}
              </div>
            </div>
            <div className="hidden gap-1 sm:flex">
              {item.scopes.map(scope => (
                <Badge
                  key={scope}
                  variant={scope === "review" ? "primary-light" : "outline"}
                  className="font-mono text-[10px]"
                >
                  {scope}
                </Badge>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Revoke ${item.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Credentials are for the CLI and agents: they read, reply and resolve as agents. Approval
        happens here, in the browser.
      </p>
    </>
  );
}

function Health() {
  return (
    <>
      <Header
        title="Health"
        aside={
          <span className="font-mono text-xs text-muted-foreground">2 problems · 1 warning</span>
        }
      />
      <ul className="flex flex-col gap-2">
        {problems.map(item => (
          <li
            key={item.code + item.file}
            className={cn(
              "rounded-xl border bg-[var(--shell-panel)] p-4",
              item.severity === "problem" ? "border-destructive/35" : "border-border"
            )}
          >
            <div className="flex items-center gap-2">
              <TriangleAlert
                className={cn(
                  "size-4 shrink-0",
                  item.severity === "problem" ? "text-destructive" : "text-[var(--tone-warning)]"
                )}
              />
              <span
                className={cn(
                  "font-mono text-[11px] tracking-wide uppercase",
                  item.severity === "problem" ? "text-destructive" : "text-[var(--tone-warning)]"
                )}
              >
                {item.code}
              </span>
              <Button variant="ghost" size="xs" className="ml-auto text-muted-foreground">
                <Copy data-icon="inline-start" />
                Path
              </Button>
            </div>
            <p className="mt-2 text-[13px]">{item.message}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              {item.file}
              {item.line ? `:${item.line}` : ""}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[11px] text-muted-foreground">
        Run proto check --json for the same list.
      </p>
    </>
  );
}

function Project() {
  const rows = [
    ["Title", app.name],
    ["Prototypes", "src/**/*.proto.tsx"],
    ["Drafts", "src/drafts"],
    ["Flows", "flows"],
    ["Canvas", "proto.canvas.tsx"],
    ["Specs", "auth · onboarding · billing"],
    ["Roles", "member · admin"],
  ];
  return (
    <>
      <Header
        title="Project"
        aside={<span className="font-mono text-xs text-muted-foreground">proto.config.ts</span>}
      />
      <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-[var(--shell-panel)]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[120px_1fr] gap-4 px-4 py-2.5 text-[13px]">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate font-mono text-xs">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
