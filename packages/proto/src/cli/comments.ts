/**
 * Agent CLI for prototype review comments. Reads and writes
 * `apps/<app>/gallery/comments/<slug>/comments.json` directly, so it works with or without the dev
 * server (a running gallery picks changes up live).
 *
 *   bun run proto comments list [--slug x] [--spec y] [--status open|resolved|all] [--json]
 *   bun run proto comments show <id> [--json]
 *   bun run proto comments add <slug> --note "…" [--state s]
 *   bun run proto comments reply <id> --note "…" [--author agent|reviewer]
 *   bun run proto comments resolve <id> --note "what changed"
 *   bun run proto comments reopen <id> [--note "…"]
 *   bun run proto comments delete <id>
 */
import { execFileSync } from "node:child_process";

import { flowOfKey } from "../flow.ts";
import {
  sourceFile,
  targetSummary,
  type CommentAuthor,
  type ReviewComment,
} from "../shell/comments/model.ts";
import {
  addComment,
  assertSlug,
  commentedSlugs,
  editMessage,
  CommentError,
  displayPath,
  getComment,
  readComments,
  removeComment,
  replyTo,
  setStatus,
} from "../node/comments-store.ts";

import { findPrototypes } from "../node/discovery";
import { findFlows } from "../node/flows";
import { currentApp, repoRoot } from "../node/paths";

export const galleryOrigin = "http://127.0.0.1:4400";

export type CommentOptions = {
  slug?: string;
  spec?: string;
  status: string;
  note?: string;
  message?: string;
  author: string;
  state?: string;
  json?: boolean;
};
/** The spec a prototype belongs to, or the spec that owns a flow (`flow-<id>` comments). */
function specOf(slug: string) {
  const { appRoot, config } = currentApp();
  const prototypes = findPrototypes(appRoot, repoRoot, config).entries;
  const flow = flowOfKey(slug);
  if (flow)
    return findFlows(appRoot, repoRoot, prototypes, config).flows.find(item => item.id === flow)
      ?.spec;
  return prototypes.find(entry => entry.slug === slug)?.meta?.spec;
}

export async function runComments(command: string, id: string | undefined, values: CommentOptions) {
  const origin = galleryOrigin;
  function previewUrl(comment: ReviewComment) {
    const params = new URLSearchParams({ chrome: "0", state: comment.context.state });
    if (comment.context.theme) params.set("theme", comment.context.theme);
    if (comment.context.role) params.set("role", comment.context.role);
    return `${origin}/${comment.slug}?${params}`;
  }

  function galleryUrl(comment: ReviewComment) {
    const flow = flowOfKey(comment.slug);
    if (flow) {
      const params = new URLSearchParams({ flow });
      if (comment.context.state) params.set("node", comment.context.state);
      if (comment.context.theme) params.set("theme", comment.context.theme);
      params.set("comment", comment.id);
      return `${origin}/?${params}`;
    }
    const params = new URLSearchParams({ p: comment.slug, state: comment.context.state });
    if (comment.context.theme) params.set("theme", comment.context.theme);
    if (comment.context.role) params.set("role", comment.context.role);
    params.set("w", String(comment.context.viewport.width));
    params.set("comment", comment.id);
    return `${origin}/?${params}`;
  }

  function describe(comment: ReviewComment, full: boolean) {
    const { context, target } = comment;
    const [note, ...replies] = comment.thread;
    const flow = flowOfKey(comment.slug);
    const view = [
      flow ? `flow ${flow}` : `state ${context.state}`,
      context.theme ?? "system theme",
      context.role ? `role ${context.role}` : null,
      `${context.viewport.width}×${context.viewport.height}`,
    ].filter(Boolean);
    const lines = [
      `${comment.id}  [${comment.status}]  ${view.join(" · ")}`,
      ...(!full ? [`  note:     ${note?.body ?? ""}`] : []),
    ];
    if (target.kind === "node") lines.push(`  target:   ${targetSummary(target)}`);
    else {
      lines.push(
        `  source:   ${target.source ?? "(none: rendered outside instrumented source)"}`,
        `  target:   ${target.kind} <${target.tag}> ${target.selector}`
      );
      if (target.text) lines.push(`  text:     "${target.text}"`);
    }
    if (full) {
      lines.push(
        `  commit:   ${context.commit ?? "unknown (no Git checkout when it was written)"}`
      );
      const head = headCommit();
      const file = target.kind === "node" ? null : sourceFile(target.source);
      if (
        context.commit &&
        context.commit !== head &&
        /^[a-f0-9]{40}$/.test(context.commit) &&
        file
      ) {
        lines.push(`  inspect:  git show ${context.commit}:${file}`);
      }
      if (target.kind !== "node") {
        if (target.sourceChain.length > 1)
          lines.push(`  chain:    ${target.sourceChain.join(" < ")}`);
        const r = target.rect;
        lines.push(`  rect:     x ${r.x} y ${r.y} w ${r.width} h ${r.height} (canvas px)`);
        lines.push(`  preview:  ${previewUrl(comment)}`);
      }
      lines.push(`  gallery:  ${galleryUrl(comment)}`);
      for (const [index, message] of comment.thread.entries()) {
        lines.push(
          `${index + 1} ${message.author} · ${message.at}${message.editedAt ? ` · edited ${message.editedAt}` : ""}`,
          `  ${message.body}`
        );
        for (const image of message.attachments)
          lines.push(`  ${image.id}  ${image.name}  ${image.type}  ${image.size} bytes`);
      }
    } else if (replies.length > 0) {
      lines.push(`  replies:  ${replies.length}`);
    }
    return lines.join("\n");
  }

  async function list() {
    const status = values.status;
    if (status !== "open" && status !== "resolved" && status !== "all") {
      throw new CommentError(`Invalid --status "${status}"`, 400);
    }
    const slugs = values.slug ? [values.slug] : await commentedSlugs();
    const comments = (
      await Promise.all(
        slugs
          .filter(slug => !values.spec || specOf(slug) === values.spec)
          .map(slug => readComments(slug))
      )
    )
      .flat()
      .filter(comment => status === "all" || comment.status === status);
    if (values.json) {
      console.log(JSON.stringify(comments, null, 2));
      return;
    }
    if (comments.length === 0) {
      console.log(`No ${status === "all" ? "" : `${status} `}comments.`);
      return;
    }
    console.log(comments.map(comment => describe(comment, false)).join("\n\n"));
  }

  function requireNote(command: string) {
    if (!values.note?.trim()) throw new CommentError(`${command} needs --note "<text>"`, 400);
    return values.note;
  }

  if (command === "list") {
    await list();
    return;
  }
  if (!id) throw new CommentError(`${command} needs a comment id`, 400);
  const author: CommentAuthor = values.author === "reviewer" ? "reviewer" : "agent";
  let comment: ReviewComment;
  if (command === "add")
    comment = await addPageComment(id, requireNote("add"), values.state, author);
  else if (command === "show") comment = await getComment(id);
  else if (command === "edit") {
    const current = await getComment(id);
    const index =
      values.message === undefined
        ? current.thread.findLastIndex(message => message.author === author)
        : Number(values.message) - 1;
    if (!Number.isInteger(index) || index < 0 || !current.thread[index])
      throw new CommentError("No matching message; specify --message <number>", 400);
    comment = await editMessage(
      id,
      current.thread[index].id,
      { body: requireNote("edit") },
      author
    );
  } else if (command === "reply") comment = await replyTo(id, author, requireNote("reply"));
  else if (command === "resolve") {
    comment = await setStatus(id, "resolved", { author, body: requireNote("resolve") });
  } else if (command === "reopen") {
    comment = await setStatus(id, "open", { author, body: values.note ?? "" });
  } else if (command === "delete") comment = await removeComment(id);
  else throw new CommentError(`Unknown command "${command}"`, 400);

  if (values.json) console.log(JSON.stringify(comment, null, 2));
  else {
    console.log(describe(comment, true));
    if (command !== "show") console.log(`\n${command}: ${displayPath(comment.slug)}`);
  }
}

/**
 * A reviewer note on a whole prototype state (the full canvas as its region), for scripts and
 * agents relaying feedback; element comments are created by clicking in the gallery.
 */
async function addPageComment(
  slug: string,
  body: string,
  state: string | undefined,
  author: CommentAuthor
) {
  assertSlug(slug);
  const { appRoot, config } = currentApp();
  const entry = findPrototypes(appRoot, repoRoot, config).entries.find(item => item.slug === slug);
  const states = entry?.meta?.states.map(option => option.id) ?? [];
  if (state && !states.includes(state)) throw new CommentError(`Unknown state "${state}"`, 400);
  const comment = addComment(
    slug,
    {
      context: {
        commit: headCommit(),
        state: state ?? states[0] ?? "",
        theme: null,
        role: null,
        viewport: { width: 1440, height: 960 },
      },
      target: {
        kind: "region",
        selector: "body",
        testId: null,
        tag: "body",
        text: "",
        source: null,
        sourceChain: [],
        rect: { x: 0, y: 0, width: 1440, height: 960 },
        rectNormalized: { x: 0, y: 0, width: 1, height: 1 },
        offset: null,
      },
      body,
    },
    { kind: author }
  );
  return comment;
}

function headCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
