import { defineCommand } from "citty";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { findPrototypes } from "../../node/discovery";
import { currentApp, repoRoot } from "../../node/paths";

export default defineCommand({
  meta: { description: "Create a prototype: --in <src folder> beside a view, or --draft" },
  args: {
    slug: { type: "positional", required: true },
    in: { type: "string", description: "Repository-relative folder inside the app's src" },
    draft: { type: "boolean", description: "Exploration in src/drafts/<slug>/index.proto.tsx" },
    spec: { type: "string" },
    route: { type: "string", default: "/" },
    surface: { type: "string", default: "S1" },
  },
  run({ args }) {
    const { appRoot, config } = currentApp();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(args.slug) || args.slug.length > 120)
      throw new Error("Invalid prototype slug");
    if (Boolean(args.in) === Boolean(args.draft))
      throw new Error("Use exactly one of --in or --draft");
    if (args.spec && !Object.hasOwn(config.specs, args.spec))
      throw new Error(`Unknown spec "${args.spec}" (not in gallery.config.ts)`);
    const existing = findPrototypes(appRoot, repoRoot, config).entries.find(
      entry => entry.slug === args.slug
    );
    if (existing) throw new Error(`Prototype slug "${args.slug}" already exists: ${existing.file}`);
    const folder = args.draft
      ? resolve(appRoot, "src/drafts", args.slug)
      : resolve(repoRoot, args.in!);
    const local = relative(appRoot, folder);
    if (!args.draft && (!/^src(\/|$)/.test(local) || /^src\/drafts(\/|$)/.test(local)))
      throw new Error("--in must be a folder inside the app's src (outside src/drafts)");
    let ancestor = folder;
    while (!existsSync(ancestor)) ancestor = dirname(ancestor);
    if (relative(appRoot, realpathSync(ancestor)).startsWith(".."))
      throw new Error("Prototype path escapes the app");
    const file = resolve(folder, args.draft ? "index.proto.tsx" : `${args.slug}.proto.tsx`);
    const meta = {
      title: args.slug,
      ...(args.spec ? { spec: args.spec } : {}),
      surface: args.surface,
      route: args.route,
      states: [{ id: "default", label: "Default" }],
    };
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      file,
      `import { definePrototype } from "@proto/gallery";\n\nexport const meta = definePrototype(${JSON.stringify(meta, null, 2)});\n\nexport default function Prototype() {\n  return null;\n}\n`,
      { flag: "wx" }
    );
    console.log(`created ${relative(repoRoot, file)}`);
  },
});
