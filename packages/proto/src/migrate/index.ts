import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readFile, readdir, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { z } from "zod";
import { ProtoError, type ErrorCode } from "../model/errors.ts";
import { upgradeReviewFile, type Rewrite, type UpgradeOptions } from "../model/upgrade.ts";
import { reviewFileSchema } from "../model/review.ts";
import { resolveProtoConfig, type ProtoConfig } from "../config.ts";
import { readLiteral } from "../node/literal.ts";
import { atomicWrite } from "../store/file-store.ts";
import { KeyLocks } from "../store/lock.ts";
export type MigrateOptions = UpgradeOptions & { from: string; dryRun?: boolean };
export type MigratedAttachment = {
  id: string;
  source: string;
  target: string;
  bytes: number;
  sha256: string;
};
export type MigrationKey = {
  sourceKey: string;
  key: string;
  sourceVersion: number;
  sourceSha256: string;
  comments: number;
  messages: number;
  attachments: MigratedAttachment[];
  sequence: number;
  status: "planned" | "migrated" | "unchanged" | "conflict" | "failed";
  verified: boolean;
  rewrites: Rewrite[];
  notes: string[];
  error?: { code: ErrorCode; message: string };
};
export type MigrationReport = {
  version: 1;
  source: string;
  target: string;
  dryRun: boolean;
  verified: boolean;
  keys: MigrationKey[];
  errors: { key?: string; code: ErrorCode; message: string }[];
  config: { path: string; status: "absent" | "existing" | "planned" | "written" | "failed" };
  deletable: string[];
  notes: string[];
};
const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const posix = (path: string) => path.replaceAll("\\", "/");
async function maybeRead(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}
async function writeBytes(path: string, bytes: Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
/** Legacy config is data: extract the default literal without executing imports. */
function legacyConfig(source: string, root: string): ProtoConfig {
  const file = ts.createSourceFile("gallery.config.ts", source, ts.ScriptTarget.Latest, true);
  const exported = file.statements.find(ts.isExportAssignment);
  if (!exported) throw new ProtoError("invalid_config", "gallery.config.ts has no default export.");
  let value = exported.expression;
  if (ts.isCallExpression(value) && value.arguments[0]) value = value.arguments[0];
  const labels = z.record(z.string(), z.string());
  const literal = z
    .object({
      title: z.string(),
      specs: labels.optional(),
      roles: labels.optional(),
      siteUrl: z.string().optional(),
    })
    .parse(readLiteral(value));
  const config = resolveProtoConfig(literal, root, {});
  return {
    title: config.title,
    ...(literal.specs ? { specs: literal.specs } : {}),
    ...(literal.roles ? { roles: literal.roles } : {}),
    ...(literal.siteUrl ? { siteUrl: literal.siteUrl } : {}),
  };
}
async function usesPresentation(path: string) {
  const bytes = await maybeRead(path);
  if (!bytes) return false;
  const file = ts.createSourceFile(path, bytes.toString(), ts.ScriptTarget.Latest, true);
  const names = new Set<string>();
  let called = false;
  for (const statement of file.statements)
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "@compozy/proto/vite"
    ) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const item of bindings.elements)
          if ((item.propertyName ?? item.name).text === "protoPresentation")
            names.add(item.name.text);
    }
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      names.has(node.expression.text)
    )
      called = true;
    ts.forEachChild(node, visit);
  }
  visit(file);
  return called;
}
async function migrateConfig(root: string, dryRun: boolean, report: MigrationReport) {
  const destination = join(root, "proto.config.ts");
  if (await maybeRead(destination)) {
    report.config.status = "existing";
    return;
  }
  const source = await maybeRead(join(root, "gallery.config.ts"));
  if (!source) return;
  const config = legacyConfig(source.toString(), root);
  report.config.status = dryRun ? "planned" : "written";
  if (!dryRun) {
    // Exclusive creation: a concurrently created config is never overwritten.
    try {
      await writeFile(
        destination,
        `// Migrated from gallery.config.ts.\nexport default ${JSON.stringify(config, null, 2)};\n`,
        { flag: "wx" }
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") report.config.status = "existing";
      else throw error;
    }
  }
}
export async function migrateFiles(
  root: string,
  options: MigrateOptions
): Promise<MigrationReport> {
  root = resolve(root);
  const source = resolve(root, options.from),
    destination = join(root, "proto/review");
  if (source === destination || destination.startsWith(source + "/"))
    throw new ProtoError("invalid_input", "Migration source must be separate from proto/review.");
  const dryRun = options.dryRun ?? false;
  const report: MigrationReport = {
    version: 1,
    source: posix(relative(root, source)),
    target: "proto/review",
    dryRun,
    verified: false,
    keys: [],
    errors: [],
    config: { path: "proto.config.ts", status: "absent" },
    deletable: [],
    notes: [],
  };
  let entries;
  try {
    entries = await readdir(source, { withFileTypes: true });
  } catch (error) {
    if (missing(error))
      throw new ProtoError("invalid_input", "Migration source directory does not exist.");
    throw error;
  }
  try {
    await migrateConfig(root, dryRun, report);
  } catch (error) {
    report.config.status = "failed";
    report.errors.push({
      code: "invalid_config",
      message: error instanceof Error ? error.message : "Cannot migrate config",
    });
  }
  if (!dryRun) {
    await mkdir(destination, { recursive: true });
    try {
      await writeFile(join(destination, ".gitignore"), "*.lock*\n*.tmp\n.pending/\n", {
        flag: "wx",
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  const locks = new KeyLocks(destination);
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const sourcePath = join(source, entry.name, "comments.json"),
      bytes = await maybeRead(sourcePath);
    if (!bytes) continue;
    const item: MigrationKey = {
      sourceKey: entry.name,
      key: entry.name,
      sourceVersion: 0,
      sourceSha256: hash(bytes),
      comments: 0,
      messages: 0,
      attachments: [],
      sequence: 0,
      status: "planned",
      verified: false,
      rewrites: [],
      notes: [],
    };
    report.keys.push(item);
    try {
      const raw: unknown = JSON.parse(bytes.toString());
      const header = z
        .object({
          version: z.number(),
          slug: z.string().optional(),
          key: z.string().optional(),
          sequence: z.number().optional(),
        })
        .parse(raw);
      item.sourceVersion = header.version;
      if ((header.slug ?? header.key) !== entry.name)
        throw new ProtoError("migration_unverified", "Source folder and file key differ.");
      const upgraded = upgradeReviewFile(raw, options);
      if (!upgraded.ok) throw new ProtoError("migration_unverified", upgraded.issues.join("; "));
      const file = upgraded.file;
      item.key = file.key;
      item.sequence = file.sequence;
      item.rewrites = upgraded.rewrites;
      item.comments = file.comments.length;
      item.messages = file.comments.reduce((sum, comment) => sum + comment.thread.length, 0);
      if (header.sequence === undefined)
        item.notes.push(
          "Sequence seeded from retained ids; ids deleted before migration cannot be recovered."
        );
      const images = new Map<string, { report: MigratedAttachment; data: Buffer }>();
      for (const image of file.comments.flatMap(comment =>
        comment.thread.flatMap(message => message.attachments)
      )) {
        if (!/^[a-zA-Z0-9_-]{1,200}$/.test(image.id) || !extensions[image.type])
          throw new ProtoError("migration_unverified", "Invalid attachment id or MIME type.");
        const name = `${image.id}.${extensions[image.type]}`;
        const imageSource = join(source, entry.name, "attachments", name),
          imageTarget = join(destination, file.key, "attachments", name);
        const data = await maybeRead(imageSource);
        if (!data || data.length !== image.size)
          throw new ProtoError(
            "migration_unverified",
            `Missing or wrong-size attachment ${image.id}.`
          );
        const info: MigratedAttachment = {
          id: image.id,
          source: posix(relative(root, imageSource)),
          target: posix(relative(root, imageTarget)),
          bytes: data.length,
          sha256: hash(data),
        };
        const previous = images.get(image.id);
        if (previous && !isDeepStrictEqual(previous.report, info))
          throw new ProtoError("migration_unverified", `Conflicting attachment ${image.id}.`);
        images.set(image.id, { report: info, data });
      }
      item.attachments = [...images.values()].map(image => image.report);
      const migrateKey = async () => {
        const target = join(destination, `${file.key}.json`),
          existing = await maybeRead(target);
        if (existing) {
          let parsed: unknown = null;
          try {
            parsed = JSON.parse(existing.toString());
            reviewFileSchema.parse(parsed);
          } catch {
            /* Invalid targets are conflicts, never overwritten. */
          }
          if (!isDeepStrictEqual(parsed, file))
            throw new ProtoError(
              "migration_conflict",
              `Target key ${file.key} has different content.`
            );
        }
        const pending: { target: string; data: Buffer }[] = [];
        for (const image of images.values()) {
          const path = resolve(root, image.report.target),
            existingImage = await maybeRead(path);
          if (existingImage && hash(existingImage) !== image.report.sha256)
            throw new ProtoError(
              "migration_conflict",
              `Target image ${image.report.id} has different bytes.`
            );
          if (!existingImage) pending.push({ target: path, data: image.data });
        }
        if (dryRun) {
          item.status = existing && !pending.length ? "unchanged" : "planned";
          return;
        }
        for (const image of pending) await writeBytes(image.target, image.data);
        // Re-read source inputs before publishing the key; changed files never receive a verified report.
        if (hash(await readFile(sourcePath)) !== item.sourceSha256)
          throw new ProtoError("migration_unverified", "Source changed during migration.");
        for (const image of images.values())
          if (hash(await readFile(resolve(root, image.report.source))) !== image.report.sha256)
            throw new ProtoError(
              "migration_unverified",
              `Source image ${image.report.id} changed during migration.`
            );
        if (!existing) await atomicWrite(target, file);
        if (
          !isDeepStrictEqual(
            reviewFileSchema.parse(JSON.parse(await readFile(target, "utf8"))),
            file
          )
        )
          throw new ProtoError("migration_unverified", `Verification failed for ${file.key}.`);
        for (const image of images.values())
          if (hash(await readFile(resolve(root, image.report.target))) !== image.report.sha256)
            throw new ProtoError(
              "migration_unverified",
              `Image verification failed for ${image.report.id}.`
            );
        item.verified = true;
        item.status = existing && !pending.length ? "unchanged" : "migrated";
      };
      if (dryRun) await migrateKey();
      else await locks.run(file.key, migrateKey);
    } catch (error) {
      const problem =
        error instanceof ProtoError
          ? error
          : new ProtoError(
              "migration_unverified",
              error instanceof Error ? error.message : "Migration failed"
            );
      item.status = problem.code === "migration_conflict" ? "conflict" : "failed";
      item.error = { code: problem.code, message: problem.message };
      report.errors.push({ key: item.key, ...item.error });
    }
  }
  report.verified = !dryRun && report.errors.length === 0 && report.keys.every(key => key.verified);
  if (report.verified) {
    report.deletable.push(report.source);
    if (report.config.status === "written") {
      if (await maybeRead(join(root, "gallery.config.ts")))
        report.deletable.push("gallery.config.ts");
    }
    if (
      (await usesPresentation(join(root, ".storybook/main.ts"))) &&
      (await usesPresentation(join(root, "vitest.config.ts")))
    ) {
      if (await maybeRead(join(root, "vite.presentation.ts")))
        report.deletable.push("vite.presentation.ts");
      // Keep preview when the new canvas still imports from it.
      const canvas = await maybeRead(join(root, "proto.canvas.tsx"));
      if (canvas && !/\bpreview\//.test(canvas.toString())) {
        try {
          if ((await readdir(root)).includes("preview")) report.deletable.push("preview/");
        } catch {
          /* No optional preview directory. */
        }
      }
    } else
      report.notes.push(
        "Switch Storybook and Vitest to protoPresentation() before deleting vite.presentation.ts or preview/."
      );
  }
  if (!dryRun) await atomicWrite(join(root, "proto-migration-report.json"), report);
  return report;
}
