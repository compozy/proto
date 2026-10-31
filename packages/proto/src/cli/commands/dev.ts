import { defineCommand } from "citty";
import { loadProject } from "../../node/project.ts";
import { startDev } from "../../node/dev.ts";
import { currentApp } from "../../node/paths.ts";
export default defineCommand({
  meta: { description: "Start the shell and render origins" },
  args: { port: { type: "string" } },
  async run({ args }) {
    const server = await startDev(await loadProject(currentApp().appRoot), {
      port: args.port ? Number(args.port) : undefined,
    });
    console.log(`Proto: ${server.origin}\nRender: ${server.renderOrigin}`);
    const stop = () => void server.close().then(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  },
});
