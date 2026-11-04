import { runStories } from "../node/story-runner.ts";
import { storyOfKey } from "../model/registry.ts";
import { mapConcurrent } from "../node/concurrency.ts";
import { z } from "zod";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, matchesGlob } from "node:path";
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
  ...[
    "share",
    "share connect",
    "share disconnect",
    "share status",
    "share refresh",
    "share stop",
  ].map(cli =>
    row(cli, cli === "share" ? ["slug"] : [], false, "Sharing is CLI-only", "process lifecycle")
  ),
  row("list"),
  row("stories list"),
  row("stories run"),
  row("stories url", ["id"]),
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
    row(
      cli,
      cli === "auth revoke" ? ["id"] : [],
      false,
      "Credentials require a browser session",
      "session"
    )
  ),
];
export const exclusions = [
  {
    capability: "discard pending upload",
    reason: "Composer cleanup uses store.discard; no CLI or MCP operation",
  },
];
export const argumentSchema = z.object({
  root: z.string().optional(),
  filter: z.string().optional(),
  concurrency: z.coerce.number().int().min(1).max(32).optional(),
  timeout: z.coerce.number().int().positive().optional(),
  from: z.string().optional(),
  "from-database": z.string().optional(),
  "to-database": z.string().optional(),
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
  open: z.boolean().optional(),
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
/** Dispatch the shared CLI/MCP capability contract while enforcing transport and remote authority. */
export async function executeCapability(
  capability: Capability,
  args: Arguments,
  context: CapabilityContext
): Promise<unknown> {
  const command = capability.cli;
  if (command === "comments add" && args.slug && storyOfKey(args.slug) !== null && !args.state)
    throw new ProtoError("invalid_input", "--state is required on story keys.");
  if (args.remote) {
    if (
      command === "review approve" ||
      command === "review reopen" ||
      command === "comments delete"
    )
      throw new ProtoError("scope_denied");
    if (!capability.store && command !== "url")
      throw new UsageError("This command does not support --remote");
    if (command === "review unlock") throw new ProtoError("scope_denied", "Unlock is local only.");
  }
  if (command === "init") return initProject(context.root, args);
  const project = context.project;
  if (!project) throw new ProtoError("invalid_config", "Project was not loaded");
  if (command.startsWith("stories ")) {
    if (command === "stories run") {
      if (context.transport === "mcp" && !args.root && !args.filter)
        throw new ProtoError("invalid_input", "root or filter is required.");
      const controller = new AbortController();
      const interrupt = () => controller.abort();
      if (context.transport === "cli") {
        process.once("SIGINT", interrupt);
        process.once("SIGTERM", interrupt);
      }
      try {
        const report = await runStories(project, { ...args, signal: controller.signal });
        const passed = report.results.filter(row => row.status === "passed").length;
        return {
          summary: { total: report.results.length, passed, failed: report.results.length - passed },
          stories: report.results,
          ...(report.problems.length ? { problems: report.problems } : {}),
          ...(report.warnings.length ? { warnings: report.warnings } : {}),
        };
      } finally {
        process.removeListener("SIGINT", interrupt);
        process.removeListener("SIGTERM", interrupt);
      }
    }
    const registry = await project.registry();
    if (args.root && !registry.storyRoots?.some(root => root.id === args.root))
      throw new ProtoError("invalid_input", `Unknown root "${args.root}".`);
    if (command === "stories url") {
      const id = required(args.id, "id");
      const file = registry.stories?.find(file => file.stories.some(story => story.id === id));
      if (!file) throw new ProtoError("story_not_found", `No story matches ${id}.`);
      const url = new URL(`http://127.0.0.1:${args.port ?? project.config.dev.port}/`);
      url.searchParams.set("c", file.slug);
      url.searchParams.set("story", id);
      return { url: url.href };
    }
    const stories = (registry.stories ?? [])
      .filter(file => !args.root || file.root === args.root)
      .map(file => ({
        ...file,
        stories: file.stories.filter(story => !args.filter || matchesGlob(story.id, args.filter)),
      }))
      .filter(file => file.stories.length);
    return {
      roots: (registry.storyRoots ?? [])
        .filter(root => !args.root || root.id === args.root)
        .map(root => {
          const files = stories.filter(file => file.root === root.id);
          return {
            id: root.id,
            files: files.length,
            stories: files.reduce((sum, file) => sum + file.stories.length, 0),
          };
        }),
      stories,
    };
  }
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
    return {
      url: project.url({ ...args, slug: required(args.slug, "slug") }, { remote: args.remote }),
    };
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
  const store = project.store({ remote: args.remote });
  const author: Author = args.remote
    ? {
        kind: "agent",
        ...("session" in store
          ? { id: (await (store as import("../store/http-store.ts").HttpStore).session()).id }
          : {}),
      }
    : { kind: args.author };
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
    const component = storyOfKey(slug);
    if (component !== null) {
      const registry = await project.registry();
      const file = registry.stories?.find(file => file.slug === component);
      if (!file?.stories.some(story => story.id === args.state))
        throw new ProtoError("invalid_input", `No story matches ${args.state}.`);
    }
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
    const files = await mapConcurrent(
      comment.thread.flatMap(m => m.attachments),
      async attachment => {
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
        return relative(project.root, path);
      }
    );
    return { files };
  }
  const message = args.message
    ? comment.thread[args.message - 1]
    : [...comment.thread]
        .reverse()
        .find(m => (args.remote ? m.authorId === author.id : m.author === author.kind));
  if (!message || (args.remote ? message.authorId !== author.id : message.author !== author.kind))
    throw new ProtoError("message_not_owned");
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
