#!/usr/bin/env bun
import { defineCommand, parseArgs, type ArgsDef } from "citty";
import { existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import {
  catalog,
  argumentSchema,
  executeCapability,
  UsageError,
  type Capability,
} from "../capabilities/catalog.ts";
import { ProtoError, errorBody } from "../model/errors.ts";
import { loadProject, type ProtoProject } from "../node/project.ts";
const booleans = new Set([
  "dry-run",
  "bare",
  "draft",
  "waiting",
  "confirm-open",
  "force",
  "skills",
  "remote",
  "json",
  "verbose",
  "help",
]);
export function commandDefinition(capability: Capability) {
  const args: ArgsDef = Object.fromEntries(
    Object.keys(argumentSchema.shape).map(name => [
      name,
      { type: booleans.has(name) ? "boolean" : "string" },
    ])
  );
  for (const name of capability.positionals) args[name] = { type: "positional", required: false };
  return {
    ...defineCommand({ meta: { name: capability.cli, description: capability.authority }, args }),
    meta: { name: capability.cli, description: capability.authority },
    args,
  };
}
export function projectRoot(cwd: string, app?: string) {
  if (app) {
    const direct = resolve(cwd, app);
    if (existsSync(direct)) return direct;
    const nested = resolve(cwd, "apps", app);
    if (existsSync(nested)) return nested;
    throw new ProtoError("invalid_config", `App ${app} does not exist`);
  }
  for (let current = resolve(cwd); ; current = dirname(current)) {
    if (existsSync(join(current, "proto.config.ts"))) return current;
    if (dirname(current) === current) break;
  }
  const apps = join(cwd, "apps");
  const matches = existsSync(apps)
    ? readdirSync(apps).filter(name => existsSync(join(apps, name, "proto.config.ts")))
    : [];
  if (matches.length === 1) return join(apps, matches[0]!);
  if (matches.length > 1) throw new ProtoError("app_required");
  return resolve(cwd);
}
export type CliResult = { exitCode: number; data: unknown };
export async function runCli(
  argv: string[],
  options: { cwd?: string; project?: ProtoProject } = {}
): Promise<CliResult> {
  try {
    const words: string[] = [];
    const flags: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const value = argv[i]!;
      if (value.startsWith("--")) {
        const name = value.slice(2).split("=")[0]!;
        if (!(name in argumentSchema.shape)) throw new UsageError(`Unknown option --${name}`);
        flags.push(value);
        if (!booleans.has(name) && !value.includes("=")) {
          if (!argv[i + 1] || argv[i + 1]!.startsWith("--"))
            throw new UsageError(`--${name} needs a value`);
          flags.push(argv[++i]!);
        }
      } else words.push(value);
    }
    if (!words.length || flags.includes("--help"))
      return { exitCode: 0, data: { commands: catalog.map(c => c.cli) } };
    const capability = [...catalog]
      .sort((a, b) => b.cli.split(" ").length - a.cli.split(" ").length)
      .find(c => c.cli.split(" ").every((word, index) => words[index] === word));
    if (!capability) throw new UsageError(`Unknown command ${words.join(" ")}`);
    const positionals = words.slice(capability.cli.split(" ").length);
    if (positionals.length > capability.positionals.length)
      throw new UsageError("Too many positional arguments");
    const raw = parseArgs(
      [...positionals, ...flags],
      commandDefinition(capability).args as ArgsDef
    );
    const parsed = argumentSchema.safeParse(raw);
    if (!parsed.success) throw new UsageError(parsed.error.message);
    const args = parsed.data;
    let root =
      options.project?.root ??
      (capability.cli === "init" && !args.app
        ? resolve(options.cwd ?? process.cwd())
        : projectRoot(options.cwd ?? process.cwd(), args.app));
    if (capability.cli === "migrate") {
      if (!args.from) throw new UsageError("--from is required");
      const source = resolve(options.cwd ?? process.cwd(), args.from);
      if (!args.app && !options.project)
        root =
          basename(source) === "comments" && basename(dirname(source)) === "gallery"
            ? dirname(dirname(source))
            : resolve(options.cwd ?? process.cwd());
      const { migrateFiles } = await import("../migrate/index.ts");
      const { parseMap } = await import("./commands/migrate.ts");
      const report = await migrateFiles(root, {
        from: source,
        flowPrefix: args["flow-prefix"],
        themeMap: parseMap(args["theme-map"]),
        roleMap: parseMap(args["role-map"]),
        dryRun: args["dry-run"],
      });
      return { exitCode: report.errors.length ? 1 : 0, data: report };
    }
    if (capability.cli === "build") {
      const { rm } = await import("node:fs/promises");
      await rm(join(root, "dist-proto"), { recursive: true, force: true });
    }
    const project =
      options.project ?? (capability.cli === "init" ? undefined : await loadProject(root));
    if (capability.cli === "dev") {
      const { startDev } = await import("../node/dev.ts");
      const server = await startDev(project!, { port: args.port, quiet: args.json });
      const stop = () => void server.close();
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      return { exitCode: 0, data: { origin: server.origin, renderOrigin: server.renderOrigin } };
    }
    if (capability.cli === "mcp") {
      const { startMcp } = await import("../mcp.ts");
      await startMcp(project!);
      return { exitCode: 0, data: undefined };
    }
    if (capability.cli === "build") {
      const { buildProject } = await import("../node/build.ts");
      const result = await buildProject(project!);
      return { exitCode: 0, data: { path: result.output, warnings: result.warnings } };
    }
    const data = await executeCapability(capability, args, { root, project, transport: "cli" });
    const failure =
      capability.cli === "check" &&
      data &&
      typeof data === "object" &&
      ("error" in data ||
        ("problems" in data && Array.isArray(data.problems) && data.problems.length > 0));
    return { exitCode: failure ? 1 : 0, data };
  } catch (error) {
    if (error instanceof ProtoError) return { exitCode: error.exit ?? 1, data: errorBody(error) };
    if (error instanceof UsageError)
      return { exitCode: 2, data: { error: { message: error.message } } };
    return {
      exitCode: error instanceof Error && error.name === "MissingDependencyError" ? 3 : 1,
      data: { error: { message: error instanceof Error ? error.message : String(error) } },
    };
  }
}
export const main = defineCommand({
  meta: { name: "proto" },
  subCommands: Object.fromEntries(
    catalog.filter(c => !c.cli.includes(" ")).map(c => [c.cli, commandDefinition(c)])
  ),
});
if (import.meta.main) {
  const started = Date.now();
  const result = await runCli(process.argv.slice(2));
  if (result.data !== undefined)
    console.log(JSON.stringify(result.data, null, process.argv.includes("--json") ? undefined : 2));
  if (process.argv.includes("--verbose"))
    console.error(`proto completed in ${Date.now() - started}ms (exit ${result.exitCode})`);
  process.exitCode = result.exitCode;
}
