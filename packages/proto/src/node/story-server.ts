import { createRequire } from "node:module";
import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, searchForWorkspaceRoot, type InlineConfig } from "vite";
import type { StoryRootConfig } from "../config.ts";
import { ProtoError } from "../model/errors.ts";
import type { ProtoProject } from "./project.ts";
import { renderGuard } from "./render-guard.ts";
import { storyPlugins } from "../vite/stories.ts";
export function projectId(root: string) {
  return createHash("sha256").update(realpathSync(root)).digest("hex").slice(0, 16);
}
export function checkStorybookPeers(dir: string, rootId: string) {
  const require = createRequire(resolve(dir, "package.json"));
  for (const name of ["storybook", "@storybook/react-vite"]) {
    let version: string;
    try {
      version = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")).version;
    } catch {
      throw new ProtoError(
        "storybook_missing",
        `storybook is not installed in ${rootId}; install storybook and @storybook/react-vite.`
      );
    }
    if (!/^10\.6\.\d+$/.test(version))
      throw new ProtoError(
        "storybook_unsupported",
        `Storybook ${version} is not supported; proto needs ~10.6.0.`
      );
  }
}
export function storyViteConfig(
  project: ProtoProject,
  root: StoryRootConfig,
  ports: { shell: number; story: number }
): InlineConfig {
  const dir = resolve(project.root, root.dir ?? ".");
  const require = createRequire(resolve(dir, "package.json"));
  return {
    configFile: resolve(dir, root.vite),
    root: dir,
    mode: "proto-story",
    cacheDir: resolve(dir, "node_modules/.cache/proto/stories", root.id),
    plugins: storyPlugins(project, root, `http://127.0.0.1:${ports.shell}`),
    resolve: { dedupe: ["react", "react-dom", "storybook", "@storybook/react-vite"] },
    optimizeDeps: {
      entries: [
        ...(typeof root.stories === "string" ? [root.stories] : root.stories),
        root.preview,
        fileURLToPath(new URL("../render/story-host.tsx", import.meta.url)),
      ],
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@storybook/react-vite",
        "storybook/preview-api",
        "storybook/test",
      ].filter(id => {
        try {
          require.resolve(id);
          return true;
        } catch {
          return false;
        }
      }),
    },
    server: {
      host: "127.0.0.1",
      port: ports.story,
      strictPort: true,
      allowedHosts: [...project.config.dev.allowedHosts],
      watch: { usePolling: project.config.dev.poll },
      fs: {
        allow: [
          dir,
          searchForWorkspaceRoot(project.root),
          fileURLToPath(new URL("../../", import.meta.url)),
        ],
      },
    },
  };
}
export async function startStoryServer(
  project: ProtoProject,
  root: StoryRootConfig,
  ports: { shell: number; story: number },
  quiet = false
) {
  checkStorybookPeers(resolve(project.root, root.dir ?? "."), root.id);
  const server = await createServer({
    ...storyViteConfig(project, root, ports),
    ...(quiet ? { logLevel: "silent" as const } : {}),
  }).catch(error => {
    throw new Error(`Story root ${root.id} failed to start: ${String(error)}`, { cause: error });
  });
  server.middlewares.stack.unshift(
    renderGuard(ports.story, `http://127.0.0.1:${ports.shell}`, project.config.dev.allowedHosts)
  );
  try {
    await server.listen();
  } catch (error) {
    await server.close();
    if (String(error).includes("in use") || (error as NodeJS.ErrnoException).code === "EADDRINUSE")
      throw new ProtoError("port_in_use", `Story root ${root.id} port ${ports.story} is in use.`);
    throw new Error(`Story root ${root.id} failed to start: ${String(error)}`, { cause: error });
  }
  return server;
}
