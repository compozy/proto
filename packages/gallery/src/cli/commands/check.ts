import { defineCommand } from "citty";
import { relative } from "node:path";
import { build, mergeConfig } from "vite";

import type { FlowProblem } from "../../flow";
import { findPrototypes, type Problem } from "../../node/discovery";
import { findFlows } from "../../node/flows";
import { currentApp, repoRoot } from "../../node/paths";
import { galleryViteConfig } from "../../node/vite-config";

export default defineCommand({
  meta: { description: "Validate prototypes and flows, then build the gallery without writing it" },
  args: { json: { type: "boolean" } },
  async run({ args }) {
    const { appRoot, config } = currentApp();
    const result = findPrototypes(appRoot, repoRoot, config);
    const flows = findFlows(appRoot, repoRoot, result.entries, config);
    const problems: (Problem | FlowProblem)[] = [...result.problems, ...flows.problems];
    let buildError: string | null = null;
    if (!problems.length)
      try {
        await build(
          mergeConfig(await galleryViteConfig("build"), {
            build: { write: false },
            logLevel: args.json ? "silent" : "warn",
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("presentation_boundary:")) {
          const app = relative(repoRoot, appRoot);
          const entry = result.entries.find(entry =>
            message.includes(entry.file.replace(`${app}/`, ""))
          );
          problems.push({
            code: "presentation_boundary",
            slug: entry?.slug ?? null,
            file: entry?.file ?? "",
            message,
          });
        } else buildError = message;
      }
    if (args.json)
      console.log(
        JSON.stringify({
          ok: !problems.length && !buildError,
          problems,
          warnings: flows.warnings,
          ...(buildError ? { error: buildError } : {}),
        })
      );
    else if (buildError) console.error(buildError);
    else if (problems.length)
      console.error(problems.map(problem => `${problem.file}: ${problem.message}`).join("\n"));
    else
      console.log(`${result.entries.length} prototypes valid\n${flows.flows.length} flows valid`);
    if (!args.json && flows.warnings.length)
      console.warn(
        `warning: prototype states in no flow (specs touched by flows):\n${flows.warnings.map(warning => `  ${warning.slug} · ${warning.state}`).join("\n")}`
      );
    if (problems.length || buildError) process.exitCode = 1;
  },
});
