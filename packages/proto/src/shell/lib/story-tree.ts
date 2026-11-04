/**
 * The Components area model (`_uiux.md` S2–S4): the component tree built from story titles,
 * its visible rows, and how a `?c=…&story=…` link resolves. Pure: no DOM.
 */
import type {
  Registry,
  RegistryProblem,
  RegistryStory,
  RegistryStoryFile,
  RegistryWarning,
} from "../../model/registry";

export type StoryTreeNode = {
  /** Stable across registry refreshes: the expanded set is keyed by it. */
  id: string;
  kind: "root" | "group" | "component" | "story";
  label: string;
  root: string;
  /** The component file of a `component` node and of a `story` node. */
  file: RegistryStoryFile | null;
  story: RegistryStory | null;
  children: StoryTreeNode[];
};

export type StoryTreeRow = {
  node: StoryTreeNode;
  /** 1-based, as `aria-level`. */
  level: number;
  expanded: boolean;
  /** The id of the row's parent; null for top nodes. */
  parent: string | null;
  /** Position among siblings (1-based) and their count, as `aria-posinset`/`aria-setsize`. */
  position: number;
  size: number;
};

export const rootNodeId = (root: string) => `r:${root}`;
const pathNodeId = (root: string, path: readonly string[]) => `p:${root}:${path.join("/")}`;
export const storyNodeId = (story: string) => `s:${story}`;

/** Stories first in export order, then groups and components sorted by label, recursively. */
function sortNodes(nodes: StoryTreeNode[]) {
  const stories = nodes.filter(node => node.kind === "story");
  const rest = nodes
    .filter(node => node.kind !== "story")
    .sort((a, b) => a.label.localeCompare(b.label));
  nodes.splice(0, nodes.length, ...stories, ...rest);
  for (const node of rest) sortNodes(node.children);
  return nodes;
}

/**
 * The component tree of a registry: one node per `/` segment of a title, a component node at the
 * last segment with its stories as leaves. Roots are top nodes only when there are two or more;
 * an empty root stays as a node without children so its empty state can show.
 */
export function buildStoryTree(registry: Pick<Registry, "storyRoots" | "stories">) {
  const roots = registry.storyRoots ?? [];
  const files = registry.stories ?? [];
  const byRoot = new Map<string, StoryTreeNode[]>();
  const nodes = new Map<string, StoryTreeNode>();
  for (const root of roots) byRoot.set(root.id, []);
  for (const file of files) {
    let siblings = byRoot.get(file.root);
    if (!siblings) continue;
    const path = file.path.length ? file.path : [file.title];
    for (const [index, segment] of path.entries()) {
      const id = pathNodeId(file.root, path.slice(0, index + 1));
      let node = nodes.get(id);
      if (!node) {
        node = {
          id,
          kind: "group",
          label: segment,
          root: file.root,
          file: null,
          story: null,
          children: [],
        };
        nodes.set(id, node);
        siblings.push(node);
      }
      if (index === path.length - 1 && !node.file) {
        node.kind = "component";
        node.file = file;
        // Stories come before nested components (`UI/Button` and `UI/Button/Icon`).
        node.children.unshift(
          ...file.stories.map(story => ({
            id: storyNodeId(story.id),
            kind: "story" as const,
            label: story.name,
            root: file.root,
            file,
            story,
            children: [],
          }))
        );
      }
      siblings = node.children;
    }
  }
  if (roots.length < 2) return sortNodes(byRoot.get(roots[0]?.id ?? "") ?? []);
  return roots.map(root => ({
    id: rootNodeId(root.id),
    kind: "root" as const,
    label: root.title,
    root: root.id,
    file: null,
    story: null,
    children: sortNodes(byRoot.get(root.id) ?? []),
  }));
}

/** The rows a tree shows with `expanded` open, depth first. */
export function visibleRows(
  nodes: readonly StoryTreeNode[],
  expanded: ReadonlySet<string>,
  level = 1,
  parent: string | null = null,
  rows: StoryTreeRow[] = []
) {
  for (const [index, node] of nodes.entries()) {
    const open = node.children.length > 0 && expanded.has(node.id);
    rows.push({
      node,
      level,
      expanded: open,
      parent,
      position: index + 1,
      size: nodes.length,
    });
    if (open) visibleRows(node.children, expanded, level + 1, node.id, rows);
  }
  return rows;
}

/** The ids to expand so a component (and its stories) shows: every ancestor and the node. */
export function revealIds(nodes: readonly StoryTreeNode[], slug: string): string[] {
  for (const node of nodes) {
    if (node.kind === "story") continue;
    if (node.file?.slug === slug) return [node.id];
    const inner = revealIds(node.children, slug);
    if (inner.length) return [node.id, ...inner];
  }
  return [];
}

/** Top nodes open by default: the roots, or a single root's first level. */
export function initialExpanded(nodes: readonly StoryTreeNode[]) {
  return new Set(nodes.filter(node => node.kind === "root").map(node => node.id));
}

export type ResolvedStoryView =
  | { kind: "component"; file: RegistryStoryFile; story: RegistryStory | null }
  | { kind: "missing-component"; slug: string }
  | { kind: "missing-story"; file: RegistryStoryFile; story: string };

/**
 * What `?c=<slug>&story=<id>` shows. The URL keeps an unknown id as written (`parseView`); it
 * resolves here to a not-found state, never silently to another story (US-002.EC-2).
 */
export function resolveStoryView(
  registry: Pick<Registry, "stories">,
  slug: string,
  story: string | null
): ResolvedStoryView {
  const file = registry.stories?.find(item => item.slug === slug);
  if (!file) return { kind: "missing-component", slug };
  if (story === null) return { kind: "component", file, story: null };
  const found = file.stories.find(item => item.id === story);
  return found ? { kind: "component", file, story: found } : { kind: "missing-story", file, story };
}

/** Problems and warnings of story roots (they carry `root`), for the Components banner. */
export function storyDiagnostics(registry: Pick<Registry, "problems" | "warnings">) {
  const problems: RegistryProblem[] = registry.problems.filter(item => item.root !== undefined);
  const warnings: RegistryWarning[] = registry.warnings.filter(item => item.root !== undefined);
  return { problems, warnings };
}

/** Whether the indexer reported module mocks (`sb.mock`, `mocked`) for this story file. */
export function hasModuleMocks(
  registry: Pick<Registry, "warnings">,
  file: Pick<RegistryStoryFile, "root" | "file">
) {
  return registry.warnings.some(
    item =>
      item.code === "story_mock_unsupported" && item.root === file.root && item.file === file.file
  );
}
