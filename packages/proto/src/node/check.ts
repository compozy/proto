import { build } from "vite";
import { fileURLToPath } from "node:url";
import type { ProtoProject } from "./project.ts";
import { renderViteConfig } from "./dev.ts";

/** Compile every prototype through the consumer pipeline, without writing any output. */
export async function checkProject(project: ProtoProject) {
  const registry = await project.registry();
  let error: string | undefined;
  if (!registry.problems.length) {
    const config = renderViteConfig(project, project.config.dev.port);
    try {
      await build({
        ...config,
        logLevel: "silent",
        plugins: [
          ...(config.plugins ?? []),
          {
            name: "proto:check-entry",
            resolveId(id) {
              if (id === "virtual:proto/check") return `\0${id}`;
            },
            load(id) {
              if (id === "\0virtual:proto/check")
                return `import ${JSON.stringify(fileURLToPath(new URL("../render/main.tsx", import.meta.url)))}; import "virtual:proto/canvas"; import { prototypes } from "virtual:proto/prototypes"; export default prototypes;`;
            },
          },
        ],
        build: { write: false, rollupOptions: { input: "virtual:proto/check" }, minify: false },
      });
    } catch (cause) {
      const message = String(cause);
      if (message.includes("network_import:"))
        registry.problems.push({
          code: "network_import",
          file: "",
          message,
          chain: message.split(": ").at(-1)?.split(". Stories")[0]?.split(" → "),
        });
      else error = message;
    }
  }
  return {
    ok: !registry.problems.length && !error,
    problems: registry.problems,
    warnings: registry.warnings,
    ...(error ? { error } : {}),
  };
}
