/**
 * Human output of the `proto` CLI (without `--json`; `_dx.md` § CLI is illustrative, only
 * `--json` is the contract). Tables and one-line ✓/✗ results, comment ids, 7-character commits,
 * relative times and `file:line:col` sources. Failures go to stderr as `✗ <message> (<code>)`;
 * the exit code stays the registry's. Credential tokens are never printed: every formatter
 * picks the fields it shows.
 */
import { z } from "zod";

import { argumentSchema, catalog } from "../capabilities/catalog.ts";

type Result = { exitCode: number; data: unknown };
export type HumanOutput = { stdout: string; stderr: string };

type Comment = {
  id: string;
  slug: string;
  status: "open" | "resolved";
  updatedAt: string;
  context: { state: string; theme: string | null; commit?: string | null };
  target:
    | { kind: "node"; node: string | null; label: string }
    | { kind: string; source: string | null; sourceChain: string[]; selector: string };
  thread: {
    id: string;
    at: string;
    author: string;
    authorName?: string;
    body: string;
    attachments: { id: string; name: string }[];
  }[];
};
type Event = {
  type: string;
  at: string;
  author: string;
  authorName?: string;
  commit: string | null;
  openCount: number;
  commentId?: string;
};
type Review = { key: string; status: string; open: number; events: Event[] };
type Problem = {
  code: string;
  file?: string;
  line?: number;
  column?: number;
  message?: string;
  proto?: string;
  state?: string;
};

const flagIsBoolean = (name: string) => {
  const schema = (argumentSchema.shape as Record<string, z.ZodType>)[name];
  const inner = schema instanceof z.ZodOptional ? schema.unwrap() : schema;
  return inner instanceof z.ZodBoolean;
};

/** The catalog command an argv names (the same longest-prefix rule as `runCli`). */
export function commandOf(argv: readonly string[]) {
  const words: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (!value.startsWith("--")) words.push(value);
    else if (!value.includes("=") && !flagIsBoolean(value.slice(2))) index += 1;
  }
  const match = [...catalog]
    .sort((a, b) => b.cli.split(" ").length - a.cli.split(" ").length)
    .find(item => item.cli.split(" ").every((word, index) => words[index] === word));
  return match?.cli ?? null;
}

const short = (commit: string | null | undefined) => (commit ? commit.slice(0, 7) : "—");
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const oneLine = (text: string, max = 60) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export function ago(at: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Aligned columns; the last column is never padded. */
export function table(rows: readonly (readonly string[])[]) {
  const widths: number[] = [];
  for (const row of rows)
    row.forEach((cell, index) => (widths[index] = Math.max(widths[index] ?? 0, cell.length)));
  return rows
    .map(row =>
      row
        .map((cell, index) => (index < row.length - 1 ? cell.padEnd(widths[index]!) : cell))
        .join("  ")
        .trimEnd()
    )
    .join("\n");
}

const sourceOf = (comment: Comment) => {
  if (comment.target.kind !== "node")
    return (comment.target as { source: string | null }).source ?? "—";
  const node = (comment.target as { node: string | null }).node;
  return comment.slug.startsWith("flow-") ? `step ${node ?? "(whole flow)"}` : "—";
};

const author = (message: Comment["thread"][number]) => message.authorName ?? message.author;

function commentLine(comment: Comment, now: number) {
  const first = comment.thread[0];
  return [
    comment.id,
    comment.context.state || "—",
    first ? author(first) : "—",
    ago(comment.updatedAt, now),
    oneLine(first?.body ?? ""),
    sourceOf(comment),
  ];
}

function showComment(comment: Comment, now: number) {
  const lines = [
    `${comment.id}  ${comment.status}  ${comment.slug} · ${comment.context.state || "—"}${
      comment.context.theme ? ` · ${comment.context.theme}` : ""
    }  ${short(comment.context.commit)}`,
    `source  ${sourceOf(comment)}`,
  ];
  if (comment.target.kind !== "node") {
    const chain = (comment.target as { sourceChain: string[] }).sourceChain;
    if (chain.length > 1) lines.push(...chain.slice(1).map(entry => `        ${entry}`));
  }
  comment.thread.forEach((message, index) => {
    lines.push("", `${index + 1}. ${author(message)} · ${ago(message.at, now)}`);
    lines.push(...message.body.split("\n").map(line => `   ${line}`));
    for (const image of message.attachments) lines.push(`   📎 ${image.id} ${image.name}`);
  });
  return lines.join("\n");
}

function reviewLines(review: Review, now: number) {
  const head = `${review.key}  ${review.status === "approved" ? "approved" : "in review"} · ${plural(review.open, "open comment")}`;
  if (!review.events.length) return head;
  return [
    head,
    table(
      [...review.events]
        .reverse()
        .map(event => [
          event.type.replace("_", " "),
          event.authorName ?? event.author,
          short(event.commit),
          `${event.openCount} open`,
          ago(event.at, now),
          event.commentId ?? "",
        ])
    ),
  ].join("\n");
}

const problemLine = (mark: string, problem: Problem) => {
  const where = problem.file
    ? `${problem.file}${problem.line ? `:${problem.line}${problem.column ? `:${problem.column}` : ""}` : ""}`
    : "";
  return `${mark} ${[where, problem.code, problem.message ?? [problem.proto, problem.state].filter(Boolean).join(" ")].filter(Boolean).join("  ")}`;
};

const message = (data: unknown) => {
  const error = (data as { error?: { code?: string; message?: string } })?.error;
  return error ? `✗ ${error.message ?? "Failed"}${error.code ? ` (${error.code})` : ""}` : null;
};

/** Human output of a CLI result for `argv` (no `--json`). */
export function formatHuman(
  argv: readonly string[],
  result: Result,
  now = Date.now()
): HumanOutput {
  const data = result.data as Record<string, unknown> | undefined;
  const failure = message(data);
  const command = commandOf(argv);
  if (data === undefined) return { stdout: "", stderr: "" };
  if (failure && !("problems" in data) && !("keys" in data)) return { stdout: "", stderr: failure };
  const out = (stdout: string) => ({ stdout, stderr: "" });

  if ("commands" in data)
    return out(["Commands:", ...(data.commands as string[]).map(c => `  proto ${c}`)].join("\n"));
  switch (command) {
    case "list": {
      const prototypes = data.prototypes as {
        slug: string;
        kind: string;
        title: string;
        spec: string | null;
        surface: string | null;
        route: string | null;
        states: unknown[];
      }[];
      const flows = data.flows as unknown[];
      return out(
        [
          table(
            prototypes.map(item => [
              item.spec ?? "—",
              item.kind === "draft" ? `${item.slug} (draft)` : item.slug,
              item.title,
              item.surface ?? "",
              item.route ?? "",
              plural(item.states.length, "state"),
            ])
          ),
          `${plural(prototypes.length, "prototype")} · ${plural(flows.length, "flow")}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
    case "check": {
      const problems = (data.problems ?? []) as Problem[];
      const warnings = (data.warnings ?? []) as Problem[];
      const lines = [
        ...problems.map(problem => problemLine("✗", problem)),
        ...warnings.map(warning => problemLine("!", warning)),
      ];
      if (typeof data.error === "string") lines.push(`✗ ${data.error}`);
      lines.push(
        problems.length || warnings.length
          ? `${plural(problems.length, "problem")} · ${plural(warnings.length, "warning")}`
          : "✓ No problems"
      );
      return result.exitCode ? { stdout: "", stderr: lines.join("\n") } : out(lines.join("\n"));
    }
    case "url":
      return out(String(data.url));
    case "flow list":
      return out(
        table(
          (data.flows as { id: string; title: string; spec: string | null; steps: number }[]).map(
            flow => [flow.id, flow.title, flow.spec ?? "—", plural(flow.steps, "step")]
          )
        ) || "No flows"
      );
    case "flow show": {
      const steps = data.steps as {
        id: string;
        step: number;
        kind: string;
        proto?: string;
        state?: string;
      }[];
      const edges = data.edges as { from: string; to: string; on: string; kind: string }[];
      const problems = (data.problems ?? []) as Problem[];
      return out(
        [
          `${String(data.title)} (${String(data.id)})`,
          table(
            [...steps]
              .sort((a, b) => (a.step || 99) - (b.step || 99))
              .map(step => [
                step.step ? `${step.step}.` : "–",
                step.id,
                step.kind,
                step.proto ? `${step.proto} · ${step.state}` : "",
              ])
          ),
          table(edges.map(edge => [`${edge.from} → ${edge.to}`, `“${edge.on}”`, edge.kind])),
          ...problems.map(problem => problemLine("✗", problem)),
        ].join("\n")
      );
    }
    case "flow coverage": {
      const uncovered = data.uncovered as { proto: string; state: string }[];
      return out(
        uncovered.length
          ? [
              table(uncovered.map(item => [item.proto, item.state])),
              `${plural(uncovered.length, "state")} in no flow`,
            ].join("\n")
          : "✓ Every state is in a flow"
      );
    }
    case "new":
    case "flow new":
      return out(
        [`✓ ${String(data.file)}`, data.url ? `  ${String(data.url)}` : ""]
          .filter(Boolean)
          .join("\n")
      );
    case "comments list": {
      const comments = data.comments as Comment[];
      const status = argv.includes("--status") ? argv[argv.indexOf("--status") + 1] : "open";
      return out(
        [
          table(comments.map(comment => commentLine(comment, now))),
          status === "all" ? plural(comments.length, "comment") : `${comments.length} ${status}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
    case "comments show":
      return out(showComment(data as unknown as Comment, now));
    case "comments add":
      return out(`✓ ${(data.comment as Comment).id} open`);
    case "comments reply": {
      const comment = data.comment as Comment;
      const last = comment.thread.at(-1);
      return out(`✓ ${comment.id} replied (${last ? author(last) : "agent"})`);
    }
    case "comments resolve":
      return out(`✓ ${(data.comment as Comment).id} resolved`);
    case "comments reopen":
      return out(`✓ ${(data.comment as Comment).id} reopened`);
    case "comments edit":
      return out(`✓ ${(data.comment as Comment).id} edited`);
    case "comments attach": {
      const comment = data.comment as Comment;
      const index = comment.thread.findLastIndex(item => item.attachments.length);
      const image = comment.thread[index]?.attachments.at(-1);
      return out(`✓ attached ${image?.id ?? "image"} to ${comment.id} message ${index + 1}`);
    }
    case "comments detach":
      return out(`✓ detached from ${(data.comment as Comment).id}`);
    case "comments attachments": {
      const files = data.files as string[];
      return out(files.length ? files.map(file => `✓ ${file}`).join("\n") : "No attachments");
    }
    case "comments delete":
      return out(`✓ deleted ${String(data.deleted)}`);
    case "review status":
      return out(reviewLines(data as unknown as Review, now));
    case "review approve": {
      const review = data.review as Review;
      const event = review.events.at(-1);
      return out(
        `✓ ${review.key} approved at ${short(event?.commit)}${event?.openCount ? ` (${plural(event.openCount, "open comment")} recorded)` : ""}`
      );
    }
    case "review reopen":
      return out(`✓ ${(data.review as Review).key} back in review`);
    case "review unlock": {
      const owner = data.removedOwner as { hostId: string; pid: number } | null;
      return out(
        owner
          ? `✓ Removed lock held by host ${owner.hostId} (pid ${owner.pid})`
          : "✓ No lock to remove"
      );
    }
    case "screenshot":
      return out(`✓ ${String(data.path)} (${String(data.width)}×${String(data.height)})`);
    case "evidence":
      return out(`✓ ${String(data.path)} (static DOM, no scripts)`);
    case "init": {
      const skills = (data.skills ?? []) as { path: string; status: string }[];
      const legacy = (data.legacySkills ?? []) as { path: string; replacedBy: string }[];
      return out(
        [
          ...(data.skipped
            ? ["Already set up: nothing to write"]
            : [...(data.files as string[]).map(file => `✓ ${file}`), "Next: bunx proto dev"]),
          ...skills.map(skill => `✓ ${skill.path} (${skill.status})`),
          ...legacy.map(
            skill => `! ${skill.path} is a 0.1.x skill replaced by ${skill.replacedBy}; delete it`
          ),
        ].join("\n")
      );
    }
    case "dev":
      return out("");
    case "build": {
      const warnings = (data.warnings ?? []) as Problem[];
      return out(
        [`✓ ${String(data.path)}`, ...warnings.map(warning => problemLine("!", warning))].join("\n")
      );
    }
    case "migrate":
      return migrateOutput(data, result.exitCode);
    case "migrate remote":
      return remoteMigrateOutput(data, result.exitCode);
    case "auth credentials": {
      const credentials = data.credentials as {
        remote: string;
        id: string;
        name: string;
        scopes: string[];
      }[];
      return out(
        credentials.length
          ? table(credentials.map(item => [item.remote, item.id, item.name, item.scopes.join(",")]))
          : "No credentials stored on this machine"
      );
    }
    case "auth login":
      return out(
        `✓ Saved credential "${String(data.name)}" for ${String(data.remote)} (scope: comment)`
      );
    case "auth logout":
      return out(`✓ Removed the local credential for ${String(data.remote)}`);
    default:
      return out(JSON.stringify(data, null, 2));
  }
}

function migrateOutput(data: Record<string, unknown>, exitCode: number): HumanOutput {
  const keys = data.keys as {
    key: string;
    sourceKey: string;
    sourceVersion: number;
    comments: number;
    messages: number;
    attachments: unknown[];
    sequence: number;
    status: string;
    notes: string[];
  }[];
  const errors = data.errors as { key?: string; code: string; message: string }[];
  const rows = [
    ["key", "source", "comments", "messages", "attachments", "sequence", "status"],
    ...keys.map(item => [
      item.sourceKey === item.key ? item.key : `${item.sourceKey} → ${item.key}`,
      `v${item.sourceVersion}`,
      String(item.comments),
      String(item.messages),
      String(item.attachments.length),
      String(item.sequence),
      item.status,
    ]),
  ];
  const total = (field: "comments" | "messages") =>
    keys.reduce((sum, item) => sum + item[field], 0);
  const lines = [
    table(rows),
    `${plural(keys.length, "key")} · ${plural(total("comments"), "comment")} · ${plural(total("messages"), "message")}${
      data.dryRun ? " · dry run" : data.verified ? " · verified" : ""
    }`,
    ...((data.deletable as string[]) ?? []).map(path => `Delete when ready: ${path}`),
    ...((data.notes as string[]) ?? []),
  ];
  const failures = errors.map(
    error => `✗ ${error.key ? `${error.key}: ` : ""}${error.message} (${error.code})`
  );
  return exitCode
    ? { stdout: lines.join("\n"), stderr: failures.join("\n") }
    : { stdout: [...lines, ...failures].join("\n"), stderr: "" };
}

function remoteMigrateOutput(data: Record<string, unknown>, exitCode: number): HumanOutput {
  const counts = (data.counts ?? {}) as Record<
    string,
    { source: number; target: number; status: string }
  >;
  const errors = (data.errors ?? []) as { code: string; key?: string; message?: string }[];
  const lines = [
    `source read-only: ${data.sourceReadOnly ? "yes" : "no"}`,
    table([
      ["table", "source", "target", "status"],
      ...Object.entries(counts).map(([name, count]) => [
        name,
        String(count.source),
        String(count.target),
        count.status,
      ]),
    ]),
    data.dryRun
      ? "dry run: nothing written"
      : data.verified
        ? "✓ copied and verified; source unchanged during the run"
        : "",
  ].filter(Boolean);
  const failures = errors.map(
    error => `✗ ${error.key ? `${error.key}: ` : ""}${error.message ?? error.code} (${error.code})`
  );
  return exitCode
    ? { stdout: lines.join("\n"), stderr: failures.join("\n") }
    : { stdout: lines.join("\n"), stderr: "" };
}
