#!/usr/bin/env bun
// `bun run proto <command> [--app <name>]`: the prototype gallery of one app (see CLAUDE.md).
import { defineCommand, runMain } from "citty";

import { loadApp } from "../node/paths";

/** `--app` is global: read it before citty parses the subcommand. */
function takeApp(argv: string[]) {
  const index = argv.findIndex(arg => arg === "--app" || arg.startsWith("--app="));
  if (index === -1) return undefined;
  const [arg] = argv.splice(index, 1);
  if (arg!.includes("=")) return arg!.slice("--app=".length);
  const [value] = argv.splice(index, 1);
  return value;
}

export const main = defineCommand({
  meta: {
    name: "proto",
    version: "0.0.0",
    description: "Prototype gallery (pass --app <name> when several apps have one)",
  },
  subCommands: {
    migrate: () => import("./commands/migrate").then(module => module.default),
    dev: () => import("./commands/dev").then(module => module.default),
    build: () => import("./commands/build").then(module => module.default),
    list: () => import("./commands/list").then(module => module.default),
    check: () => import("./commands/check").then(module => module.default),
    flow: () => import("./commands/flow").then(module => module.default),
    new: () => import("./commands/new").then(module => module.default),
    url: () => import("./commands/url").then(module => module.default),
    comments: () => import("./commands/comments").then(module => module.default),
    evidence: () => import("./commands/evidence").then(module => module.default),
  },
});

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const help = argv.length === 0 || argv.includes("--help") || argv.includes("-h");
  const migration = argv[0] === "migrate";
  const app = migration ? undefined : takeApp(argv);
  try {
    if (!migration && (!help || app)) await loadApp(app);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  await runMain(main, { rawArgs: argv });
}
