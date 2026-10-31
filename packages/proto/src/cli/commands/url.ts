import { defineCommand } from "citty";

import { findPrototypes } from "../../node/discovery";
import { currentApp, repoRoot } from "../../node/paths";
import { galleryOrigin } from "../comments";

export default defineCommand({
  meta: { description: "Print a prototype URL (standalone canvas, or --gallery)" },
  args: {
    slug: { type: "positional", required: true },
    state: { type: "string" },
    theme: { type: "enum", options: ["light", "dark"] },
    role: { type: "string" },
    gallery: { type: "boolean" },
  },
  run({ args }) {
    const { appRoot, config } = currentApp();
    const entry = findPrototypes(appRoot, repoRoot, config).entries.find(
      entry => entry.slug === args.slug
    );
    if (!entry) throw new Error("Unknown prototype");
    if (args.state && !entry.meta?.states.some(state => state.id === args.state))
      throw new Error("Unknown state");
    const roles: readonly string[] = entry.meta?.roles ?? Object.keys(config.roles);
    if (args.role && !roles.includes(args.role))
      throw new Error(`Unknown role (${roles.join(", ") || "none declared"})`);
    const url = new URL(args.gallery ? "/" : `/${args.slug}`, galleryOrigin);
    url.searchParams.set(args.gallery ? "p" : "chrome", args.gallery ? args.slug : "0");
    for (const [key, value] of [
      ["state", args.state],
      ["theme", args.theme],
      ["role", args.role],
    ])
      if (key && value) url.searchParams.set(key, value);
    console.log(url.href);
  },
});
