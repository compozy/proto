import { defineCommand } from "citty";
import { dirname, basename, resolve } from "node:path";
import { existsSync } from "node:fs";
import { migrateFiles } from "../../migrate/index.ts";
import { ProtoError } from "../../model/errors.ts";
export function parseMap(value?: string): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  return Object.fromEntries(
    value.split(",").map(pair => {
      const match = /^([^=,]+)=([^=,]+)$/.exec(pair);
      if (!match) throw new ProtoError("invalid_input", `Invalid mapping "${pair}"; use old=new.`);
      return [match[1]!, match[2]!];
    })
  );
}
export default defineCommand({
  meta: { description: "Migrate local v1/v2 review files without deleting the source" },
  args: {
    from: { type: "string", required: true },
    app: { type: "string" },
    "flow-prefix": { type: "string" },
    "theme-map": { type: "string" },
    "role-map": { type: "string" },
    "dry-run": { type: "boolean" },
    json: { type: "boolean" },
  },
  async run({ args }) {
    const source = resolve(args.from);
    const explicit = args.app
      ? existsSync(resolve(args.app))
        ? resolve(args.app)
        : resolve("apps", args.app)
      : undefined;
    const root =
      explicit ??
      (basename(source) === "comments" && basename(dirname(source)) === "gallery"
        ? dirname(dirname(source))
        : process.cwd());
    const report = await migrateFiles(root, {
      from: source,
      flowPrefix: args["flow-prefix"],
      themeMap: parseMap(args["theme-map"]),
      roleMap: parseMap(args["role-map"]),
      dryRun: args["dry-run"],
    });
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const key of report.keys)
        console.log(
          `${key.sourceKey}${key.key !== key.sourceKey ? ` → ${key.key}` : ""}\tv${key.sourceVersion}\t${key.comments} comments\t${key.messages} messages\t${key.attachments.length} attachments\tsequence ${key.sequence}\t${key.status}${key.error ? ` (${key.error.code})` : ""}`
        );
      console.log(
        args["dry-run"]
          ? "Dry run; no files written."
          : `Report: ${resolve(root, "proto-migration-report.json")}`
      );
      if (report.deletable.length) console.log(`Delete when ready: ${report.deletable.join(", ")}`);
      for (const note of report.notes) console.log(note);
      for (const error of report.errors) console.error(`${error.code}: ${error.message}`);
    }
    if (report.errors.length) process.exitCode = 1;
  },
});
