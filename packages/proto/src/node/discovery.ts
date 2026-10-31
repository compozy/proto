import { existsSync, readdirSync, readFileSync, globSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import type { PrototypeMeta } from "../contract.ts";
import type { ResolvedGalleryConfig } from "../config.ts";
import { flowKeyPrefix } from "../flow.ts";
import { readLiteral } from "./literal.ts";

export type PrototypeKind = "component" | "draft";
export type PrototypeEntry = {
  slug: string;
  kind: PrototypeKind;
  file: string;
  meta: PrototypeMeta | null;
};
export type ProblemCode =
  | "duplicate_slug"
  | "invalid_slug"
  | "outside_root"
  | "missing_meta"
  | "markup"
  | "presentation_boundary"
  | "reserved_slug"
  | "invalid_meta"
  | "duplicate_state"
  | "unknown_spec"
  | "unknown_role";
export type Problem = {
  slug: string | null;
  file: string;
  code: ProblemCode;
  message: string;
  line?: number;
  column?: number;
};

function files(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? files(path)
      : entry.isFile() && entry.name.endsWith(".proto.tsx")
        ? [path]
        : [];
  });
}

function metadata(source: ts.SourceFile): PrototypeMeta | null {
  for (const statement of source.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      const value = declaration.initializer;
      if (
        declaration.name.getText(source) !== "meta" ||
        !value ||
        !ts.isCallExpression(value) ||
        value.expression.getText(source) !== "definePrototype" ||
        !value.arguments[0]
      )
        continue;
      try {
        const raw: unknown = readLiteral(value.arguments[0]);
        const meta = raw as PrototypeMeta;
        if (
          ![meta.title].every(item => typeof item === "string" && item.trim().length > 0) ||
          !Array.isArray(meta.states) ||
          !meta.states.length ||
          !meta.states.every(
            state =>
              state &&
              typeof state.id === "string" &&
              state.id.length > 0 &&
              typeof state.label === "string" &&
              state.label.length > 0
          )
        )
          return null;

        if (
          meta.roles !== undefined &&
          (!Array.isArray(meta.roles) ||
            !meta.roles.length ||
            !meta.roles.every(role => typeof role === "string"))
        )
          return null;
        if (
          [meta.surface, meta.route, meta.spec].some(
            value => value !== undefined && (typeof value !== "string" || !value.trim())
          )
        )
          return null;
        if (meta.standalone !== undefined && typeof meta.standalone !== "boolean") return null;
        if (
          meta.blocks !== undefined &&
          (!Array.isArray(meta.blocks) || !meta.blocks.every(block => typeof block === "string"))
        )
          return null;
        return meta;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Every `*.proto.tsx` under the app's `src`: colocated component prototypes anywhere, drafts in
 * `src/drafts/<slug>/index.proto.tsx`. Metadata is read statically and checked against `config`.
 */
export function findPrototypes(
  appRoot: string,
  repoRoot: string,
  config: Omit<ResolvedGalleryConfig, "specs"> & {
    specs: Record<string, string> | null;
    prototypes?: string | readonly string[];
    drafts?: string;
  }
) {
  const entries: PrototypeEntry[] = [];
  const problems: Problem[] = [];
  const paths = config.prototypes
    ? globSync(
        [...(typeof config.prototypes === "string" ? [config.prototypes] : config.prototypes)],
        { cwd: appRoot }
      ).map(file => resolve(appRoot, file))
    : files(join(appRoot, "src"));
  for (const path of paths
    .filter(path => !/(?:\.pending\/|\.lock|\.tmp)/.test(relative(appRoot, path)))
    .sort()) {
    const local = relative(appRoot, path);
    const file = relative(repoRoot, path);
    const parts = local.split("/");
    const name = parts.at(-1)!;
    const slug = name === "index.proto.tsx" ? parts.at(-2)! : name.slice(0, -10);
    const draftLocal = relative(resolve(appRoot, config.drafts ?? "src/drafts"), path);
    const kind = !draftLocal.startsWith("..") ? "draft" : "component";
    const report = (code: ProblemCode, message: string) =>
      problems.push({ slug, file, code, message });
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120)
      report("invalid_slug", `Invalid prototype slug "${slug}" (${file})`);
    else if (slug.startsWith(flowKeyPrefix))
      report(
        "reserved_slug",
        `"${flowKeyPrefix}" is reserved for flow comments: "${slug}" (${file})`
      );
    if (kind === "draft" && !/^[^/]+\/index\.proto\.tsx$/.test(draftLocal))
      report("invalid_meta", `${file}: drafts live in src/drafts/<slug>/index.proto.tsx`);
    const previous = entries.find(entry => entry.slug === slug);
    if (previous)
      report("duplicate_slug", `Duplicate prototype slug "${slug}": ${previous.file} and ${file}`);
    const source = ts.createSourceFile(
      file,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const meta = metadata(source);
    if (!meta)
      report(
        "invalid_meta",
        `${slug}: missing or invalid export meta (specs and roles must exist in gallery.config.ts)`
      );
    if (!meta) {
      const declaration = source.statements.find(
        statement =>
          ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            d => ts.isIdentifier(d.name) && d.name.text === "meta"
          )
      );
      const at = source.getLineAndCharacterOfPosition(declaration?.getStart(source) ?? 0);
      Object.assign(problems.at(-1)!, { line: at.line + 1, column: at.character + 1 });
    }
    if (meta) {
      if (new Set(meta.states.map(s => s.id)).size !== meta.states.length)
        report("duplicate_state", "State ids must be unique");
      if (meta.spec && config.specs !== null && !Object.hasOwn(config.specs, meta.spec))
        report("unknown_spec", `Unknown spec ${meta.spec}`);
      for (const role of meta.roles ?? [])
        if (!Object.hasOwn(config.roles, role)) report("unknown_role", `Unknown role ${role}`);
    }
    if (kind === "component") {
      const visit = (node: ts.Node) => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          /^[a-z]/.test(node.tagName.getText(source))
        ) {
          const at = source.getLineAndCharacterOfPosition(node.getStart(source));
          report(
            "markup",
            `Component prototypes render components only: <${node.tagName.getText(source)}> at ${file}:${at.line + 1}:${at.character + 1}. Move the markup into a view component.`
          );
          Object.assign(problems.at(-1)!, { line: at.line + 1, column: at.character + 1 });
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    entries.push({ slug, kind, file, meta });
  }
  return { entries, problems };
}
