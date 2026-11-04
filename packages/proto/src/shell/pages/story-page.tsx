/**
 * S4 Story page, modeled on the screen page: one story in its story frame with `play`, the
 * theme, compare and viewport controls, and an inspector with Stories (siblings), Comments and
 * Source. The play status shows only what the story host reported (`StoryResult`): a chip with
 * Replay exists only when the host says the story has `play`; the registry `play` flag is a
 * listing hint and never drives it. Controls, Docs and Accessibility tabs do not exist in v1.
 */
import type { RegistryStory, RegistryStoryFile } from "../../model/registry";
import { storyKey } from "../../model/registry";
import {
  Fact,
  Facts,
  Inspector,
  Section,
  ShellSubHeader,
  useFocusedTab,
  useInspector,
} from "../app/chrome";
import { Link } from "../app/link";
import { useSlots, type FrameReviewTarget, type InspectorTab } from "../app/slots";
import { ScreenFrame } from "../frames/screen-frame";
import type { RenderFrameHandle } from "../frames/use-render-frame";
import { useT } from "../lib/i18n";
import { go } from "../lib/navigation";
import { useRegistry, useShellEvent } from "../lib/shell-data";
import { useShortcuts } from "../lib/shortcuts";
import { hasModuleMocks } from "../lib/story-tree";
import { componentView, type View } from "../lib/view";
import { CopyablePath, ThemeLabel } from "../screen/inspector-parts";
import { ViewportControl } from "../screen/viewport-control";
import { Button } from "../ui/button";
import { CircleCheck, Columns2, Info, RotateCcw, TriangleAlert } from "../ui/icons";
import { cn } from "../ui/utils";

type ComponentView = Extract<View, { area: "component" }>;

const noSlugs: ReadonlySet<string> = new Set();

export function StoryPage({
  view,
  theme,
  file,
  story,
}: {
  view: ComponentView;
  theme: "light" | "dark";
  file: RegistryStoryFile;
  story: RegistryStory;
}) {
  const t = useT();
  const registry = useRegistry();
  const slots = useSlots();
  const inspector = useInspector();
  const [tab, setTab] = useFocusedTab(view.comment, "stories");
  const target: FrameReviewTarget = {
    kind: "story",
    key: storyKey(file.slug),
    slug: file.slug,
    story: story.id,
  };
  const frameSlot = slots.screenFrame?.(target);
  const update = (patch: Partial<ComponentView>, options?: { replace?: boolean }) =>
    go({ ...view, ...patch }, options);
  const position = file.stories.indexOf(story);
  const step = (delta: number) => {
    const next = file.stories[position + delta];
    if (next) update({ story: next.id, comment: null });
  };
  // Stories have no Flow or Screens mode: compare is a light/dark toggle on the canvas (S4).
  const setCompare = (compare: boolean) => update({ compare });
  useShortcuts({
    j: () => step(-1),
    k: () => step(1),
    "2": () => setCompare(false),
    "3": () => setCompare(true),
  });
  const frameTarget = {
    kind: "story",
    root: file.root,
    slug: file.slug,
    story: story.id,
    theme,
    play: true,
  } as const;
  /** Frames and their failure cards name the component too; the header names the story only. */
  const title = `${file.title} · ${story.name}`;
  const tabs: InspectorTab[] = [
    {
      id: "stories",
      label: t("inspector.stories"),
      count: file.stories.length,
      content: <StoriesPanel file={file} story={story} />,
    },
    ...(slots.inspectorTabs?.(target) ?? []),
    { id: "source", label: t("inspector.source"), content: <SourcePanel file={file} /> },
  ];

  return (
    <>
      <ShellSubHeader
        title={story.name}
        status={slots.reviewStatus?.(target)}
        meta={file.file}
        theme={theme}
        panel={inspector.panel}
        menu={slots.reviewMenu?.(target)}
      />
      <div className="relative flex min-h-0 flex-1">
        <section
          aria-label={t("screen.canvas")}
          className="shell-dots flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {hasModuleMocks(registry, file) && <MockNotice />}
          {view.compare ? (
            <>
              <div className="flex shrink-0 items-center justify-end gap-2 px-4 pt-4">
                <CompareToggle pressed onPressed={setCompare} />
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 px-6 py-5 xl:gap-8">
                {(["light", "dark"] as const).map(side => {
                  const width = view.width === "fit" ? 1440 : view.width;
                  return (
                    <div key={side} className="flex min-h-0 min-w-0 flex-col gap-2.5">
                      <ScreenFrame
                        target={{ ...frameTarget, theme: side }}
                        width={width}
                        title={`${title} · ${side}`}
                        slugs={noSlugs}
                        className="flex-1"
                        toolbar={(_, frame) => (
                          <ThemeLabel
                            theme={side}
                            aside={
                              <>
                                <PlayStatus frame={frame} />
                                {width}
                              </>
                            }
                          />
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <ScreenFrame
              target={frameTarget}
              width={view.width}
              title={title}
              slugs={noSlugs}
              onMessage={frameSlot?.onMessage}
              overlay={frameSlot?.overlay}
              toolbar={(geometry, frame) => (
                <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-4">
                  <PlayStatus frame={frame} />
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <CompareToggle pressed={false} onPressed={setCompare} />
                    <ViewportControl
                      width={view.width}
                      fitWidth={geometry.width}
                      onWidth={width => update({ width }, { replace: true })}
                    />
                    {slots.canvasTools?.(target)}
                  </div>
                </div>
              )}
              className="flex-1 px-6 pt-5 pb-2"
              caption={geometry => (
                <p className="shrink-0 pt-2 text-center font-mono text-[11px] text-muted-foreground tabular-nums">
                  {story.id} · {geometry.width} × {geometry.height}
                </p>
              )}
            />
          )}
        </section>
        <Inspector
          title={story.name}
          eyebrow={file.title}
          tabs={tabs}
          tab={tab}
          onTab={setTab}
          open={inspector.open}
          onClose={inspector.close}
        />
      </div>
    </>
  );
}

/**
 * The host's verdict for this document: Running, Passed, or Failed with the stage named. No chip
 * for a story without `play` unless it failed; Replay (a fresh document, so `play` runs again)
 * only when the host reported `hasPlay: true`. An edit reloads the story document in place and
 * its first report starts a new run (`useRenderFrame`), so a fixed story recovers without a shell
 * reload; as a fallback a failed frame also reloads when the registry changes.
 */
export function PlayStatus({ frame }: { frame: RenderFrameHandle }) {
  const t = useT();
  const { result } = frame;
  const failed = frame.status.kind === "error" || result?.status === "failed";
  useShellEvent("registry", () => {
    if (failed) frame.reload();
  });
  if (!result || (result.hasPlay !== true && result.status !== "failed")) return null;
  const label =
    result.status === "failed"
      ? t("story.failed", { stage: result.stage })
      : t(result.status === "passed" ? "story.passed" : "story.running");
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        role="status"
        aria-label={t("story.status")}
        title={result.error ?? undefined}
        data-status={result.status}
        className={cn(
          "flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2.5 font-sans text-xs",
          result.status === "running" && "border-border text-muted-foreground",
          result.status === "passed" &&
            "border-[color-mix(in_oklch,var(--tone-end)_40%,transparent)] text-[var(--tone-end)]",
          result.status === "failed" && "border-destructive/40 bg-destructive/10 text-destructive"
        )}
      >
        {result.status === "running" ? (
          <span
            aria-hidden="true"
            className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : result.status === "passed" ? (
          <CircleCheck className="size-3.5 shrink-0" />
        ) : (
          <TriangleAlert className="size-3.5 shrink-0" />
        )}
        <span className="shrink-0">{label}</span>
        {result.status === "failed" && result.error && (
          <span className="min-w-0 truncate">· {result.error}</span>
        )}
      </span>
      {result.hasPlay === true && (
        <Button variant="outline" size="sm" onClick={frame.reload}>
          <RotateCcw data-icon="inline-start" />
          {t("story.replay")}
        </Button>
      )}
    </span>
  );
}

/** Light and dark side by side (`compare=themes`), the story page's only view switch. */
function CompareToggle({
  pressed,
  onPressed,
}: {
  pressed: boolean;
  onPressed: (pressed: boolean) => void;
}) {
  const t = useT();
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      aria-keyshortcuts={pressed ? "2" : "3"}
      title={t("search.compare")}
      onClick={() => onPressed(!pressed)}
      className={cn(pressed && "bg-[var(--shell-primary-soft)] text-[var(--shell-primary-text)]")}
    >
      <Columns2 data-icon="inline-start" />
      {t("views.compare")}
    </Button>
  );
}

/** `sb.mock` / `mocked` in this story file: proto renders the real modules (US-007.EC-1). */
function MockNotice() {
  const t = useT();
  return (
    <div
      role="note"
      className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_oklch,var(--tone-warning)_40%,transparent)] bg-[var(--shell-panel)] px-3 py-2 text-[13px] text-[var(--tone-warning)]"
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-medium">{t("story.mockNotice")}</span>
        <span className="ml-1 text-muted-foreground">{t("story.mockDetail")}</span>
      </span>
    </div>
  );
}

/** Stories tab: the component's stories, the open one marked. */
function StoriesPanel({ file, story }: { file: RegistryStoryFile; story: RegistryStory }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {file.stories.map(item => (
        <li key={item.id}>
          <Link
            to={componentView(file.slug, item.id)}
            aria-current={item.id === story.id ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] hover:border-primary/50",
              item.id === story.id && "border-primary/50 bg-[var(--shell-primary-soft)]"
            )}
          >
            <span className="truncate font-medium">{item.name}</span>
            {item.exportName !== item.name && (
              <span className="ml-auto shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                {item.exportName}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Source tab: the story file and its root (path only in v1). */
function SourcePanel({ file }: { file: RegistryStoryFile }) {
  const t = useT();
  const registry = useRegistry();
  const root = registry.storyRoots?.find(item => item.id === file.root);
  return (
    <>
      <Section title={t("components.file")}>
        <CopyablePath path={file.file} />
      </Section>
      <Section title={t("components.root")}>
        <Facts>
          <Fact label={t("components.root")} mono>
            {root ? `${root.title} · ${root.id}` : file.root}
          </Fact>
        </Facts>
      </Section>
    </>
  );
}
