/**
 * S1 shell frame (`_uiux.md`): icon rail, top bar, sub-header, the inspector frame and the
 * in-shell modal, after the `proto-shell` draft (`apps/app/src/drafts/proto-shell/shell.tsx`).
 */
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { useT, type Translate } from "../lib/i18n";
import { setTheme } from "../lib/navigation";
import { useShellData } from "../lib/shell-data";
import { nextTheme } from "../lib/theme";
import { areaOf, type View } from "../lib/view";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Check,
  Clock,
  Eye,
  Layers,
  LayoutGrid,
  Link as LinkIcon,
  Monitor,
  Moon,
  PanelRight,
  Search,
  Settings,
  Sparkles,
  Sun,
  TriangleAlert,
  Workflow,
  X,
} from "../ui/icons";
import { Kbd, KbdGroup } from "../ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../ui/utils";
import { Link } from "./link";
import { useSlots, type InspectorTab, type ReviewTarget } from "./slots";

type RailItem = { area: string; label: string; icon: typeof LayoutGrid; to: View };

function railItems(t: Translate): RailItem[] {
  return [
    { area: "overview", label: t("rail.overview"), icon: LayoutGrid, to: { area: "overview" } },
    { area: "flows", label: t("rail.flows"), icon: Workflow, to: { area: "flows" } },
    { area: "screens", label: t("rail.screens"), icon: Monitor, to: { area: "screens" } },
    { area: "drafts", label: t("rail.drafts"), icon: Sparkles, to: { area: "drafts" } },
  ];
}

const railButton =
  "relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const railActive =
  "bg-[var(--shell-primary-soft)] text-primary hover:bg-[var(--shell-primary-soft)] hover:text-primary";

/** Icon rail: areas of the gallery, the app mark on top and the signed-in reviewer at the bottom. */
export function ShellRail({ view }: { view: View }) {
  const t = useT();
  const { bootstrap } = useShellData();
  const active = areaOf(view);
  const principal = bootstrap.principal;
  return (
    <nav
      aria-label={t("rail.label")}
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-[var(--shell-rail)] py-3"
    >
      <Link
        to={{ area: "overview" }}
        aria-label={bootstrap.title}
        className="mb-3 grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
      >
        <Layers className="size-4" />
      </Link>
      {railItems(t).map(item => (
        <Link
          key={item.area}
          to={item.to}
          aria-label={item.label}
          title={item.label}
          aria-current={item.area === active ? "page" : undefined}
          className={cn(railButton, item.area === active && railActive)}
        >
          <item.icon className="size-4" />
        </Link>
      ))}
      <div className="my-2 h-px w-6 bg-border" />
      <Link
        to={{ area: "settings", section: "health" }}
        aria-label={t("rail.settings")}
        title={t("rail.settings")}
        aria-current={active === "settings" ? "page" : undefined}
        className={cn(railButton, active === "settings" && railActive)}
      >
        <Settings className="size-4" />
      </Link>
      {principal && (
        <Avatar className="mt-auto size-7" title={principal.name}>
          <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">
            {initials(principal.name)}
          </AvatarFallback>
        </Avatar>
      )}
    </nav>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");
}

export type Crumb = { label: string; to?: View };

/** Top bar: where am I, global search and the review actions of the open item. */
export function ShellTopBar({
  crumbs,
  problems,
  target,
  share = false,
  onSearch,
}: {
  crumbs: Crumb[];
  problems: number;
  target: ReviewTarget | null;
  /** Share belongs to an open prototype or flow, not to areas such as Settings. */
  share?: boolean;
  onSearch: () => void;
}) {
  const t = useT();
  const { bootstrap } = useShellData();
  const slots = useSlots();
  const all: Crumb[] = [{ label: bootstrap.title, to: { area: "overview" } }, ...crumbs];
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 xl:px-5">
      <nav aria-label={t("topbar.breadcrumbs")} className="flex min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-[13px] whitespace-nowrap">
          {all.map((crumb, index) => {
            const last = index === all.length - 1;
            return (
              <li
                key={`${crumb.label}-${index}`}
                className={cn(
                  "flex min-w-0 items-center gap-1.5",
                  last ? "shrink" : "shrink-0",
                  index > 0 && index < all.length - 2 && "hidden xl:flex"
                )}
              >
                {index > 0 && (
                  <span aria-hidden="true" className="text-muted-foreground/60">
                    /
                  </span>
                )}
                {crumb.to && !last ? (
                  <Link
                    to={crumb.to}
                    className="truncate text-muted-foreground hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={cn(
                      "truncate",
                      last ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <button
        type="button"
        onClick={onSearch}
        aria-label={t("topbar.search")}
        aria-keyshortcuts="Meta+K Control+K /"
        className="flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-[var(--shell-panel)] text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary lg:w-[clamp(14rem,28vw,26rem)] lg:shrink lg:justify-start lg:px-2.5"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden flex-1 truncate text-left lg:inline">
          {t("topbar.searchPlaceholder")}
        </span>
        <KbdGroup className="hidden lg:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </button>
      <div className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap">
        {problems > 0 && (
          <Link
            to={{ area: "settings", section: "health" }}
            aria-label={t("topbar.problems", { count: problems })}
            className="flex h-8 items-center gap-1.5 rounded-full bg-destructive/12 px-3 text-[13px] font-medium text-destructive tabular-nums"
          >
            <TriangleAlert className="size-3.5" />
            {problems}
            <span className="max-xl:hidden">{t("topbar.problemsWord", { count: problems })}</span>
          </Link>
        )}
        {bootstrap.mode === "read-only" && (
          <span className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] text-muted-foreground">
            <Eye className="size-3.5" />
            {t("topbar.readOnly")}
          </span>
        )}
        {slots.reviewActions?.(target)}
        {share && <ShareButton />}
      </div>
    </header>
  );
}

function ShareButton() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const share = () => {
    void navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true));
  };
  return (
    <Button
      variant="outline"
      aria-label={copied ? t("common.copied") : t("topbar.share")}
      onClick={share}
      className="h-8 rounded-full max-xl:w-8 max-xl:px-0"
    >
      {copied ? <Check data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
      <span className="hidden xl:inline">{copied ? t("common.copied") : t("topbar.share")}</span>
      <span role="status" className="sr-only">
        {copied ? t("topbar.linkCopied") : ""}
      </span>
    </Button>
  );
}

export type ViewTab = "flow" | "screen" | "compare";

/** Second bar: the open item, its review status, the view switch, theme and panel toggles. */
export function ShellSubHeader({
  title,
  status,
  meta,
  view,
  views,
  onView,
  theme,
  panel,
}: {
  title: string;
  status?: ReactNode;
  meta?: string;
  view?: ViewTab;
  /** Views that exist for the open item (Flow only when the state is in a flow). */
  views?: ViewTab[];
  onView?: (view: ViewTab) => void;
  theme: "light" | "dark";
  /** The inspector toggle: always on narrow layouts, and once the inspector was closed. */
  panel?: { open: boolean; onToggle: () => void };
}) {
  const t = useT();
  const labels: Record<ViewTab, string> = {
    flow: t("views.flow"),
    screen: t("views.screens"),
    compare: t("views.compare"),
  };
  return (
    <div className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border px-4 xl:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{title}</h1>
        {status}
        {meta && (
          <span className="hidden min-w-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground 2xl:flex">
            <Clock className="size-3 shrink-0" />
            <span className="truncate">{meta}</span>
          </span>
        )}
      </div>
      {view && views ? (
        <Tabs value={view} onValueChange={value => onView?.(value as ViewTab)}>
          <TabsList
            aria-label={t("views.label")}
            className="h-8 rounded-lg border border-border bg-[var(--shell-panel)]"
          >
            {(["flow", "screen", "compare"] as const).map(item => (
              <TabsTrigger
                key={item}
                value={item}
                disabled={!views.includes(item)}
                className="px-3 text-[13px] xl:px-4"
              >
                {labels[item]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : (
        <span />
      )}
      <div className="flex min-w-0 items-center justify-end gap-1 text-muted-foreground">
        {panel && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={panel.open ? t("inspector.close") : t("inspector.open")}
            aria-pressed={panel.open}
            onClick={panel.onToggle}
          >
            <PanelRight />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
          aria-keyshortcuts="T"
          onClick={() => setTheme(nextTheme(theme))}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </div>
    </div>
  );
}

/** The shell frame: skip link, rail, and the area column. */
export function Shell({ view, children }: { view: View; children: ReactNode }) {
  const t = useT();
  return (
    <div className="relative flex h-svh min-h-[560px] w-full overflow-hidden text-sm">
      <a
        href="#shell-main"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-16"
      >
        {t("shell.skip")}
      </a>
      <ShellRail view={view} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/**
 * Modal scoped to the shell: dims the shell, traps nothing it does not own, closes on Esc and
 * on backdrop click, returns focus to where it was.
 */
export function ShellModal({
  label,
  onClose,
  width = 440,
  align = "center",
  children,
}: {
  label: string;
  onClose: () => void;
  width?: number;
  align?: "center" | "top";
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(
      "input, button, [href], [tabindex]:not([tabindex='-1'])"
    );
    (first ?? panel.current)?.focus();
    return () => previous?.focus?.();
  }, []);
  const keep = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = [
      ...panel.current.querySelectorAll<HTMLElement>(
        "input, button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])"
      ),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-background/65 p-6 backdrop-blur-[2px]",
        align === "center" ? "items-center" : "items-start pt-[12vh]"
      )}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={keep}
        className="w-full rounded-2xl border border-border bg-[var(--shell-panel)] shadow-2xl outline-none"
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Right panel: identity header, tabs and a sticky footer. Below 1024 px it is a drawer over the
 * canvas, opened from the sub-header toggle (S20).
 */
export function Inspector({
  title,
  eyebrow,
  tabs,
  tab,
  onTab,
  footer,
  open,
  onClose,
}: {
  title: string;
  eyebrow: string;
  tabs: InspectorTab[];
  tab: string;
  onTab: (tab: string) => void;
  footer?: ReactNode;
  open: { wide: boolean; narrow: boolean };
  onClose: () => void;
}) {
  const t = useT();
  const active = tabs.some(item => item.id === tab) ? tab : (tabs[0]?.id ?? "");
  return (
    <section
      aria-label={t("inspector.label")}
      onKeyDown={event => {
        if (event.key === "Escape" && open.narrow) onClose();
      }}
      className={cn(
        "w-[300px] shrink-0 flex-col border-l border-border bg-[var(--shell-panel)] xl:w-[340px] 2xl:w-[360px]",
        open.narrow
          ? "absolute top-0 right-0 bottom-0 z-30 flex w-[min(360px,90%)] shadow-[-24px_0_60px_-20px_oklch(0_0_0/0.6)] lg:static lg:shadow-none"
          : "hidden",
        open.wide ? "lg:flex" : "lg:hidden"
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background text-primary">
          <Layers className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
          <div className="mt-0.5 truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            {eyebrow}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("inspector.close")}
          className="text-muted-foreground"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <Tabs
        value={active}
        onValueChange={value => onTab(String(value))}
        className="mt-4 min-h-0 flex-1 gap-0"
      >
        <TabsList
          variant="line"
          className="h-9 w-full shrink-0 justify-start gap-5 border-b border-border px-5"
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
        {tabs.map(item => (
          <TabsPrimitive.Panel
            key={item.id}
            value={item.id}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4 outline-none"
          >
            {item.content}
          </TabsPrimitive.Panel>
        ))}
      </Tabs>
      {footer && <div className="flex gap-2 border-t border-border p-4">{footer}</div>}
    </section>
  );
}

const narrowQuery = "(max-width: 1023.98px)";

function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia(narrowQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Inspector open state: wide layouts show it until closed; narrow layouts (< 1024 px, S20) hide
 * it and open it as a drawer from the sub-header toggle.
 */
export function useInspector() {
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(narrowQuery).matches
  );
  const [wide, setWide] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const toggle = () => (narrow ? setDrawer(value => !value) : setWide(value => !value));
  return {
    open: { wide, narrow: drawer },
    close: () => (narrow ? setDrawer(false) : setWide(false)),
    /** The sub-header toggle: always on narrow layouts, on wide ones once the panel was closed. */
    panel: narrow || !wide ? { open: narrow ? drawer : wide, onToggle: toggle } : undefined,
  };
}

/** A titled block of inspector content. */
export function Section({
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
        {aside !== undefined && <span className="text-[11px] text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Mono uppercase eyebrow label above a page heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </div>
  );
}

/** A definition list of facts in a bordered box (inspector). */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-y-2 rounded-lg border border-border bg-background p-3 text-[13px]">
      {children}
    </dl>
  );
}

export function Fact({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 truncate", mono && "font-mono text-xs")}>{children}</dd>
    </>
  );
}

/** The selected state marker used in facts. */
export function StateDot({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
      {children}
    </span>
  );
}
