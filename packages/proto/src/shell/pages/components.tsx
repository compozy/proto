/**
 * The Components area, minimal (spec slice 1): story roots and their component files from
 * `registry.stories`, a component's stories as thumbnails (never `play`), and a story in its
 * own story frame with `play` and Replay. The virtualized tree, component page and story page
 * of `_uiux.md` S2–S4 replace these pieces; frames always go through `useRenderFrame`.
 */
import { useState } from "react";

import type { RenderMessage } from "../../model/protocol";
import type { Registry, RegistryStory, RegistryStoryFile } from "../../model/registry";
import { Link } from "../app/link";
import { Preview } from "../frames/preview";
import { ScreenFrame } from "../frames/screen-frame";
import { useT } from "../lib/i18n";
import { useRegistry } from "../lib/shell-data";
import { componentView, type Width } from "../lib/view";
import { Button } from "../ui/button";
import { RotateCcw } from "../ui/icons";
import { cn } from "../ui/utils";

type StoryStatusMessage = Extract<RenderMessage, { type: "story:status" }>;

const noSlugs: ReadonlySet<string> = new Set();

/** Story files grouped by root, in registry root order, each sorted by title. */
export function storyGroups(registry: Registry) {
  const files = registry.stories ?? [];
  return (registry.storyRoots ?? []).map(root => ({
    root,
    files: files
      .filter(file => file.root === root.id)
      .sort((a, b) => a.title.localeCompare(b.title)),
  }));
}

/**
 * `file` null is the area itself (`?components`); `story` null is the component (`?c=<slug>`).
 * The caller resolves unknown slugs and story ids to its not-found page.
 */
export function ComponentsPage({
  file,
  story,
  width,
  theme,
}: {
  file: RegistryStoryFile | null;
  story: RegistryStory | null;
  width: Width;
  theme: "light" | "dark";
}) {
  const t = useT();
  const registry = useRegistry();
  const groups = storyGroups(registry);
  const empty = groups.every(group => group.files.length === 0);
  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label={t("rail.components")}
        className="w-72 shrink-0 overflow-y-auto border-r border-border bg-[var(--shell-panel)] p-3"
      >
        {groups.map(group => (
          <section key={group.root.id} className="mb-4">
            <h2 className="px-2 pb-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              {group.root.title}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {group.files.map(item => (
                <li key={item.slug}>
                  <Link
                    to={componentView(item.slug)}
                    aria-current={item.slug === file?.slug && !story ? "page" : undefined}
                    className={cn(
                      "block truncate rounded-md px-2 py-1 text-[13px] hover:bg-muted",
                      item.slug === file?.slug && "font-semibold text-primary"
                    )}
                  >
                    {item.title}
                  </Link>
                  {item.slug === file?.slug && (
                    <ul className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
                      {item.stories.map(entry => (
                        <li key={entry.id}>
                          <Link
                            to={componentView(item.slug, entry.id)}
                            aria-current={entry.id === story?.id ? "page" : undefined}
                            className={cn(
                              "block truncate rounded-md px-2 py-0.5 text-[12px] hover:bg-muted",
                              entry.id === story?.id && "bg-muted font-medium"
                            )}
                          >
                            {entry.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {file && story ? (
          <StoryView key={story.id} file={file} story={story} width={width} theme={theme} />
        ) : file ? (
          <ComponentView file={file} theme={theme} />
        ) : (
          <div className="shell-dots grid flex-1 place-items-center p-6">
            <p className="text-[13px] text-muted-foreground">
              {empty ? t("components.empty") : t("components.pick")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** A component file: its description, path and one `play`-free thumbnail per story. */
function ComponentView({ file, theme }: { file: RegistryStoryFile; theme: "light" | "dark" }) {
  const t = useT();
  const count = t("count.stories", { count: file.stories.length });
  const meta = [t("components.file"), file.file, count].join(" · ");
  return (
    <div className="shell-dots min-h-0 flex-1 overflow-y-auto px-5 py-6 xl:px-8">
      <h1 className="text-[18px] font-semibold">{file.title}</h1>
      {file.description && (
        <p className="mt-2 max-w-[720px] text-[13px] whitespace-pre-line text-muted-foreground">
          {file.description}
        </p>
      )}
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {meta}
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {file.stories.map((story, index) => (
          <article
            key={story.id}
            className="group relative overflow-hidden rounded-2xl border border-border bg-[var(--shell-panel)] hover:border-primary/50"
          >
            <div className="border-b border-border">
              <Preview
                target={{
                  kind: "story",
                  root: file.root,
                  slug: file.slug,
                  story: story.id,
                  theme,
                }}
                title={t("preview.of", { title: story.name })}
                order={index}
              />
            </div>
            <h2 className="truncate p-3 text-[13px] font-semibold">
              <Link
                to={componentView(file.slug, story.id)}
                className="outline-none after:absolute after:inset-0 after:content-['']"
              >
                {story.name}
              </Link>
            </h2>
          </article>
        ))}
      </div>
    </div>
  );
}

/**
 * One story in a story frame that runs `play`. Replay loads a fresh document (new nonce), so
 * results of the replaced document are stale. The status shows only what the host reported:
 * nothing for a story without `play` unless it failed.
 */
function StoryView({
  file,
  story,
  width,
  theme,
}: {
  file: RegistryStoryFile;
  story: RegistryStory;
  width: Width;
  theme: "light" | "dark";
}) {
  const t = useT();
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<StoryStatusMessage | null>(null);
  const replay = () => {
    setResult(null);
    setRun(current => current + 1);
  };
  const label = !result
    ? null
    : result.status === "failed"
      ? [t("story.failed", { stage: result.stage }), result.error].filter(Boolean).join(": ")
      : t(result.status === "passed" ? "story.passed" : "story.running");
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
        <h1 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {file.title} · {story.name}
        </h1>
        {result && label && (result.hasPlay === true || result.status === "failed") && (
          <span
            role="status"
            className={cn(
              "max-w-[50%] truncate text-[12px]",
              result.status === "failed" && "text-destructive",
              result.status === "passed" && "text-[var(--tone-end)]",
              result.status === "running" && "text-muted-foreground"
            )}
            title={result.error ?? undefined}
          >
            {label}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={replay}>
          <RotateCcw data-icon="inline-start" />
          {t("story.replay")}
        </Button>
      </div>
      <ScreenFrame
        key={run}
        target={{
          kind: "story",
          root: file.root,
          slug: file.slug,
          story: story.id,
          theme,
          play: true,
        }}
        width={width}
        title={`${file.title} · ${story.name}`}
        slugs={noSlugs}
        className="flex-1 p-4"
        onMessage={message => {
          if (message.type !== "story:status" || message.story !== story.id) return;
          // One terminal result per document: a later report never replaces it.
          setResult(current => (current && current.status !== "running" ? current : message));
        }}
      />
    </>
  );
}
