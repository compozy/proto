import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import type { StoryRootConfig } from "../config.ts";
import {
  slugPattern,
  storyKey,
  type RegistryStoryFile,
  type RegistryProblem,
  type RegistryWarning,
} from "../model/registry.ts";

type Result = {
  entry: RegistryStoryFile | null;
  problems: RegistryProblem[];
  warnings: RegistryWarning[];
};
const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrap(node.expression)
    : node;
function property(node: ts.Expression | undefined, name: string): ts.Expression | undefined {
  if (!node || !ts.isObjectLiteralExpression(unwrap(node))) return;
  const object = unwrap(node) as ts.ObjectLiteralExpression;
  for (const prop of object.properties) {
    if (prop.name && prop.name.getText().replace(/^["']|["']$/g, "") === name) {
      if (ts.isPropertyAssignment(prop)) return unwrap(prop.initializer);
      if (ts.isMethodDeclaration(prop)) return prop as unknown as ts.Expression;
    }
  }
}
const text = (node: ts.Expression | undefined) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
const strings = (node: ts.Expression | undefined): string[] =>
  node && ts.isArrayLiteralExpression(node) ? node.elements.flatMap(n => text(n) ?? []) : [];
// Ported from Storybook 10.6's public CSF identity semantics.
const sanitize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-= ?;:'",.<>\{\}\[\]\\\/]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
export function storyNameFromExport(name: string) {
  return name
    .replace(/[_\-.]/g, " ")
    .replace(/([^\n])([A-Z])([a-z])/g, "$1 $2$3")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .replace(/([0-9])([a-z])/gi, "$1 $2")
    .replace(/(\s|^)(\w)/g, (_, space: string, char: string) => space + char.toUpperCase())
    .replace(/ +/g, " ")
    .trim();
}
export function storyIdentity(
  meta: { id?: string; title: string; parameters?: { __id?: string } },
  exportName: string
) {
  const slug = sanitize(meta.id ?? meta.title);
  return {
    slug,
    id: meta.parameters?.__id ?? `${slug}--${sanitize(storyNameFromExport(exportName))}`,
  };
}
function matches(node: ts.Expression | undefined, name: string) {
  if (!node) return false;
  if (ts.isRegularExpressionLiteral(node)) {
    const match = /^\/(.*)\/([a-z]*)$/.exec(node.text);
    try {
      return match ? new RegExp(match[1]!, match[2]).test(name) : false;
    } catch {
      return false;
    }
  }
  return strings(node).includes(name);
}
export function mockWarnings(source: string, file: string, root: string): RegistryWarning[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let mock = false;
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(ast) === "sb" &&
      node.expression.name.text === "mock"
    )
      mock = true;
    if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === "mocked")
      mock = true;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return mock
    ? [
        {
          code: "story_mock_unsupported",
          root,
          file,
          message: `${file}: module mocks are not applied`,
        },
      ]
    : [];
}
/** Static CSF discovery. Never imports a preview or a story into Node. */
export function indexStoryFile(source: string, file: string, root: string): Result {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result: Result = { entry: null, problems: [], warnings: mockWarnings(source, file, root) };
  const diagnostics = (ast as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  for (const diagnostic of diagnostics) {
    const at = ast.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    result.problems.push({
      code: "story_parse",
      root,
      file,
      line: at.line + 1,
      column: at.character + 1,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    });
  }
  if (diagnostics.length) return result;
  const assigned = new Map<string, Map<string, ts.Expression>>();
  const variables = new Map<string, ts.Expression>();
  const exports = new Map<string, ts.Expression>();
  let meta: ts.Expression | undefined;
  for (const statement of ast.statements) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        variables.set(declaration.name.text, unwrap(declaration.initializer));
        if (statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))
          exports.set(declaration.name.text, unwrap(declaration.initializer));
      }
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      exports.set(statement.name.text, statement as unknown as ts.Expression);
    if (ts.isExportAssignment(statement)) meta = unwrap(statement.expression);
  }
  if (meta && ts.isIdentifier(meta)) meta = variables.get(meta.text);
  for (const statement of ast.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (
        !statement.exportClause ||
        !ts.isNamedExports(statement.exportClause) ||
        statement.moduleSpecifier
      ) {
        result.problems.push({
          code: "story_parse",
          root,
          file,
          message: "Re-exported stories cannot be indexed statically",
        });
        continue;
      }
      for (const item of statement.exportClause.elements) {
        const value = variables.get((item.propertyName ?? item.name).text);
        if (value) exports.set(item.name.text, value);
      }
    }
  }
  for (const statement of ast.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression))
      continue;
    const expression = statement.expression;
    if (
      expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
      !ts.isPropertyAccessExpression(expression.left) ||
      !ts.isIdentifier(expression.left.expression)
    )
      continue;
    const name = expression.left.expression.text;
    const fields = assigned.get(name) ?? new Map<string, ts.Expression>();
    fields.set(expression.left.name.text, unwrap(expression.right));
    assigned.set(name, fields);
  }
  const field = (name: string, key: string) =>
    assigned.get(name)?.get(key) ?? property(exports.get(name), key);
  const literalTitle = text(property(meta, "title"));
  const title = literalTitle ?? file.replace(/\.(stories|story)\.[^.]+$/, "").replace(/^\.\//, "");
  const id = text(property(meta, "id"));
  const slug = storyIdentity({ title, id }, "").slug;
  if (!literalTitle)
    result.warnings.push({
      code: "story_title_dynamic",
      root,
      file,
      message: `${file}: using path title ${title}`,
    });
  const include = property(meta, "includeStories"),
    exclude = property(meta, "excludeStories");
  const order = strings(exports.get("__namedExportsOrder"));
  const names = [...exports.keys()].filter(
    name =>
      name !== "__namedExportsOrder" &&
      name !== "__esModule" &&
      (!include || matches(include, name)) &&
      !matches(exclude, name)
  );
  names.sort(
    (a, b) =>
      (order.includes(a) ? order.indexOf(a) : Infinity) -
      (order.includes(b) ? order.indexOf(b) : Infinity)
  );
  if (!names.length) return result;
  if (id?.includes("--") || !slugPattern.test(slug) || storyKey(slug).length > 200) {
    result.problems.push({
      code: "story_slug_invalid",
      root,
      file,
      message: `Invalid component slug: ${slug}`,
    });
    return result;
  }
  const stories = names.map(exportName => {
    const explicitId =
      text(property(field(exportName, "parameters"), "__id")) ??
      text(property(property(meta, "parameters"), "__id"));
    return {
      id: storyIdentity({ title, id, parameters: { __id: explicitId } }, exportName).id,
      exportName,
      name:
        text(field(exportName, "name")) ??
        text(field(exportName, "storyName")) ??
        storyNameFromExport(exportName),
      play: !!(field(exportName, "play") ?? property(meta, "play")),
      tags: [
        ...new Set([...strings(property(meta, "tags")), ...strings(field(exportName, "tags"))]),
      ],
    };
  });
  result.entry = {
    slug,
    root,
    file,
    title,
    path: title.split("/"),
    description:
      text(
        property(
          property(property(property(meta, "parameters"), "docs"), "description"),
          "component"
        )
      ) ?? null,
    stories: stories as RegistryStoryFile["stories"],
  };
  return result;
}
export type StoryCache = Map<string, { stamp: string; result: Result }>;
export function indexStories(
  app: string,
  roots: readonly StoryRootConfig[],
  cache: StoryCache = new Map()
) {
  const entries: RegistryStoryFile[] = [],
    problems: RegistryProblem[] = [],
    warnings: RegistryWarning[] = [];
  const live = new Set<string>();
  for (const root of roots) {
    const dir = resolve(app, root.dir ?? ".");
    const preview = resolve(dir, root.preview);
    if (!existsSync(preview))
      problems.push({
        code: "story_preview_missing",
        root: root.id,
        file: root.preview,
        message: `Missing preview: ${preview}`,
      });
    else warnings.push(...mockWarnings(readFileSync(preview, "utf8"), root.preview, root.id));
    const files = globSync(typeof root.stories === "string" ? [root.stories] : [...root.stories], {
      cwd: dir,
      exclude: ["**/node_modules/**"],
    }).sort();
    if (!files.length)
      warnings.push({
        code: "story_glob_empty",
        root: root.id,
        message: `${root.id}: no story files matched`,
      });
    for (const file of files) {
      const absolute = resolve(dir, file),
        key = `${root.id}:${absolute}`;
      const info = statSync(absolute);
      if (!info.isFile()) continue;
      live.add(key);
      const stamp = `${info.mtimeMs}:${info.size}`;
      let saved = cache.get(key);
      if (!saved || saved.stamp !== stamp) {
        saved = {
          stamp,
          result: indexStoryFile(
            readFileSync(absolute, "utf8"),
            relative(dir, absolute).replaceAll("\\", "/"),
            root.id
          ),
        };
        cache.set(key, saved);
      }
      if (saved.result.entry) entries.push(saved.result.entry);
      problems.push(...saved.result.problems);
      warnings.push(...saved.result.warnings);
    }
  }
  for (const key of cache.keys()) if (!live.has(key)) cache.delete(key);
  const bad = new Set<RegistryStoryFile>();
  const slugs = new Map<string, RegistryStoryFile>(),
    ids = new Map<string, RegistryStoryFile>();
  for (const entry of entries) {
    const previous = slugs.get(entry.slug);
    if (previous) {
      bad.add(entry);
      bad.add(previous);
      problems.push({
        code: "story_slug_duplicate",
        root: entry.root,
        file: entry.file,
        message: `Duplicate slug ${entry.slug}: ${previous.root}/${previous.file} and ${entry.root}/${entry.file}`,
      });
    }
    slugs.set(entry.slug, entry);
    for (const story of entry.stories) {
      const previous = ids.get(story.id);
      if (previous) {
        bad.add(entry);
        bad.add(previous);
        problems.push({
          code: "story_id_duplicate",
          root: entry.root,
          file: entry.file,
          message: `Duplicate id ${story.id}: ${previous.root}/${previous.file} and ${entry.root}/${entry.file}`,
        });
      }
      ids.set(story.id, entry);
    }
  }
  return { entries: entries.filter(entry => !bad.has(entry)), problems, warnings };
}
