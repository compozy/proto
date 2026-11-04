import { cp } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import type { ProtoProject } from "./project.ts";
import { checkStorybookPeers, storyViteConfig } from "./story-server.ts";
import { ProtoError } from "../model/errors.ts";
import { storyPlugins } from "../vite/stories.ts";

/** Each root keeps its consumer pipeline and a worker directory below the gallery shell. */
export async function buildStories(project: ProtoProject, staging: string) {
  if (!project.config.stories) return undefined;
  const endpoints: { id: string; renderUrl: string }[] = [];
  for (const root of project.config.stories.roots) {
    const dir = resolve(project.root, root.dir ?? ".");
    const outDir = join(staging, "__stories", root.id);
    try {
      checkStorybookPeers(dir, root.id);
      await build({
        ...storyViteConfig(project, root, { shell: 0, story: 0 }),
        base: "./",
        logLevel: "silent",
        plugins: [
          ...storyPlugins(project, root, "", true),
          {
            name: "proto:static-story-html",
            generateBundle(_options, bundle) {
              const entry = Object.values(bundle).find(item => item.type === "chunk" && item.isEntry);
              if (!entry || entry.type !== "chunk") throw new Error("Story build emitted no entry");
              // Only the host's CSS is eager; Vite loads each story's CSS with its lazy chunk.
              const styles =
                (
                  entry as typeof entry & {
                    viteMetadata?: { importedCss: Set<string> };
                  }
                ).viteMetadata?.importedCss ?? new Set<string>();
              this.emitFile({
                type: "asset",
                fileName: "index.html",
                source: `<!doctype html><html><head><meta charset="utf-8">${[...styles].map(file => `<link rel="stylesheet" href="./${file}">`).join("")}</head><body><div id="proto-story-canvas"></div><div id="proto-story-overlays"></div><script type="module" src="./${entry.fileName}"></script></body></html>`,
              });
            },
          },
        ],
        build: {
          outDir,
          emptyOutDir: true,
          rollupOptions: {
            input: fileURLToPath(new URL("../render/story-host.tsx", import.meta.url)),
          },
        },
      });
      // Vite copies publicDir; explicit static mounts use the same root-relative layout.
      for (const mount of root.static ?? []) {
        const destination = resolve(outDir, mount.to.replace(/^\/+/, ""));
        if (destination !== outDir && !destination.startsWith(`${outDir}${sep}`))
          throw new Error(`Static destination escapes story root: ${mount.to}`);
        await cp(resolve(dir, mount.from), destination, { recursive: true });
      }
    } catch (error) {
      const message = `Story root ${root.id} failed to build: ${String(error)}`;
      if (error instanceof ProtoError) throw new ProtoError(error.code, message, error.details);
      throw new Error(message, { cause: error });
    }
    endpoints.push({ id: root.id, renderUrl: `__stories/${root.id}/index.html` });
  }
  return endpoints;
}
