/** S15 Health: discovery, flow and guard problems and warnings with codes and files. */
import { useState } from "react";

import type { RegistryProblem, RegistryWarning } from "../../model/registry";
import { useT } from "../lib/i18n";
import { useRegistry } from "../lib/shell-data";
import { Button } from "../ui/button";
import { Check, CircleCheck, Copy, TriangleAlert } from "../ui/icons";
import { cn } from "../ui/utils";

type Entry = { severity: "problem" | "warning"; item: RegistryProblem | RegistryWarning };

function location(item: RegistryProblem | RegistryWarning) {
  if (!item.file) return null;
  const line =
    "line" in item && item.line ? `:${item.line}${item.column ? `:${item.column}` : ""}` : "";
  return `${item.file}${line}`;
}

export function Health() {
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
