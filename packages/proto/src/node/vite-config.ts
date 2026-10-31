import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mergeConfig, type InlineConfig, type UserConfig, type UserConfigExport } from "vite";

import { currentApp, galleryRoot, repoRoot } from "./paths.ts";
import { prototypeRegistry } from "./plugins/prototypes.ts";
import { sourceTags } from "./source-tags.ts";

/** The commit new comments are stamped with: `REVISION` (CI) or the checkout's HEAD. */
function buildCommit() {
  const commit = process.env.REVISION;
  if (commit && !/^[a-f0-9]{40}$/.test(commit))
    throw new Error("REVISION must be a full Git commit SHA");
  if (commit) return commit;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null; // Source archives and fresh repositories have no commit.
  }
}

/**
 * The gallery's Vite config: the app's `vite.shared.ts` (aliases, Tailwind, React Compiler,
 * presentation boundary; the same config Storybook uses) plus the gallery root, discovery,
 * source tags and the local comments API. Port 4400, output `apps/<app>/dist-gallery`.
 */
export async function galleryViteConfig(command: "serve" | "build"): Promise<InlineConfig> {
  const app = currentApp();
  const presentationFile = join(app.appRoot, "vite.shared.ts");
  if (!existsSync(presentationFile)) throw new Error(`Missing ${presentationFile}`);
  const exported = (await import(pathToFileURL(presentationFile).href)) as {
    default: UserConfigExport;
  };
  const mode = command === "build" ? "production" : "development";
  const resolved = await (typeof exported.default === "function"
    ? exported.default({ command, mode, isSsrBuild: false, isPreview: false })
    : exported.default);
  const { plugins, server, optimizeDeps: _appOptimization, ...base } = resolved as UserConfig;
  // App warmup paths are relative to its own root. The gallery scans its entry, the app's preview
  // wiring and every prototype: they load through virtual modules, which the dependency scanner
  // cannot follow, and a dependency found late reloads the page.
  const { warmup: _appWarmup, ...serverOptions } = server ?? {};
  const appSource = relative(galleryRoot, join(app.appRoot, "src"));
  const appPreview = relative(galleryRoot, join(app.appRoot, "proto.canvas.tsx"));
  return mergeConfig(base, {
    configFile: false,
    root: galleryRoot,
    cacheDir: resolve(app.appRoot, "node_modules/.cache/gallery"),
    optimizeDeps: {
      entries: ["index.html", appPreview, `${appSource}/**/*.proto.tsx`],
    },
    publicDir: resolve(app.appRoot, "public"),
    define: { "import.meta.env.VITE_BUILD_COMMIT": JSON.stringify(buildCommit()) },
    server: { ...serverOptions, host: "127.0.0.1", port: 4400, strictPort: true },
    // The ELK layout worker (1.6 MB) is one vendor module; this budget is the gallery's only.
    build: {
      outDir: resolve(app.appRoot, "dist-gallery"),
      emptyOutDir: true,
      chunkSizeWarningLimit: 1700,
    },
    // Source tags run first: React Compiler (also `pre`) must see the authored attributes.
    plugins: [
      sourceTags(repoRoot, app.appRoot),
      prototypeRegistry(app, repoRoot),
      ...(plugins ?? []),
    ],
  } satisfies InlineConfig);
}
