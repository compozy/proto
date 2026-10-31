import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  realpathSync,
  copyFileSync,
} from "node:fs";
import { resolve, dirname, basename, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { ProtoProject } from "./project.ts";
import { ProtoError } from "../model/errors.ts";
import { slugPattern } from "../model/registry.ts";
export function confined(root: string, path: string) {
  const file = resolve(root, path);
  let ancestor = file;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const inside = (candidate: string) =>
    candidate === realpathSync(root) || candidate.startsWith(realpathSync(root) + sep);
  if (!inside(file) || !inside(realpathSync(ancestor)))
    throw new ProtoError("invalid_source", "Path must stay inside the app root");
  return file;
}
function write(root: string, file: string, content: string, force = false) {
  const target = confined(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, { flag: force ? "w" : "wx" });
}
export async function scaffold(
  project: ProtoProject,
  args: { slug?: string; draft?: boolean; in?: string; spec?: string },
  flow = false
) {
  const slug = args.slug ?? (args.in ? basename(args.in).replace(/\.[^.]+$/, "") : "");
  if (!slugPattern.test(slug) || (!flow && slug.startsWith("flow-")))
    throw new ProtoError("invalid_config", "Invalid slug");
  if (args.spec && project.config.specs && !Object.hasOwn(project.config.specs, args.spec))
    throw new ProtoError("invalid_config", "Unknown spec");
  const registry = await project.registry();
  if (
    flow ? registry.flows.some(f => f.id === slug) : registry.prototypes.some(p => p.slug === slug)
  )
    throw new ProtoError("slug_taken");
  let file: string;
  let content: string;
  if (flow) {
    file = `${project.config.flows}/${slug}.flow.ts`;
    content = `import { defineFlow } from "@compozy/proto/flow";\nexport const flow = defineFlow(${JSON.stringify({ title: slug, ...(args.spec ? { spec: args.spec } : {}), start: ["start"], nodes: { start: { external: "site", end: true } }, edges: [] }, null, 2)});\n`;
  } else {
    if (Boolean(args.draft) === Boolean(args.in))
      throw new ProtoError("invalid_config", "Use exactly one of --draft or --in");
    file = args.draft
      ? `${project.config.drafts}/${slug}/index.proto.tsx`
      : args.in!.replace(/\.[^.]+$/, ".proto.tsx");
    if (!args.draft && !args.in!.endsWith(".tsx"))
      throw new ProtoError("invalid_config", "--in must name the view .tsx file");
    let view = "";
    let render = "<main>Welcome</main>";
    if (args.in) {
      const target = confined(project.root, args.in);
      const code = readFileSync(target, "utf8");
      const syntax = ts.createSourceFile(
        target,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const declaration = syntax.statements.find(
        n =>
          ts.canHaveModifiers(n) &&
          ts.getModifiers(n)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
      );
      const name =
        declaration && ts.isFunctionDeclaration(declaration)
          ? declaration.name?.text
          : declaration && ts.isVariableStatement(declaration)
            ? declaration.declarationList.declarations[0]?.name.getText()
            : undefined;
      if (!name) throw new ProtoError("invalid_config", "View must export a named component");
      const isDefault =
        declaration &&
        ts.canHaveModifiers(declaration) &&
        ts.getModifiers(declaration)?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
      view = `import ${isDefault ? name : `{ ${name} }`} from ${JSON.stringify("./" + basename(args.in).replace(/\.tsx$/, ""))};\n`;
      render = `<${name} />`;
    }
    content = `import { definePrototype } from "@compozy/proto";\n${view}\nexport const meta = definePrototype(${JSON.stringify({ title: slug, ...(args.spec ? { spec: args.spec } : {}), states: [{ id: "default", label: "Default" }] }, null, 2)});\nexport default function Prototype() { return ${render}; }\n`;
  }
  if (existsSync(confined(project.root, file))) throw new ProtoError("slug_taken");
  write(project.root, file, content);
  return { file, slug, url: project.url({ slug }) };
}
export function initProject(root: string, options: { force?: boolean; skills?: boolean } = {}) {
  root = resolve(root);
  const vite = ["vite.config.ts", "vite.config.js", "vite.config.mts"].find(f =>
    existsSync(join(root, f))
  );
  if (!vite) throw new ProtoError("not_a_vite_app");
  if (existsSync(join(root, "proto.config.ts")) && !options.force)
    return { skipped: true, files: [] };
  let code = readFileSync(join(root, vite), "utf8");
  const parsed = ts.createSourceFile(vite, code, ts.ScriptTarget.Latest, true);
  let hasProto = false;
  const findProto = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "proto"
    )
      hasProto = true;
    ts.forEachChild(node, findProto);
  };
  findProto(parsed);
  if (!hasProto) {
    const syntax = ts.createSourceFile(vite, code, ts.ScriptTarget.Latest, true);
    let array: ts.ArrayLiteralExpression | undefined;
    let object: ts.ObjectLiteralExpression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isObjectLiteralExpression(node) && !object) object = node;
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(syntax) === "plugins" &&
        ts.isArrayLiteralExpression(node.initializer)
      )
        array = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(syntax);
    if (array) {
      const at = array.elements.end;
      code = code.slice(0, at) + (array.elements.length ? ", " : "") + "proto()" + code.slice(at);
    } else if (object) {
      const at = object.getStart() + 1;
      code = code.slice(0, at) + " plugins: [proto()], " + code.slice(at);
    } else
      throw new ProtoError(
        "invalid_config",
        "vite.config must expose a configuration object to install proto()"
      );
    code = 'import { proto } from "@compozy/proto/vite";\n' + code;
  }
  const record = `---\ntarget: library\nhost: vite-app\nprototypes: src/drafts\nentry: "{slug}/index.proto.tsx"\nproviders: proto.canvas.tsx\ndev: proto dev\npreview: "http://127.0.0.1:4401/__proto/render/{slug}?chrome=0"\nevidence: "proto evidence {slug} --state <id>"\noutput: "docs/design/{slug}/"\n---\n\n# Prototyping\n\nCompose views in component prototypes; drafts may use markup. Run proto check before review.\n`;
  const files: Record<string, string> = {
    "proto.config.ts":
      'import { defineProtoConfig } from "@compozy/proto/config";\nexport default defineProtoConfig({title:"Prototypes"});\n',
    "proto.canvas.tsx":
      'import type { CanvasProps } from "@compozy/proto";\nexport function Canvas({children}:CanvasProps){ return children; }\n',
    "src/drafts/welcome/index.proto.tsx":
      'import { definePrototype } from "@compozy/proto";\nexport const meta=definePrototype({title:"Welcome",states:[{id:"default",label:"Welcome"}]});\nexport default function Welcome(){return <main>Welcome to Proto</main>;}\n',
    "docs/design/prototyping.md": record,
    [vite]: code,
    "proto/review/.gitignore": ".pending/\n*.lock*\n*.tmp\n",
  };
  for (const file of Object.keys(files))
    if (file !== vite && existsSync(join(root, file)) && !options.force)
      throw new ProtoError("invalid_config", `${file} exists; use --force`);
  for (const [file, content] of Object.entries(files))
    write(root, file, content, options.force || file === vite);
  if (options.skills)
    for (const name of ["author-prototype", "apply-prototype-comments"]) {
      const target = confined(root, `.agents/skills/${name}/SKILL.md`);
      mkdirSync(dirname(target), { recursive: true });
      if (!existsSync(target) || options.force)
        copyFileSync(
          fileURLToPath(new URL(`../../skills/${name}/SKILL.md`, import.meta.url)),
          target
        );
    }
  return { skipped: false, files: Object.keys(files) };
}
