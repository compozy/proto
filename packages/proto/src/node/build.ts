import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import type { ProtoProject } from "./project.ts";
import type { ReviewSnapshot } from "../model/review.ts";
import type { Bootstrap } from "../model/bootstrap.ts";
import { renderPlugins } from "../vite/index.ts";
import { remoteUrl } from "../store/http-store.ts";
import { commitAt } from "./dev.ts";
import { buildStories } from "./story-build.ts";
import { reviewKeys } from "../model/registry.ts";

export type BuildOptions = {
  shellDir?: string;
  remote?: string;
  /** Absolute output directory; default `<root>/dist-proto`. */
  output?: string;
  /** Written to the bootstrap as the version id. */
  snapshot?: string;
};
/** Build offline data and the consumer render graph before exposing any output. */
export async function buildProject(project: ProtoProject, options: BuildOptions = {}) {
  const remote = options.remote;
  const shellOrigin = remote ? remoteUrl(remote).origin : "";
  if (options.output !== undefined && !isAbsolute(options.output))
    throw new Error("Build output must be an absolute directory");
  const output = options.output ?? resolve(project.root, "dist-proto");
  if (options.output === undefined) await rm(output, { recursive: true, force: true });
  const staging = await mkdtemp(join(project.root, ".proto-build-"));
  try {
    const indexed = await project.registry();
    const { stories: _stories, storyRoots: _storyRoots, ...snapshot } = indexed;
    const registry = remote
      ? {
          ...snapshot,
          problems: indexed.problems.filter(
            problem => !problem.root && !problem.code.startsWith("story_")
          ),
          warnings: indexed.warnings.filter(
            warning => !warning.root && !warning.code.startsWith("story_")
          ),
        }
      : indexed;
    if (remote && project.config.stories)
      registry.warnings.push({
        code: "stories_not_built",
        message: "Stories are omitted from this build.",
      });
    if (registry.problems.length) throw new Error(JSON.stringify({ problems: registry.problems }));
    const shell = options.shellDir ?? fileURLToPath(new URL("../../dist/shell/", import.meta.url));
    if (!existsSync(join(shell, "index.html")))
      throw new Error("Missing prebuilt shell; run the package build:shell before proto build");
    await cp(shell, staging, { recursive: true });
    const data = join(staging, "__proto");
    await mkdir(data, { recursive: true });
    await build({
      root: project.root,
      mode: "proto-render",
      base: remote ? "/__proto/render/" : "./",
      logLevel: "silent",
      plugins: [
        ...renderPlugins(project, {
          mode: remote ? "remote" : "read-only",
          form: remote ? "path" : "query",
          shellOrigin,
        }),
        {
          name: "proto:static-html",
          generateBundle(_options, bundle) {
            const entry = Object.values(bundle).find(item => item.type === "chunk" && item.isEntry);
            if (!entry) throw new Error("Render build did not emit an entry");
            const styles = Object.values(bundle).filter(
              item => item.type === "asset" && item.fileName.endsWith(".css")
            );
            this.emitFile({
              type: "asset",
              fileName: "index.html",
              source: `<!doctype html><html><head><meta charset="utf-8">${styles.map(item => `<link rel="stylesheet" href="${remote ? "/__proto/render/" : "./"}${item.fileName}">`).join("")}</head><body><div id="root"></div><script type="module" src="${remote ? "/__proto/render/" : "./"}${entry.fileName}"></script></body></html>`,
            });
          },
        },
      ],
      build: {
        outDir: join(data, "render"),
        emptyOutDir: true,
        rollupOptions: { input: fileURLToPath(new URL("../render/main.tsx", import.meta.url)) },
      },
    });
    const storyRoots = remote ? undefined : await buildStories(project, staging);
    const bootstrap: Bootstrap = {
      mode: remote ? "remote" : "read-only",
      title: project.config.title,
      locale: project.config.locale,
      commit: commitAt(project.root),
      ...(options.snapshot === undefined ? {} : { snapshot: options.snapshot }),
      apiBase: null,
      eventsUrl: null,
      renderUrl: "__proto/render/index.html",
      registryUrl: "__proto/registry.json",
      reviewSnapshotBase: project.config.build.includeReview ? "__proto/review/" : null,
      principal: null,
      signInUrl: null,
      ...(storyRoots ? { storyRoots } : {}),
    };
    await writeFile(join(data, "bootstrap.json"), JSON.stringify(bootstrap));
    await writeFile(join(data, "registry.json"), JSON.stringify(registry));
    if (project.config.build.includeReview) {
      const store = project.store();
      const keys = reviewKeys(registry);
      await mkdir(join(data, "review"), { recursive: true });
      for (const key of keys) {
        const comments = await store.list({ key, status: "all" });
        const review = await store.review(key);
        for (const comment of comments)
          for (const message of comment.thread)
            for (const image of message.attachments) {
              const file = await store.readAttachment(key, image.id);
              const extension = (
                {
                  "image/png": "png",
                  "image/jpeg": "jpg",
                  "image/gif": "gif",
                  "image/webp": "webp",
                } as Record<string, string>
              )[file.type];
              if (!extension || !/^[a-zA-Z0-9_-]+$/.test(image.id))
                throw new Error("Invalid snapshot attachment");
              const relative = `${key}/attachments/${image.id}.${extension}`;
              await mkdir(join(data, "review", key, "attachments"), { recursive: true });
              await writeFile(join(data, "review", relative), file.bytes);
              image.url = `__proto/review/${relative}`;
            }
        await writeFile(
          join(data, "review", `${key}.json`),
          JSON.stringify({ key, comments, review } satisfies ReviewSnapshot)
        );
      }
    }
    await mkdir(dirname(output), { recursive: true });
    await rename(staging, output);
    return { output, warnings: registry.warnings };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
