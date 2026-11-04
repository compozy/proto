/** How review data reads in the shell: numbers, authors, times, targets, waiting. Pure. */
import type { CommentMessage, ReviewComment } from "../../model/review";
import { flowOfKey, keyKind, storyOfKey, type Registry } from "../../model/registry";
import { componentView, screenView, type View } from "../lib/view";
import type { Locale } from "../lib/i18n";

/** `login-form-7` → 7. */
export function commentNumber(comment: Pick<ReviewComment, "id" | "slug">) {
  return Number(comment.id.slice(comment.slug.length + 1));
}

/** Display name: the remote author name, else the author kind. */
export function authorName(
  message: Pick<CommentMessage, "author" | "authorName">,
  labels: { reviewer: string; agent: string }
) {
  return message.authorName ?? labels[message.author];
}

export function initials(name: string) {
  return (
    name
      .split(/[\s·]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Waiting for the reviewer: an open thread whose last message was written by an agent. */
export function isWaiting(comment: ReviewComment) {
  return comment.status === "open" && comment.thread.at(-1)?.author === "agent";
}

/** `src/components/login-form.tsx:58:27` → `login-form.tsx:58:27` for chips. */
export function shortSource(source: string) {
  return source.split("/").at(-1) ?? source;
}

/** The state a comment was written on (flow comments: the step's state is in the context). */
export function commentState(comment: ReviewComment) {
  return comment.context.state;
}

/** The flow step a node target points at, or null for the whole flow / element targets. */
export function commentNode(comment: ReviewComment) {
  return comment.target.kind === "node" ? comment.target.node : null;
}

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** `4 min ago` / `há 4 min`, relative to `now`. */
export function relativeTime(at: string, locale: Locale, now = Date.now()) {
  const seconds = Math.round((Date.parse(at) - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, "minute");
}

/** Newest activity first. */
export function byActivity(a: ReviewComment, b: ReviewComment) {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

/**
 * Where a comment opens: its prototype state, its flow step, or its story (`story--<slug>` keys
 * keep the story id in `context.state`). Key forms are read only through the model's `keyKind`.
 */
export function commentView(comment: ReviewComment): View {
  const kind = keyKind(comment.slug);
  if (kind === "flow")
    return {
      area: "flow",
      flow: flowOfKey(comment.slug) ?? comment.slug,
      node: comment.target.kind === "node" ? comment.target.node : null,
      comment: comment.id,
    };
  if (kind === "story")
    return componentView(storyOfKey(comment.slug) ?? comment.slug, comment.context.state || null, {
      comment: comment.id,
    });
  return screenView(comment.slug, comment.context.state, {
    comment: comment.id,
    role: comment.context.role,
  });
}

/**
 * How a review key reads in lists: its title, the line under it (the state, or the story name)
 * and a flag. A `story--` key is a component: `orphaned` when no component has that slug any
 * more, `stale` when the commented story is gone. Without a registry (still loading) a key
 * shows its slug, never a guess.
 */
export type KeySubject = {
  kind: "screen" | "flow" | "story";
  title: string;
  detail: string;
  spec: string | null;
  flag: "stale" | "orphaned" | null;
};

export function describeKey(
  key: string,
  state: string,
  registry: Pick<Registry, "prototypes" | "flows" | "stories"> | null
): KeySubject {
  const kind = keyKind(key);
  if (kind === "story") {
    const slug = storyOfKey(key) ?? key;
    const base = { kind, title: slug, detail: state, spec: null, flag: null } as const;
    if (!registry) return base;
    const file = registry.stories?.find(item => item.slug === slug);
    if (!file) return { ...base, flag: "orphaned" };
    const story = file.stories.find(item => item.id === state);
    return story
      ? { ...base, title: file.title, detail: story.name }
      : { ...base, title: file.title, flag: "stale" };
  }
  if (kind === "flow") {
    const id = flowOfKey(key) ?? key;
    const flow = registry?.flows.find(item => item.id === id);
    return { kind, title: flow?.title ?? id, detail: state, spec: flow?.spec ?? null, flag: null };
  }
  const prototype = registry?.prototypes.find(item => item.slug === key);
  return {
    kind: "screen",
    title: prototype?.title ?? key,
    detail: state,
    spec: prototype?.spec ?? null,
    flag: null,
  };
}
