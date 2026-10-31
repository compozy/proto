import { defineCommand } from "citty";
import { build } from "vite";
import { galleryViteConfig } from "../../node/vite-config.ts";
import { loadProject } from "../../node/project.ts";
import { currentApp } from "../../node/paths.ts";
import { checkProject } from "../../node/check.ts";
export default defineCommand({
  async run() {
    const result = await checkProject(await loadProject(currentApp().appRoot));
    if (!result.ok) {
      console.error(JSON.stringify(result));
      process.exitCode = 1;
      return;
    }
    await build(await galleryViteConfig("build"));
  },
});
