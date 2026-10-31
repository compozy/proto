import { existsSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import type { Plugin } from "vite";

export type PresentationBoundary = {
  /** App-relative modules a story or prototype must not reach at runtime (data access, env). */
  modules: readonly string[];
  /** Packages (and their subpaths) a story or prototype must not reach at runtime. */
  packages: readonly string[];
};

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Fails when a story or prototype reaches a forbidden module through runtime imports (type-only
 * imports are erased first). Tracks current imports, including edits while the dev server runs;
 * in a build it reads the bundler's resolved graph.
 */
export function presentationGuard(appRoot: string, boundary: PresentationBoundary): Plugin {
  appRoot = realpathSync(appRoot);
  const imports = new Map<string, Set<string>>();
  const parents = new Map<string, Set<string>>();
  let building = false;
  const forbidden = new Set(boundary.modules.map(file => resolve(appRoot, file)));
  const names = boundary.packages.map(escape).join("|");
  const packageSpecifier = names ? new RegExp(`^(?:${names})(?:/|$)`) : null;
  // Installed location of each package (workspace packages resolve to their real folder).
  const packageDirs = boundary.packages.flatMap(name => {
    for (let dir = appRoot; ; dir = dirname(dir)) {
      const candidate = join(dir, "node_modules", name);
      if (existsSync(candidate)) return [`${realpathSync(candidate)}/`];
      if (dirname(dir) === dir) return [];
    }
  });
  const clean = (id: string) => id.split("?")[0]!;

  function forbiddenPath(id: string, seen = new Set<string>()): string[] | undefined {
    if (
      forbidden.has(id) ||
      packageSpecifier?.test(id) ||
      packageDirs.some(dir => id.startsWith(dir))
    )
      return [id];
    if (seen.has(id)) return;
    seen.add(id);
    for (const dependency of imports.get(id) ?? []) {
      const path = forbiddenPath(dependency, seen);
      if (path) return [id, ...path];
    }
  }

  function violation(id: string) {
    const chain = forbiddenPath(id);
    if (chain)
      return `presentation_boundary: ${relative(appRoot, chain[0]!)} reaches ${relative(appRoot, chain.at(-1)!)}: ${chain.map(id => relative(appRoot, id)).join(" → ")}. Stories and prototypes render views; move data access to the route container.`;
  }

  return {
    name: "gallery:presentation-boundary",
    // Inspect emitted JavaScript so type-only dependencies have already been erased.
    enforce: "post",
    configResolved(config) {
      building = config.command === "build";
    },
    buildStart() {
      imports.clear();
      parents.clear();
    },
    buildEnd(error) {
      if (!building || error) return;
      // The bundler already resolved runtime edges; parsing every dependency again duplicates work.
      for (const id of this.getModuleIds()) {
        const module = this.getModuleInfo(id);
        if (module)
          imports.set(
            clean(id),
            new Set([...module.importedIds, ...module.dynamicallyImportedIds].map(clean))
          );
      }
      for (const id of imports.keys()) {
        if (!/\.(proto|stories)\.[jt]sx?$/.test(id)) continue;
        const message = violation(id);
        if (message) this.error(message);
      }
    },
    async transform(code, source) {
      if (building) return;
      const from = clean(source);
      if (!/\.[cm]?[jt]sx?$/.test(from) || from.includes("\0")) return;
      const syntax = ts.createSourceFile(
        from,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS
      );
      const specifiers = new Set<string>();
      const visit = (node: ts.Node) => {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteralLike(node.moduleSpecifier)
        )
          specifiers.add(node.moduleSpecifier.text);
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments[0] &&
          ts.isStringLiteralLike(node.arguments[0])
        )
          specifiers.add(node.arguments[0].text);
        ts.forEachChild(node, visit);
      };
      visit(syntax);
      const resolved = await Promise.all(
        [...specifiers].map(specifier => this.resolve(specifier, source))
      );
      const dependencies = new Set([
        ...resolved.flatMap(result => (result && !result.external ? [clean(result.id)] : [])),
        ...[...specifiers].filter(specifier => packageSpecifier?.test(specifier)),
      ]);
      // Replace outgoing edges, rather than retaining dependencies removed by an edit.
      for (const previous of imports.get(from) ?? []) parents.get(previous)?.delete(from);
      imports.set(from, dependencies);
      for (const to of dependencies) {
        const importers = parents.get(to) ?? new Set<string>();
        importers.add(from);
        parents.set(to, importers);
      }
      const pending = [from];
      const seen = new Set<string>();
      while (pending.length) {
        const current = pending.pop()!;
        if (seen.has(current)) continue;
        seen.add(current);
        if (/\.(proto|stories)\.[jt]sx?$/.test(current)) {
          const message = violation(current);
          if (message) this.error(message);
        }
        pending.push(...(parents.get(current) ?? []));
      }
    },
  };
}
