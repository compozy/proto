/**
 * The Components area (`_uiux.md` S2, S3): a windowed component tree by title next to the open
 * page (a prompt, a component page or a story page), and the component page with its
 * description and one `play`-free thumbnail per story. The tree keeps no history state: what is
 * open lives in the URL, and the tree expands to it.
 */
import { useState, type ReactNode } from "react";

import { storyKey, type RegistryStoryFile } from "../../model/registry";
import { ShellSubHeader } from "../app/chrome";
import { Link } from "../app/link";
import { useSlots, type ReviewTarget } from "../app/slots";
import { Preview } from "../frames/preview";
import { useT } from "../lib/i18n";
import { go } from "../lib/navigation";
import { useRegistry } from "../lib/shell-data";
import {
  buildStoryTree,
  initialExpanded,
  revealIds,
  storyDiagnostics,
  storyNodeId,
  visibleRows,
  type StoryTreeNode,
} from "../lib/story-tree";
import { componentView } from "../lib/view";
import { BookOpen, ChevronRight, Component, TriangleAlert } from "../ui/icons";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";
import { VirtualTree, type VirtualTreeItem } from "../ui/virtual-tree";

type TreeItem = VirtualTreeItem & { node: StoryTreeNode };

/**
 * The area layout: the tree on the left, `children` (the open page) on the right. `slug` and
 * `story` name what is open; the tree expands to it on first render and whenever it changes.
 */
export function ComponentsArea({
  slug,
  story,
  children,
}: {
  slug: string | null;
  story: string | null;
  children: ReactNode;
}) {
  const t = useT();
  const registry = useRegistry();
  const tree = buildStoryTree(registry);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set([...initialExpanded(tree), ...(slug ? revealIds(tree, slug) : [])])
  );
  // A deep link, another component or one of its stories: expand to it (adjusted during
  // render, no Effect). Collapsing the selected component keeps its destination, so it stays
  // collapsed until the user opens somewhere else.
  const [revealed, setRevealed] = useState({ slug, story });
  if (slug !== revealed.slug || story !== revealed.story) {
    setRevealed({ slug, story });
    if (slug) setExpanded(current => new Set([...current, ...revealIds(tree, slug)]));
  }
  const toggle = (id: string) =>
    setExpanded(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const items: TreeItem[] = visibleRows(tree, expanded).map(row => ({
    id: row.node.id,
    level: row.level,
    expanded: row.node.children.length ? row.expanded : null,
    parent: row.parent,
    position: row.position,
    size: row.size,
    node: row.node,
  }));
  const selected = story
    ? storyNodeId(story)
    : slug
      ? (revealIds(tree, slug).at(-1) ?? null)
      : null;
  const loading = (registry.storyRoots?.length ?? 0) > 0 && registry.stories === undefined;
  const open = (item: TreeItem) => {
    const { node } = item;
    if (node.kind === "story" && node.file && node.story)
      go(componentView(node.file.slug, node.story.id));
    else if (node.kind === "component" && node.file) {
      // Only the selected component toggles; a story ancestor still opens its page.
      if (node.id === selected || !expanded.has(node.id)) toggle(node.id);
      go(componentView(node.file.slug));
    } else if (item.expanded !== null) toggle(node.id);
  };
  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label={t("rail.components")}
        className="flex w-72 shrink-0 flex-col border-r border-border bg-[var(--shell-panel)]"
      >
        {loading ? (
          <div
            role="status"
            aria-label={t("components.loading")}
            className="flex flex-col gap-2 p-4"
          >
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        ) : tree.length === 0 ? (
          <p className="p-4 text-[13px] text-muted-foreground">{t("components.empty")}</p>
        ) : (
          <VirtualTree
            label={t("components.tree")}
            items={items}
            selected={selected}
            onToggle={item => toggle(item.id)}
            onOpen={open}
            className="flex-1 py-2"
            renderRow={(item, state) => <TreeRow item={item} {...state} />}
          />
        )}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ProblemsBanner />
        {children}
      </div>
    </div>
  );
}

/** One tree row: indent, disclosure, kind icon and label; an empty root says so. */
function TreeRow({
  item,
  focused,
  selected,
}: {
  item: TreeItem;
  focused: boolean;
  selected: boolean;
}) {
  const t = useT();
  const { node } = item;
  const Icon = node.kind === "component" ? Component : node.kind === "story" ? BookOpen : null;
  return (
    <div
      className={cn(
        "mx-2 flex h-full min-w-0 flex-1 cursor-default items-center gap-1.5 rounded-md pr-2 text-[13px] hover:bg-muted",
        focused && "ring-1 ring-primary/40 ring-inset",
        selected && "bg-[var(--shell-primary-soft)] font-medium text-[var(--shell-primary-text)]",
        node.kind === "root" &&
          "font-mono text-[11px] tracking-wide text-muted-foreground uppercase"
      )}
      style={{ paddingLeft: (item.level - 1) * 14 + 4 }}
    >
      <ChevronRight
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform",
          item.expanded === null && "invisible",
          item.expanded && "rotate-90"
        )}
      />
      {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 truncate">{node.label}</span>
      {node.detail && (
        <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
          {node.detail}
        </span>
      )}
      {node.kind === "root" && node.children.length === 0 && (
        <span className="ml-auto truncate font-sans text-[11px] tracking-normal normal-case">
          {t("components.emptyRoot")}
        </span>
      )}
    </div>
  );
}

/** Story problems and warnings of the roots (they carry `root`); the rest stays usable. */
function ProblemsBanner() {
  const t = useT();
  const registry = useRegistry();
  const { problems, warnings } = storyDiagnostics(registry);
  if (!problems.length && !warnings.length) return null;
  const summary = [
    problems.length ? t("components.problems", { count: problems.length }) : null,
    warnings.length ? t("components.warnings", { count: warnings.length }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details
      className={cn(
        "shrink-0 border-b px-4 py-2 text-[13px]",
        problems.length
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-[color-mix(in_oklch,var(--tone-warning)_30%,transparent)] text-[var(--tone-warning)]"
      )}
    >
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <TriangleAlert className="size-4 shrink-0" />
        {summary}
      </summary>
      <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto text-foreground">
        {[...problems, ...warnings].map(item => (
          <li
            key={`${item.code}:${item.root}:${item.file}:${item.message}`}
            className="flex min-w-0 gap-2 font-mono text-[11px]"
          >
            <span className="shrink-0 text-muted-foreground">{item.code}</span>
            <span className="min-w-0 break-words">
              {[item.root, item.file].filter(Boolean).join("/")}
              {"line" in item && item.line ? `:${item.line}` : ""} — {item.message}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The right side with nothing open: pick a component (or the project has none yet). */
export function ComponentsPrompt() {
  const t = useT();
  const registry = useRegistry();
  const empty = (registry.stories?.length ?? 0) === 0;
  return (
    <div className="shell-dots grid flex-1 place-items-center p-6">
      <p className="text-[13px] text-muted-foreground">
        {empty ? t("components.empty") : t("components.pick")}
      </p>
    </div>
  );
}

/**
 * S3: a component file with its description (plain text), path and one thumbnail per story.
 * Thumbnails go through `Preview` and its scheduler, so only visible ones load, within the
 * scheduler limit; they never run `play`, and a failing one settles its slot at once and shows
 * its failure alone.
 */
export function ComponentPage({
  file,
  theme,
}: {
  file: RegistryStoryFile;
  theme: "light" | "dark";
}) {
  const t = useT();
  const registry = useRegistry();
  const slots = useSlots();
  const target: ReviewTarget = {
    kind: "story",
    key: storyKey(file.slug),
    slug: file.slug,
    story: null,
  };
  const root = registry.storyRoots?.find(item => item.id === file.root);
  const meta = [
    (registry.storyRoots?.length ?? 0) > 1 ? root?.title : null,
    file.file,
    t("count.stories", { count: file.stories.length }),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <ShellSubHeader
        title={file.title}
        status={slots.reviewStatus?.(target)}
        theme={theme}
        menu={slots.reviewMenu?.(target)}
      />
      <div className="shell-dots min-h-0 flex-1 overflow-y-auto px-5 py-6 xl:px-8">
        {file.description && (
          <p className="max-w-[720px] text-[13px] whitespace-pre-line text-muted-foreground">
            {file.description}
          </p>
        )}
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {t("components.file")} · {meta}
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {file.stories.map((story, index) => (
            <li
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
                  // A component reads at half the screen viewport (same 16:10 card): at 1280 a
                  // button shrinks to a few pixels in a one-third-width card.
                  width={640}
                  height={400}
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
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
