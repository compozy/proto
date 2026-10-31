/** S3 Spec page: the journeys and the screens of one spec. */
import { JourneyStrip, ScreenCard, SectionTitle } from "../app/cards";
import { useT } from "../lib/i18n";
import { flowsOfSpec } from "../lib/registry-model";
import { useRegistry } from "../lib/shell-data";
import { FileCode } from "../ui/icons";

export function SpecPage({ spec, theme }: { spec: string; theme: "light" | "dark" }) {
  const t = useT();
  const registry = useRegistry();
  const flows = flowsOfSpec(registry, spec);
  const prototypes = registry.prototypes.filter(item => item.spec === spec);
  return (
    <div className="shell-dots min-h-0 flex-1 overflow-y-auto px-5 py-6 xl:px-8 xl:py-7">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        {flows.length > 0 && (
          <section>
            <SectionTitle title={t("spec.journeys")} count={flows.length} />
            <div className="flex flex-col gap-4">
              {flows.map(flow => (
                <JourneyStrip key={flow.id} flow={flow} theme={theme} />
              ))}
            </div>
          </section>
        )}
        <section>
          <SectionTitle title={t("spec.screens")} count={prototypes.length} />
          {prototypes.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {prototypes.map((prototype, index) => (
                <ScreenCard
                  key={prototype.slug}
                  prototype={prototype}
                  theme={theme}
                  order={10 + index}
                />
              ))}
            </div>
          ) : (
            <div className="flex max-w-[520px] items-start gap-3 rounded-2xl border border-dashed border-border p-5 text-[13px]">
              <FileCode className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>
                {t("spec.empty")}{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  spec: "{spec}"
                </code>
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
