/**
 * Settings area. This slice ships the Health section (S15: problems and warnings with codes and
 * files); Project, Review, Credentials and About (S17) join it with the review slice.
 */
import { useState } from "react";

import type { RegistryProblem, RegistryWarning } from "../../model/registry";
import { Link } from "../app/link";
import { useT } from "../lib/i18n";
import { useRegistry } from "../lib/shell-data";
import { Button } from "../ui/button";
import { Check, CircleCheck, Copy, ShieldCheck, TriangleAlert } from "../ui/icons";
import { cn } from "../ui/utils";

export function Settings() {
  const t = useT();
  const registry = useRegistry();
  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label={t("settings.label")}
        className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-border p-3 max-md:w-14 max-md:items-center"
      >
        <Link
          to={{ area: "settings", section: "health" }}
          aria-current="page"
          className="flex h-8 items-center gap-2.5 rounded-lg bg-[var(--shell-primary-soft)] px-2.5 text-[13px] text-foreground max-md:w-9 max-md:justify-center max-md:px-0"
        >
          <ShieldCheck className="size-4 shrink-0 text-primary" />
          <span className="max-md:hidden">{t("settings.health")}</span>
          {registry.problems.length > 0 && (
            <span className="ml-auto rounded-full bg-destructive/12 px-1.5 font-mono text-[10px] text-destructive max-md:hidden">
              {registry.problems.length}
            </span>
          )}
        </Link>
      </nav>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6 xl:px-10">
        <div className="mx-auto max-w-[760px]">
          <Health />
        </div>
      </div>
    </div>
  );
}

type Entry = { severity: "problem" | "warning"; item: RegistryProblem | RegistryWarning };

function location(item: RegistryProblem | RegistryWarning) {
  if (!item.file) return null;
  const line =
    "line" in item && item.line ? `:${item.line}${item.column ? `:${item.column}` : ""}` : "";
  return `${item.file}${line}`;
}

function Health() {
  const t = useT();
  const registry = useRegistry();
  const entries: Entry[] = [
    ...registry.problems.map(item => ({ severity: "problem" as const, item })),
    ...registry.warnings.map(item => ({ severity: "warning" as const, item })),
  ];
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">{t("settings.health")}</h1>
        <span className="font-mono text-xs text-muted-foreground">
          {t("count.problems", { count: registry.problems.length })} ·{" "}
          {t("count.warnings", { count: registry.warnings.length })}
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-[var(--shell-panel)] p-4 text-[13px]">
          <CircleCheck className="size-4 text-[var(--tone-end)]" />
          {t("health.clean")}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry, index) => (
            <HealthItem key={`${entry.item.code}-${index}`} entry={entry} />
          ))}
        </ul>
      )}
      <p className="mt-4 font-mono text-[11px] text-muted-foreground">{t("health.cli")}</p>
    </>
  );
}

function HealthItem({ entry }: { entry: Entry }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const { item, severity } = entry;
  const path = location(item);
  const tone = severity === "problem" ? "text-destructive" : "text-[var(--tone-warning)]";
  return (
    <li
      className={cn(
        "rounded-xl border bg-[var(--shell-panel)] p-4",
        severity === "problem" ? "border-destructive/35" : "border-border"
      )}
    >
      <div className="flex items-center gap-2">
        <TriangleAlert className={cn("size-4 shrink-0", tone)} aria-hidden="true" />
        <span className={cn("font-mono text-[11px] tracking-wide uppercase", tone)}>
          <span className="sr-only">
            {t(severity === "problem" ? "health.problem" : "health.warning")}:{" "}
          </span>
          {item.code}
        </span>
        {path && (
          <Button
            variant="ghost"
            size="xs"
            className="ml-auto text-muted-foreground"
            onClick={() => void navigator.clipboard?.writeText(path).then(() => setCopied(true))}
          >
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? t("common.copied") : t("health.copyPath")}
          </Button>
        )}
      </div>
      <p className="mt-2 text-[13px]">{item.message}</p>
      {path && <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{path}</p>}
    </li>
  );
}
