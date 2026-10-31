import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";
import { buildProject } from "../../node/build.ts";
import { loadProject } from "../../node/project.ts";
import { currentApp } from "../../node/paths.ts";
export default defineCommand({
  meta: { description: "Build a static read-only gallery in dist-proto" },
  async run() {
    try {
      const root = existsSync(join(process.cwd(), "proto.config.ts"))
        ? process.cwd()
        : currentApp().appRoot;
      await rm(join(root, "dist-proto"), { recursive: true, force: true });
      await buildProject(await loadProject(root));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  },
});
