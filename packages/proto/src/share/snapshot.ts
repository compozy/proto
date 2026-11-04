import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile, readlink, rename, rm, symlink } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { ProtoError } from "../model/errors.ts";
import { bootstrapSchema } from "../model/bootstrap.ts";
import { buildProject } from "../node/build.ts";
import type { ProtoProject } from "../node/project.ts";

const exec = promisify(execFile);

export type ShareTarget =
  | { kind: "prototype"; slug: string }
  | { kind: "flow"; id: string }
  | { kind: "all" };

/** All build consumers discover through registry(), including the render import graph. */
export function scopedProject(project: ProtoProject, target: ShareTarget): ProtoProject {
  return {
    ...project,
    async registry() {
      const registry = await project.registry();
      if (target.kind === "all") return registry;
      const flows = registry.flows.filter(flow => target.kind === "flow" && flow.id === target.id);
      const slugs = new Set(
        target.kind === "prototype"
          ? [target.slug]
          : flows.flatMap(flow =>
              flow.nodes.flatMap(node => (node.kind === "prototype" ? [node.proto] : []))
            )
      );
      const prototypes = registry.prototypes.filter(proto => slugs.has(proto.slug));
      if (target.kind === "prototype" ? !prototypes.length : !flows.length)
        throw new ProtoError("share_target_not_found");
      const files = new Set([...prototypes, ...flows].map(item => item.file));
      const specs = new Set([
        ...prototypes.map(proto => proto.spec),
        ...flows.flatMap(flow => [flow.spec, ...flow.specs]),
      ]);
      return {
        ...registry,
        prototypes,
        flows,
        specs:
          registry.specs === null
            ? null
            : Object.fromEntries(Object.entries(registry.specs).filter(([id]) => specs.has(id))),
        problems: registry.problems.filter(
          problem => files.has(problem.file) || problem.file === project.config.canvas
        ),
        warnings: registry.warnings.filter(warning =>
          warning.file
            ? files.has(warning.file) || warning.file === project.config.canvas
            : warning.proto
              ? slugs.has(warning.proto)
              : true
        ),
      };
    },
  };
}

export function shareDirectory(root: string): string {
  return join(root, "node_modules/.cache/compozy-proto/share");
}

export type DirtyTree = { commit: string | null; dirty: boolean; approvable: boolean };

/** Check the entire workspace, excluding only mutable review and build artifacts. */
export async function checkDirtyTree(
  root: string,
  options: { approvers?: boolean; before?: DirtyTree } = {}
): Promise<DirtyTree> {
  let commit: string | null = null;
  let dirty = true;
  try {
    const git = async (args: string[], cwd: string) =>
      (await exec("git", args, { cwd, encoding: "utf8" })).stdout.trim();
    const top = await git(["rev-parse", "--show-toplevel"], root);
    const path = (file: string) => relative(top, file).replaceAll("\\", "/");
    commit = await git(["rev-parse", "HEAD"], top);
    const status = await git(
      [
        "status",
        "--porcelain",
        "--untracked-files=normal",
        "--",
        ".",
        `:(exclude)${path(join(root, "proto/review"))}`,
        `:(exclude)${path(shareDirectory(root))}`,
        `:(glob,exclude)${path(join(root, ".proto-build-*"))}`,
      ],
      top
    );
    // Re-read HEAD so a commit made while status runs also invalidates the check.
    dirty = !!status || commit !== (await git(["rev-parse", "HEAD"], top));
  } catch {
    // No repository, unborn HEAD or an unreadable status cannot certify an approval.
    dirty = true;
  }
  dirty ||= !!options.before && (options.before.dirty || options.before.commit !== commit);
  const result = { commit, dirty, approvable: !dirty && commit !== null };
  if (options.approvers && !result.approvable) throw new ProtoError("share_dirty_tree");
  return result;
}

/** Start-only cleanup: never call while another build for this app is running. */
export async function cleanupBuildDirectories(root: string): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true }))
    if (entry.isDirectory() && entry.name.startsWith(".proto-build-"))
      await rm(join(root, entry.name), { recursive: true, force: true });
}

/** Stop and next-start cleanup. Session.ts owns serialization with builds and requests. */
export async function cleanupSnapshots(root: string): Promise<void> {
  await rm(shareDirectory(root), { recursive: true, force: true });
  await cleanupBuildDirectories(root);
}

export type SnapshotResult = {
  snapshot: string;
  commit: string | null;
  approvable: boolean;
  output: string;
  warnings: Awaited<ReturnType<ProtoProject["registry"]>>["warnings"];
};

/** Build and certify before swapping. A failed build/check leaves current untouched. */
export async function buildAndSwap(
  project: ProtoProject,
  target: ShareTarget,
  options: { remote: string; approvers: boolean; shellDir?: string }
): Promise<SnapshotResult> {
  const before = await checkDirtyTree(project.root, { approvers: options.approvers });
  const snapshot = randomUUID();
  const directory = shareDirectory(project.root);
  const output = join(directory, snapshot);
  const current = join(directory, "current");
  const temporary = join(directory, `.current-${snapshot}`);
  let published = false;
  try {
    const result = await buildProject(scopedProject(project, target), {
      remote: options.remote,
      shellDir: options.shellDir,
      output,
      snapshot,
    });
    const after = await checkDirtyTree(project.root, { approvers: options.approvers, before });
    const bootstrap = bootstrapSchema.parse(
      JSON.parse(await readFile(join(output, "__proto/bootstrap.json"), "utf8"))
    );
    let previous: string | undefined;
    try {
      previous = resolve(directory, await readlink(current));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await symlink(
      process.platform === "win32" ? output : snapshot,
      temporary,
      process.platform === "win32" ? "junction" : "dir"
    );
    // Prune before the final swap so a cleanup error cannot report a failed refresh
    // after replacing the live version. The currently served directory always stays.
    for (const entry of await readdir(directory, { withFileTypes: true }))
      if (
        entry.isDirectory() &&
        entry.name !== snapshot &&
        join(directory, entry.name) !== previous
      )
        await rm(join(directory, entry.name), { recursive: true, force: true });
    await rename(temporary, current);
    published = true;
    return { ...result, snapshot, commit: bootstrap.commit, approvable: after.approvable };
  } finally {
    await rm(temporary, { force: true });
    if (!published) await rm(output, { recursive: true, force: true });
  }
}
