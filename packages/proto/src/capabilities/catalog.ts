import { z } from "zod";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { ProtoError } from "../model/errors.ts";
import type { ProtoProject } from "../node/project.ts";
import type { Author } from "../store/index.ts";
import { checkProject } from "../node/check.ts";
import { commitAt } from "../node/dev.ts";
import { scaffold, initProject, confined } from "../node/scaffold.ts";
import { capture } from "../node/capture.ts";
import { inspectImage } from "../node/image.ts";
export type Capability = {
  cli: string;
  mcp: string | null;
  exclusion?: string;
  store: boolean;
  positionals: readonly string[];
  authority: string;
};
const row = (
  cli: string,
  positionals: readonly string[] = [],
  store = false,
  exclusion?: string,
  authority = "read"
): Capability => ({
  cli,
  positionals,
  store,
  mcp: exclusion ? null : `proto_${cli.replaceAll(" ", "_")}`,
  exclusion,
  authority,
});
export const catalog: readonly Capability[] = [
  row("list"),
  row("check"),
  row("url", ["slug"]),
  row("flow list"),
  row("flow show", ["id"]),
  row("flow coverage"),
  row("new", ["slug"], false, undefined, "write files"),
  row("flow new", ["slug"], false, undefined, "write files"),
  row("comments list", [], true),
  row("comments show", ["id"], true),
  row("comments add", ["slug"], true, undefined, "comment"),
  row("comments reply", ["id"], true, undefined, "comment"),
  row("comments resolve", ["id"], true, undefined, "comment"),
  row("comments reopen", ["id"], true, undefined, "comment"),
  row("comments attach", ["id", "file"], true, undefined, "comment (own)"),
  row("comments detach", ["id", "attachment"], true, undefined, "comment (own)"),
  row("comments edit", ["id"], true, undefined, "comment (own)"),
  row("comments attachments", ["id"], true),
  row("comments delete", ["id"], true, undefined, "review session / local"),
  row("review status", ["key"], true),
  row("review approve", ["key"], true, "Agents never approve", "review"),
  row("review reopen", ["key"], true, "Agents never approve", "review"),
  row("review unlock", ["key"], true, "Operator recovery for another host's lock", "local only"),
  row("screenshot", ["slug"], false, undefined, "write files"),
  row("evidence", ["slug"], false, undefined, "write files"),
  ...["init", "dev", "build", "mcp"].map(cli => row(cli, [], false, "Process lifecycle")),
  ...["migrate", "migrate remote"].map(cli =>
    row(cli, [], false, "Operator action with interactive verification", "write files")
  ),
  ...["auth login", "auth logout", "auth credentials", "auth revoke"].map(cli =>
    row(cli, [], false, "Credentials require a browser session", "session")
  ),
];
export const exclusions = [
  {
    capability: "discard pending upload",
    reason: "Composer cleanup uses store.discard; no CLI or MCP operation",
  },
];
export const argumentSchema = z.object({
  from: z.string().optional(),
  "flow-prefix": z.string().optional(),
  "theme-map": z.string().optional(),
  "role-map": z.string().optional(),
  "dry-run": z.boolean().optional(),
  slug: z.string().optional(),
  id: z.string().optional(),
  key: z.string().optional(),
  file: z.string().optional(),
  attachment: z.string().optional(),
  state: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  role: z.string().optional(),
  width: z.coerce.number().int().min(320).max(3840).optional(),
  bare: z.boolean().optional(),
  draft: z.boolean().optional(),
  in: z.string().optional(),
  spec: z.string().optional(),
  note: z.string().optional(),
  selector: z.string().optional(),
  source: z.string().optional(),
  node: z.string().optional(),
  author: z.enum(["agent", "reviewer"]).default("agent"),
  status: z.enum(["open", "resolved", "all"]).optional(),
  "author-kind": z.enum(["agent", "reviewer"]).optional(),
  waiting: z.boolean().optional(),
  message: z.coerce.number().int().positive().optional(),
  out: z.string().optional(),
  "confirm-open": z.boolean().optional(),
  force: z.boolean().optional(),
  skills: z.boolean().optional(),
  remote: z.boolean().optional(),
  port: z.coerce.number().int().min(1).max(65534).optional(),
  json: z.boolean().optional(),
  verbose: z.boolean().optional(),
  app: z.string().optional(),
  help: z.boolean().optional(),
  kind: z.enum(["draft", "component"]).optional(),
});
export type Arguments = z.output<typeof argumentSchema>;
export class UsageError extends Error {}
export type CapabilityContext = { root: string; project?: ProtoProject; transport?: "cli" | "mcp" };
const required = (value: string | undefined, name: string) => {
  if (!value) throw new UsageError(`${name} is required`);
  return value;
};
export async function executeCapability(
  capability: Capability,
  args: Arguments,
  context: CapabilityContext
): Promise<unknown> {
  const command = capability.cli;
  if (args.remote) {
    if (
      command === "review approve" ||
      command === "review reopen" ||
      command === "comments delete"
    )
      throw new ProtoError("scope_denied");
    throw new ProtoError("auth_required", "Remote transport is wired in slice 8");
  }
  if (command === "init") return initProject(context.root, args);
  const project = context.project;
  if (!project) throw new ProtoError("invalid_config", "Project was not loaded");
  if (command === "list") {
    const registry = await project.registry();
    return {
      prototypes: registry.prototypes
        .filter(p => (!args.spec || p.spec === args.spec) && (!args.kind || p.kind === args.kind))
        .map(({ blocks: _blocks, ...p }) => p),
      flows: registry.flows.map(({ id, title, spec, steps }) => ({ id, title, spec, steps })),
    };
  }
  if (command === "check") {
    const { ok: _ok, ...result } = await checkProject(project);
    return result;
  }
  if (command === "url")
    return { url: project.url({ ...args, slug: required(args.slug, "slug") }) };
  if (command.startsWith("flow ") && command !== "flow new") {
    const registry = await project.registry();
    if (command === "flow list") return { flows: registry.flows };
    if (command === "flow coverage")
      return {
        uncovered: registry.warnings
          .filter(w => w.code === "uncovered_state")
          .map(w => ({ proto: w.proto, state: w.state })),
      };
    const flow = registry.flows.find(f => f.id === required(args.id, "id"));
    if (!flow) throw new ProtoError("invalid_config", "Unknown flow");
    return {
      id: flow.id,
      title: flow.title,
      steps: flow.nodes.map(n => ({
        id: n.id,
        step: n.step,
        kind: n.kind,
        ...(n.kind === "prototype" ? { proto: n.proto, state: n.state } : {}),
      })),
      edges: flow.edges,
      problems: registry.problems.filter(p => p.flow === flow.id),
      warnings: registry.warnings,
    };
  }
  if (command === "new" || command === "flow new")
    return scaffold(project, args, command === "flow new");
  if (command === "screenshot" || command === "evidence")
    return capture(project, { ...args, slug: required(args.slug, "slug") }, command === "evidence");
  if (!capability.store) throw new UsageError(`${command} is provided by its delivery slice`);
  const store = project.store();
  const author: Author = { kind: args.author };
  if (command === "comments list")
    return {
      comments: await store.list({
        key: args.slug,
        spec: args.spec,
        state: args.state,
        status: args.status ?? "open",
        authorKind: args["author-kind"],
        waiting: args.waiting,
      }),
    };
  if (command === "comments add") {
    const slug = required(args.slug, "slug");
    const rect = { x: 0, y: 0, width: 0, height: 0 };
    return {
      comment: await store.add(
        slug,
        {
          body: required(args.note, "note"),
          context: {
            commit: commitAt(project.root),
            state: args.state ?? "default",
            theme: args.theme ?? null,
            role: args.role ?? null,
            viewport: { width: args.width ?? 1440, height: 900 },
          },
          target: slug.startsWith("flow-")
            ? { kind: "node", node: args.node ?? null, label: args.node ?? "" }
            : {
                kind: "element",
                selector: required(args.selector, "selector"),
                testId: null,
                tag: "",
                text: "",
                source: args.source ?? null,
                sourceChain: args.source ? [args.source] : [],
                rect,
                rectNormalized: rect,
                offset: null,
              },
        },
        author
      ),
    };
  }
  if (command.startsWith("review ")) {
    const key = required(args.key, "key");
    if (command === "review status") return store.review(key);
    if (command === "review unlock") {
      if (!args.force) throw new UsageError("--force is required");
      return store.unlock(key, { force: true });
    }
    return {
      review: await store.transition(
        key,
        command === "review approve" ? "approved" : "in_review",
        author,
        { commit: commitAt(project.root), confirmOpen: args["confirm-open"] }
      ),
    };
  }
  const id = required(args.id, "id");
  if (command === "comments show") return store.get(id);
  if (command === "comments reply")
    return { comment: await store.reply(id, { body: required(args.note, "note") }, author) };
  if (command === "comments resolve" || command === "comments reopen")
    return {
      comment: await store.setStatus(
        id,
        command === "comments resolve" ? "resolved" : "open",
        author,
        args.note ? { body: args.note } : undefined
      ),
    };
  if (command === "comments delete") {
    await store.remove(id, author);
    return { deleted: id };
  }
  const comment = await store.get(id);
  if (command === "comments attachments") {
    const out = context.transport === "mcp" ? `.tmp/proto/${id}` : (args.out ?? `.tmp/proto/${id}`);
    const directory = confined(project.root, out);
    mkdirSync(directory, { recursive: true });
    const files: string[] = [];
    for (const attachment of comment.thread.flatMap(m => m.attachments)) {
      const downloaded = await store.readAttachment(comment.slug, attachment.id);
      const path = confined(
        project.root,
        join(
          out,
          basename(attachment.id) +
            ({
              "image/png": ".png",
              "image/jpeg": ".jpg",
              "image/webp": ".webp",
              "image/gif": ".gif",
            }[downloaded.type] ?? ".bin")
        )
      );
      writeFileSync(path, downloaded.bytes);
      files.push(relative(project.root, path));
    }
    return { files };
  }
  const message = args.message
    ? comment.thread[args.message - 1]
    : [...comment.thread].reverse().find(m => m.author === author.kind);
  if (!message || message.author !== author.kind) throw new ProtoError("message_not_owned");
  if (command === "comments edit")
    return {
      comment: await store.editMessage(
        id,
        message.id,
        { body: required(args.note, "note") },
        author
      ),
    };
  if (command === "comments detach")
    return {
      comment: await store.editMessage(
        id,
        message.id,
        { detach: [required(args.attachment, "attachment")] },
        author
      ),
    };
  const file = required(args.file, "file");
  const bytes = readFileSync(confined(project.root, file));
  let type: string;
  try {
    type = inspectImage(bytes).type;
  } catch {
    throw new ProtoError(
      bytes.length > 5 * 1024 * 1024 ? "attachment_too_large" : "attachment_type"
    );
  }
  const uploaded = await store.upload(comment.slug, { bytes, name: basename(file), type }, author);
  try {
    return { comment: await store.editMessage(id, message.id, { attach: [uploaded.id] }, author) };
  } catch (error) {
    await store.discard(comment.slug, uploaded.id, author);
    throw error;
  }
}
