/** How review data reads in the shell: numbers, authors, times, targets, waiting. Pure. */
import type { CommentMessage, ReviewComment } from "../../model/review";
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
