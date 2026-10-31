/** S2 Overview, S14 first run, and the Flows / Screens / Drafts indexes (S12). */
import type { RegistryPrototype } from "../../model/registry";
import { CommandLine, JourneyRow, ScreenCard, SectionTitle } from "../app/cards";
import { Eyebrow } from "../app/chrome";
import { Link } from "../app/link";
import { Preview } from "../frames/preview";
import { useT } from "../lib/i18n";
import {
  groupRegistry,
  padNumber,
  specTitle,
  stateCount,
  type SpecGroup,
} from "../lib/registry-model";
import { useRegistry, useShellData } from "../lib/shell-data";
import { Plus, Sparkles } from "../ui/icons";

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell-dots min-h-0 flex-1 overflow-y-auto px-5 py-6 xl:px-8 xl:py-7">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9">{children}</div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="-mb-4 flex items-end justify-between gap-4">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1 text-lg font-semibold tracking-tight xl:text-xl">{title}</h1>
      </div>
      {aside}
    </div>
  );
}

/** Overview: every spec as a live card, its journeys, then unsorted prototypes and drafts. */
export function Overview({ theme }: { theme: "light" | "dark" }) {
  const t = useT();
  const registry = useRegistry();
  if (!registry.prototypes.length) return <EmptyGallery />;
  const groups = groupRegistry(registry);
  const specs = groups.specs.filter(group => group.prototypes.length || group.flows.length);
  return (
    <Page>
      <PageHeading
        eyebrow={t("overview.eyebrow")}
        title={t("overview.summary", {
          specs: t("count.specs", { count: specs.length }),
          flows: t("count.flows", { count: registry.flows.length }),
          screens: t("count.screens", { count: registry.prototypes.length }),
        })}
        aside={
          <Link
            to={{ area: "drafts" }}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-[13px] font-medium hover:bg-muted"
          >
            <Plus className="size-4" />
            {t("drafts.new")}
          </Link>
        }
      />
      {specs.length > 0 && (
        <section aria-labelledby="overview-specs">
          <h2 id="overview-specs" className="sr-only">
            {t("overview.specs")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {specs.map((group, index) => (
              <SpecCard key={group.id} group={group} index={index} theme={theme} />
            ))}
          </div>
        </section>
      )}
      {registry.flows.length > 0 && (
        <section>
          <SectionTitle title={t("overview.journeys")} count={registry.flows.length} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {registry.flows.map(flow => (
              <JourneyRow
                key={flow.id}
                flow={flow}
                specLabel={flow.spec ? specTitle(registry, flow.spec) : undefined}
              />
            ))}
          </div>
        </section>
      )}
      <PrototypeGroup title={t("overview.unsorted")} prototypes={groups.unsorted} theme={theme} />
      <PrototypeGroup title={t("overview.drafts")} prototypes={groups.drafts} theme={theme} />
    </Page>
  );
}

function SpecCard({
  group,
  index,
  theme,
}: {
  group: SpecGroup;
  index: number;
  theme: "light" | "dark";
}) {
  const t = useT();
  const cover = group.prototypes[0];
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-[var(--shell-panel)] transition-colors focus-within:border-primary/60 hover:border-primary/50">
      <div className="relative border-b border-border">
        {cover ? (
          <Preview
            target={{ slug: cover.slug, state: cover.states[0].id, theme, role: null }}
            title={t("preview.of", { title: group.title })}
            order={index}
          />
        ) : (
          <div className="aspect-[1280/800]" />
        )}
        <span className="absolute top-2.5 left-2.5 rounded-md bg-background/85 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
          {padNumber(index + 1)} · {group.id}
        </span>
      </div>
      <div className="p-4">
        <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">
          <Link
            to={{ area: "spec", spec: group.id }}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {group.title}
          </Link>
        </h3>
        <div className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground">
          {[
            t("count.flows", { count: group.flows.length }),
            t("count.screens", { count: group.prototypes.length }),
            t("count.states", { count: stateCount(group.prototypes) }),
          ].join(" · ")}
        </div>
      </div>
    </article>
  );
}

function PrototypeGroup({
  title,
  prototypes,
  theme,
}: {
  title: string;
  prototypes: RegistryPrototype[];
  theme: "light" | "dark";
}) {
  if (!prototypes.length) return null;
  return (
    <section>
      <SectionTitle title={title} count={prototypes.length} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {prototypes.map((prototype, index) => (
          <ScreenCard
            key={prototype.slug}
            prototype={prototype}
            theme={theme}
            order={100 + index}
          />
        ))}
      </div>
    </section>
  );
}

/** Flows area index: every journey. */
export function FlowsIndex() {
  const t = useT();
  const registry = useRegistry();
  return (
    <Page>
      <PageHeading
        eyebrow={t("rail.flows")}
        title={t("count.flows", { count: registry.flows.length })}
      />
      {registry.flows.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {registry.flows.map(flow => (
            <JourneyRow
              key={flow.id}
              flow={flow}
              specLabel={flow.spec ? specTitle(registry, flow.spec) : undefined}
            />
          ))}
        </div>
      ) : (
        <Hint title={t("flows.none")} command="proto flow new <id>" />
      )}
    </Page>
  );
}

/** Screens area index: every prototype, grouped like the overview. */
export function ScreensIndex({ theme }: { theme: "light" | "dark" }) {
  const t = useT();
  const registry = useRegistry();
  if (!registry.prototypes.length) return <EmptyGallery />;
  const groups = groupRegistry(registry);
  return (
    <Page>
      <PageHeading
        eyebrow={t("rail.screens")}
        title={t("count.screens", { count: registry.prototypes.length })}
      />
      {groups.specs.map(group => (
        <PrototypeGroup
          key={group.id}
          title={group.title}
          prototypes={group.prototypes}
          theme={theme}
        />
      ))}
      <PrototypeGroup title={t("overview.unsorted")} prototypes={groups.unsorted} theme={theme} />
      <PrototypeGroup title={t("overview.drafts")} prototypes={groups.drafts} theme={theme} />
    </Page>
  );
}

/** S12 Drafts: free-markup explorations and how to start one. */
export function Drafts({ theme }: { theme: "light" | "dark" }) {
  const t = useT();
  const registry = useRegistry();
  const drafts = registry.prototypes.filter(item => item.kind === "draft");
  return (
    <Page>
      <PageHeading eyebrow={t("rail.drafts")} title={t("count.drafts", { count: drafts.length })} />
      <h2 className="sr-only">{t("overview.drafts")}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {drafts.map((draft, index) => (
          <ScreenCard
            key={draft.slug}
            prototype={draft}
            theme={theme}
            order={index}
            showStates={false}
          />
        ))}
        <article className="flex min-h-[220px] flex-col justify-center gap-3 rounded-2xl border border-dashed border-border p-5">
          <span className="grid size-9 place-items-center rounded-lg bg-[var(--shell-primary-soft)] text-primary">
            <Plus className="size-4" />
          </span>
          <h3 className="text-[14px] font-semibold">{t("drafts.new")}</h3>
          <CommandLine command="proto new <slug> --draft" />
        </article>
      </div>
    </Page>
  );
}

function Hint({ title, command }: { title: string; command: string }) {
  return (
    <div className="flex max-w-[520px] flex-col gap-3 rounded-2xl border border-dashed border-border p-5">
      <p className="text-[13px] text-muted-foreground">{title}</p>
      <CommandLine command={command} />
    </div>
  );
}

/** S14 first run: no prototypes discovered yet. */
export function EmptyGallery() {
  const t = useT();
  const { bootstrap } = useShellData();
  return (
    <div className="shell-dots grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-[520px] rounded-2xl border border-border bg-[var(--shell-panel)] p-7">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--shell-primary-soft)] text-primary">
          <Sparkles className="size-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">{t("empty.title")}</h1>
        <ol className="mt-5 flex flex-col gap-4 text-[13px]">
          <li className="flex flex-col gap-2">
            <span>
              <span className="mr-2 font-mono text-[11px] text-primary">01</span>
              {t("empty.draft")}
            </span>
            <CommandLine command="proto new welcome --draft" />
          </li>
          <li className="flex flex-col gap-2">
            <span>
              <span className="mr-2 font-mono text-[11px] text-primary">02</span>
              {t("empty.component")}
            </span>
            <CommandLine command="proto new --in src/components/login-form.tsx" />
          </li>
        </ol>
        {bootstrap.eventsUrl && (
          <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--tone-end)]" />
            {t("empty.watching")}
          </div>
        )}
      </div>
    </div>
  );
}
