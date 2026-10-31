/**
 * S17 Settings: Project (read-only, from the registry — edit proto.config.ts), Review (mode and
 * principal from the bootstrap), Credentials (remote browser sessions only: list own, create —
 * always `comment`, "for CLI and agents", token shown once — revoke), Health, About.
 */
import { useEffect, useState, type ReactNode } from "react";

import packageJson from "../../../../package.json" with { type: "json" };
import { Fact, Facts } from "../../app/chrome";
import { CommandLine } from "../../app/cards";
import { Link } from "../../app/link";
import { useLocale, useT } from "../../lib/i18n";
import { useRegistry, useShellData } from "../../lib/shell-data";
import type { SettingsSection } from "../../lib/view";
import { Health } from "../../pages/health";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  CircleCheck,
  FileCode,
  Globe,
  Info,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from "../../ui/icons";
import { Input } from "../../ui/input";
import { cn } from "../../ui/utils";
import { isReviewApiError, type CreatedCredential, type Credential } from "../api";
import { useReviewData } from "../data";
import { relativeTime } from "../format";

const icons: Record<SettingsSection, typeof Info> = {
  project: FileCode,
  review: Globe,
  credentials: KeyRound,
  health: ShieldCheck,
  about: Info,
};

export function Settings({ section }: { section: SettingsSection }) {
  const t = useT();
  const registry = useRegistry();
  const review = useReviewData();
  const sections = (["project", "review", "credentials", "health", "about"] as const).filter(
    item => item !== "credentials" || review?.permissions.credentials
  );
  const current = sections.includes(section) ? section : "project";
  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label={t("settings.label")}
        className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-border p-3 max-md:w-14 max-md:items-center"
      >
        {sections.map(item => {
          const Icon = icons[item];
          return (
            <Link
              key={item}
              to={{ area: "settings", section: item }}
              aria-current={item === current ? "page" : undefined}
              aria-label={t(`settings.${item}`)}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground max-md:w-9 max-md:justify-center max-md:px-0",
                item === current &&
                  "bg-[var(--shell-primary-soft)] text-foreground hover:bg-[var(--shell-primary-soft)]"
              )}
            >
              <Icon className={cn("size-4 shrink-0", item === current && "text-primary")} />
              <span className="max-md:hidden">{t(`settings.${item}`)}</span>
              {item === "health" && registry.problems.length > 0 && (
                <span className="ml-auto rounded-full bg-destructive/12 px-1.5 font-mono text-[10px] text-destructive max-md:hidden">
                  {registry.problems.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6 xl:px-10">
        <div className="mx-auto max-w-[760px]">
          {current === "project" && <Project />}
          {current === "review" && <Review />}
          {current === "credentials" && <Credentials />}
          {current === "health" && <Health />}
          {current === "about" && <About />}
        </div>
      </div>
    </div>
  );
}

function Header({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {aside}
    </div>
  );
}

function Project() {
  const t = useT();
  const registry = useRegistry();
  const specs = Object.entries(registry.specs ?? {});
  const roles = Object.entries(registry.roles);
  return (
    <>
      <Header
        title={t("settings.project")}
        aside={<span className="font-mono text-xs text-muted-foreground">proto.config.ts</span>}
      />
      <Facts>
        <Fact label={t("settings.title")}>{registry.title}</Fact>
        <Fact label={t("settings.locale")} mono>
          {registry.locale}
        </Fact>
        <Fact label={t("settings.specs")} mono>
          {registry.specs === null
            ? t("settings.specsUnavailable")
            : specs.map(([id]) => id).join(" · ") || "—"}
        </Fact>
        <Fact label={t("settings.roles")} mono>
          {roles.map(([id]) => id).join(" · ") || "—"}
        </Fact>
        <Fact label={t("settings.siteUrl")} mono>
          {registry.siteUrl ?? "—"}
        </Fact>
        <Fact label={t("settings.prototypes")}>{registry.prototypes.length}</Fact>
        <Fact label={t("settings.flows")}>{registry.flows.length}</Fact>
      </Facts>
      <p className="mt-3 text-xs text-muted-foreground">{t("settings.editConfig")}</p>
    </>
  );
}

function Review() {
  const t = useT();
  const { bootstrap } = useShellData();
  const review = useReviewData();
  const principal = bootstrap.principal;
  const where =
    bootstrap.mode === "remote"
      ? new URL(".", document.baseURI).href
      : bootstrap.mode === "dev"
        ? t("settings.localFiles")
        : "—";
  return (
    <>
      <Header title={t("settings.review")} />
      <Facts>
        <Fact label={t("settings.mode")} mono>
          {bootstrap.mode}
        </Fact>
        <Fact label={t("settings.where")} mono>
          {where}
        </Fact>
        {bootstrap.mode === "read-only" && (
          <Fact label={t("settings.history")}>
            {bootstrap.reviewSnapshotBase
              ? t("settings.historyIncluded")
              : t("settings.historyExcluded")}
          </Fact>
        )}
        <Fact label={t("settings.principal")}>
          {principal
            ? `${principal.name} · ${t(`review.${principal.kind}`)}`
            : bootstrap.mode === "dev"
              ? t("settings.localReviewer")
              : "—"}
        </Fact>
        {principal && (
          <Fact label={t("settings.scopes")} mono>
            {principal.scopes.join(" · ")}
          </Fact>
        )}
        <Fact label={t("settings.canApprove")}>
          {review?.permissions.approve ? t("settings.yes") : t("settings.no")}
        </Fact>
      </Facts>
      {bootstrap.mode === "dev" && (
        <p className="mt-3 text-xs text-muted-foreground">{t("settings.trust")}</p>
      )}
    </>
  );
}

function Credentials() {
  const t = useT();
  const locale = useLocale();
  const review = useReviewData();
  const [list, setList] = useState<Credential[] | null>(null);
  const [created, setCreated] = useState<CreatedCredential | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const api = review?.api;
  useEffect(() => {
    if (!api) return;
    let current = true;
    api.listCredentials().then(
      value => {
        if (current) setList(value);
      },
      (failure: unknown) => {
        if (current) setError(isReviewApiError(failure) ? failure.message : String(failure));
      }
    );
    return () => {
      current = false;
    };
  }, [api, generation]);
  if (!api) return null;
  const create = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      setCreated(await api.createCredential(name.trim()));
      setName("");
      setGeneration(value => value + 1);
    } catch (failure) {
      setError(isReviewApiError(failure) ? failure.message : String(failure));
    }
  };
  const revoke = async (id: string) => {
    setError(null);
    try {
      await api.revokeCredential(id);
      setRevoking(null);
      setGeneration(value => value + 1);
    } catch (failure) {
      setError(isReviewApiError(failure) ? failure.message : String(failure));
    }
  };
  const remote = new URL(".", document.baseURI).href;
  return (
    <>
      <Header title={t("settings.credentials")} />
      <form
        className="mb-5 flex gap-2"
        onSubmit={event => {
          event.preventDefault();
          void create();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("credentials.name")}</span>
          <Input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t("credentials.namePlaceholder")}
          />
        </label>
        <Button
          type="submit"
          className="shrink-0 rounded-full font-semibold"
          disabled={!name.trim()}
        >
          <Plus data-icon="inline-start" />
          {t("credentials.new")}
        </Button>
      </form>
      {created && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-primary/40 bg-[var(--shell-primary-soft)] p-4"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <CircleCheck className="size-4 text-primary" />
            {t("credentials.created", { name: created.name })}
          </div>
          <div className="mt-3">
            <CommandLine command={created.token} />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            proto auth login --remote {remote}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mb-3 text-xs text-destructive">
          {error}
        </p>
      )}
      {list && list.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("credentials.none")}</p>
      )}
      {list && list.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-[var(--shell-panel)]">
          {list.map(item => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{item.name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {item.id}
                  {item.lastUsedAt
                    ? ` · ${t("credentials.lastUsed", { when: relativeTime(item.lastUsedAt, locale) })}`
                    : ` · ${t("credentials.unused")}`}
                </div>
              </div>
              <div className="hidden gap-1 sm:flex">
                {item.scopes.map(scope => (
                  <Badge key={scope} variant="outline" className="font-mono text-[10px]">
                    {scope}
                  </Badge>
                ))}
              </div>
              {revoking === item.id ? (
                <>
                  <Button variant="destructive" size="xs" onClick={() => void revoke(item.id)}>
                    {t("credentials.confirmRevoke")}
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => setRevoking(null)}>
                    {t("common.cancel")}
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("credentials.revoke", { name: item.name })}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setRevoking(item.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t("credentials.note")}</p>
    </>
  );
}

function About() {
  const t = useT();
  const { bootstrap } = useShellData();
  return (
    <>
      <Header title={t("settings.about")} />
      <Facts>
        <Fact label={t("settings.package")} mono>
          @compozy/proto {packageJson.version}
        </Fact>
        <Fact label={t("settings.commit")} mono>
          {bootstrap.commit ?? "—"}
        </Fact>
        <Fact label={t("settings.mode")} mono>
          {bootstrap.mode}
        </Fact>
      </Facts>
    </>
  );
}
