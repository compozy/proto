import { defineCommand } from "citty";
import { loadProject } from "../../node/project.ts";
import { currentApp } from "../../node/paths.ts";
import { checkProject } from "../../node/check.ts";
export default defineCommand({
  args: { json: { type: "boolean" } },
  async run({ args }) {
    const result = await checkProject(await loadProject(currentApp().appRoot));
    console.log(
      args.json
        ? JSON.stringify(result)
        : result.ok
          ? "Prototypes and flows valid"
          : JSON.stringify(result, null, 2)
    );
    if (!result.ok) process.exitCode = 1;
  },
});
