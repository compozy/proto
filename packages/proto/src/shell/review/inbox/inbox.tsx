/**
 * S11 comments inbox (`/?comments=open|waiting|resolved`): every thread across prototypes, flows
 * and components (`story--` keys, routed by the model's `keyKind`), grouped by key, filtered by
 * author kind and spec; the detail pane shows the thread and a preview of the commented state or
 * story with its pin, and opens it in context (`?p=…&comment=<id>`, `?c=…&story=…&comment=<id>`).
 */
import { useState } from "react";

import type { ReviewComment } from "../../../model/review";
import { flowOfKey, keyKind, storyOfKey, type Registry } from "../../../model/registry";
import { Link } from "../../app/link";
import { Preview, type PreviewTarget } from "../../frames/preview";
import { useLocale, useT } from "../../lib/i18n";
import { go } from "../../lib/navigation";
import { specTitle } from "../../lib/registry-model";
import { useRegistry } from "../../lib/shell-data";
import { type InboxFilter } from "../../lib/view";
import { Avatar, AvatarFallback } from "../../ui/avatar";
import { Blocks, Bot, ExternalLink, Monitor, Workflow } from "../../ui/icons";
import { NativeSelect, NativeSelectOption } from "../../ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "../../ui/tabs";
import { cn } from "../../ui/utils";
import { useAllComments } from "../data";
import {
  authorName,
  byActivity,
  commentNumber,
  commentView,
  describeKey,
  initials,
  isWaiting,
  relativeTime,
  type KeySubject,
} from "../format";
import { ThreadCard } from "../threads/thread-card";

type Item = KeySubject & { comment: ReviewComment };

/** What a comment shows: a prototype state, a flow step's prototype, or its story. */
function previewTarget(registry: Registry, comment: ReviewComment): PreviewTarget | null {
  const kind = keyKind(comment.slug);
  const theme = comment.context.theme ?? "light";
  if (kind === "story") {
    const file = registry.stories?.find(item => item.slug === storyOfKey(comment.slug));
    const story = file?.stories.find(item => item.id === comment.context.state);
    return file && story
      ? { kind: "story", root: file.root, slug: file.slug, story: story.id, theme }
      : null;
  }
  if (kind === "prototype")
    return {
      slug: comment.slug,
      state: comment.context.state,
      role: comment.context.role,
      theme,
    };
  const node = registry.flows
    .find(item => item.id === flowOfKey(comment.slug))
    ?.nodes.find(item => comment.target.kind === "node" && item.id === comment.target.node);
  return node?.kind === "prototype"
    ? { slug: node.proto, state: node.state, role: node.role ?? null, theme }
    : null;
}

/** Filter the shared comments collection and show a selected thread without per-key list requests. */
export function Inbox({ filter, theme }: { filter: InboxFilter; theme: "light" | "dark" }) {
  const t = useT();
  const locale = useLocale();
  const registry = useRegistry();
  const query = useAllComments();
  const [author, setAuthor] = useState<"" | "reviewer" | "agent">("");
  const [spec, setSpec] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const comments = query.data ?? [];
  const described: Item[] = comments.map(comment => ({
    ...describeKey(comment.slug, comment.context.state, registry),
    comment,
  }));
  const counts = {
    open: comments.filter(item => item.status === "open").length,
    waiting: comments.filter(isWaiting).length,
    resolved: comments.filter(item => item.status === "resolved").length,
  };
  const items = described
    .filter(({ comment: item }) =>
      filter === "waiting"
        ? isWaiting(item)
        : item.status === (filter === "resolved" ? "resolved" : "open")
    )
    .filter(({ comment: item }) => !author || item.thread[0]?.author === author)
    .filter(item => !spec || item.spec === spec)
    .sort((a, b) => byActivity(a.comment, b.comment));
  const grouped = new Map<string, Item[]>();
  for (const item of items) {
    const group = grouped.get(item.comment.slug);
    if (group) group.push(item);
    else grouped.set(item.comment.slug, [item]);
  }
  const groups = [...grouped].map(([key, items]) => ({ key, items }));
  const active = items.find(item => item.comment.id === selected) ?? items[0];
  const specs = [...new Set(described.map(item => item.spec).filter(Boolean))] as string[];
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-full max-w-[420px] min-w-0 shrink-0 flex-col border-r border-border bg-[var(--shell-panel)] max-md:max-w-none">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <h1 className="sr-only">{t("rail.comments")}</h1>
          <Tabs
            value={filter}
            onValueChange={value => go({ area: "comments", filter: value as InboxFilter })}
          >
            <TabsList aria-label={t("inbox.filters")} className="h-8 w-full rounded-lg">
              <TabsTrigger value="open" className="text-xs">
                {t("inbox.open")} · {counts.open}
              </TabsTrigger>
              <TabsTrigger value="waiting" className="text-xs">
                {t("inbox.waiting")} · {counts.waiting}
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">
                {t("inbox.resolved")} · {counts.resolved}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t("inbox.author")}</span>
              <NativeSelect
                size="sm"
                value={author}
                onChange={event => setAuthor(event.target.value as typeof author)}
                className="w-full"
              >
                <NativeSelectOption value="">{t("inbox.anyAuthor")}</NativeSelectOption>
                <NativeSelectOption value="reviewer">{t("review.reviewer")}</NativeSelectOption>
                <NativeSelectOption value="agent">{t("review.agent")}</NativeSelectOption>
              </NativeSelect>
            </label>
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t("inbox.spec")}</span>
              <NativeSelect
                size="sm"
                value={spec}
                onChange={event => setSpec(event.target.value)}
                className="w-full"
              >
                <NativeSelectOption value="">{t("inbox.anySpec")}</NativeSelectOption>
                {specs.map(id => (
                  <NativeSelectOption key={id} value={id}>
                    {specTitle(registry, id)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {query.data && items.length === 0 && (
            <p role="status" className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t(
                filter === "waiting"
                  ? "inbox.emptyWaiting"
                  : filter === "resolved"
                    ? "inbox.emptyResolved"
                    : "inbox.empty"
              )}
            </p>
          )}
          {groups.map(group => {
            const first = group.items[0];
            if (!first) return null;
            return (
              <div key={group.key} role="group" aria-label={first.title} className="mb-2">
                <h2 className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">
                  {first.kind === "flow" ? (
                    <Workflow className="size-3" />
                  ) : first.kind === "story" ? (
                    <Blocks className="size-3" />
                  ) : (
                    <Monitor className="size-3" />
                  )}
                  <span className="truncate">{first.title}</span>
                  {first.spec && (
                    <span className="truncate font-normal">
                      · {specTitle(registry, first.spec)}
                    </span>
                  )}
                </h2>
                <ul>
                  {group.items.map(item => {
                    const head = item.comment.thread[0];
                    const last = item.comment.thread.at(-1);
                    if (!head || !last) return null;
                    const name = authorName(head, {
                      reviewer: t("review.reviewer"),
                      agent: t("review.agent"),
                    });
                    return (
                      <li key={item.comment.id}>
                        <button
                          type="button"
                          aria-current={item === active ? "true" : undefined}
                          onClick={() => setSelected(item.comment.id)}
                          className={cn(
                            "flex w-full gap-3 rounded-xl px-3 py-3 text-left hover:bg-accent",
                            item === active &&
                              "bg-[var(--shell-primary-soft)] hover:bg-[var(--shell-primary-soft)]"
                          )}
                        >
                          <Avatar className="mt-0.5 size-7 shrink-0">
                            <AvatarFallback className="bg-muted text-[10px] font-semibold">
                              {head.author === "agent" ? (
                                <Bot className="size-3.5" />
                              ) : (
                                initials(name)
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="truncate font-mono">
                                #{commentNumber(item.comment)} · {item.detail}
                              </span>
                              {item.flag && <KeyFlag flag={item.flag} />}
                              <span className="ml-auto shrink-0 whitespace-nowrap">
                                {relativeTime(item.comment.updatedAt, locale)}
                              </span>
                            </span>
                            <span className="mt-1 line-clamp-2 block text-[13px] leading-snug">
                              {head.body}
                            </span>
                            {isWaiting(item.comment) && (
                              <span className="mt-1.5 flex items-center gap-1 text-[11px] text-primary">
                                <Bot className="size-3" />
                                {t("inbox.agentReplied", {
                                  name: authorName(last, {
                                    reviewer: t("review.reviewer"),
                                    agent: t("review.agent"),
                                  }),
                                })}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      {active && <Detail item={active} theme={theme} />}
    </div>
  );
}

/** Show the selected thread with its captured preview context and a link back to focused review. */
function Detail({ item, theme }: { item: Item; theme: "light" | "dark" }) {
  const t = useT();
  const registry = useRegistry();
  const target = previewTarget(registry, item.comment);
  const view = commentView(item.comment);
  const rect = item.comment.target.kind === "node" ? null : item.comment.target.rectNormalized;
  const width = item.comment.context.viewport.width || 1280;
  const height = item.comment.context.viewport.height || 800;
  return (
    <section
      aria-label={t("inbox.detail")}
      className="shell-dots hidden min-h-0 min-w-0 flex-1 flex-col md:flex"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/60 px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-semibold">{item.title}</h2>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {[item.spec && specTitle(registry, item.spec), item.detail].filter(Boolean).join(" · ")}
          </div>
        </div>
        <Link
          to={view}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[13px] font-medium hover:bg-muted"
        >
          <ExternalLink className="size-3.5" />
          {t("inbox.openInContext")}
        </Link>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-5 overflow-y-auto p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {target ? (
          <div className="shell-frame overflow-hidden rounded-xl">
            <Preview
              key={JSON.stringify(target)}
              target={{ ...target, theme: item.comment.context.theme ?? theme }}
              title={t("preview.of", { title: item.title })}
              width={width}
              height={height}
              overlay={
                rect && (
                  <span
                    aria-hidden="true"
                    className="absolute grid size-6 -translate-y-full place-items-center rounded-full rounded-bl-none bg-primary font-mono text-[11px] font-semibold text-primary-foreground shadow-[0_0_0_3px_var(--background),0_0_0_6px_var(--shell-primary-glow)]"
                    style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%` }}
                  >
                    {commentNumber(item.comment)}
                  </span>
                )
              }
            />
          </div>
        ) : (
          <div />
        )}
        <div className="min-w-0">
          <ThreadCard comment={item.comment} active onFocus={() => {}} />
        </div>
      </div>
    </section>
  );
}

/** A story comment whose story (`stale`) or component (`orphaned`) is gone: kept and flagged. */
function KeyFlag({ flag }: { flag: "stale" | "orphaned" }) {
  const t = useT();
  return (
    <span className="shrink-0 rounded-full border border-[color-mix(in_oklch,var(--tone-warning)_40%,transparent)] px-1.5 font-sans text-[10px] text-[var(--tone-warning)]">
      {t(flag === "stale" ? "inbox.stale" : "inbox.orphaned")}
    </span>
  );
}
