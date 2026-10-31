import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveProtoConfig, type ProtoConfig, type ResolvedGalleryConfig } from "../config.ts";

export const galleryRoot = fileURLToPath(new URL("../", import.meta.url));
export const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

/** The app whose prototypes this process serves: one per CLI run or Vite server. */
export type GalleryApp = {
  name: string;
  appRoot: string;
  /** `apps/<app>/gallery/comments/<slug>/comments.json` and its attachments. */
  commentsRoot: string;
  config: ResolvedGalleryConfig;
};

const configFile = "proto.config.ts";

/** Apps under `apps/` that have a `gallery.config.ts`. */
export function galleryApps() {
  const apps = join(repoRoot, "apps");
  if (!existsSync(apps)) return [];
  return readdirSync(apps, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(apps, entry.name, configFile)))
    .map(entry => entry.name)
    .toSorted();
}

/** `--app`, else the app containing the working directory, else the only gallery app. */
export function pickApp(requested?: string) {
  const apps = galleryApps();
  if (requested) {
    if (!apps.includes(requested))
      throw new Error(`Unknown gallery app "${requested}" (${apps.join(", ") || "none"})`);
    return requested;
  }
  const local = relative(join(repoRoot, "apps"), process.cwd()).split(sep)[0];
  if (local && apps.includes(local)) return local;
  if (apps.length === 1) return apps[0]!;
  throw new Error(
    apps.length
      ? `Several apps have a gallery (${apps.join(", ")}); pass --app <name>`
      : `No app has a ${configFile}`
  );
}

let current: GalleryApp | null = null;

export async function loadApp(requested?: string): Promise<GalleryApp> {
  const name = pickApp(requested);
  const appRoot = resolve(repoRoot, "apps", name);
  const module = (await import(pathToFileURL(join(appRoot, configFile)).href)) as {
    default: ProtoConfig;
  };
  const resolved = resolveProtoConfig(module.default, appRoot);
  current = {
    name,
    appRoot,
    commentsRoot: join(appRoot, "gallery", "comments"),
    config: { ...resolved, specs: resolved.specs ?? {} },
  };
  return current;
}

export function currentApp(): GalleryApp {
  if (!current) throw new Error("Gallery app not loaded; call loadApp() first");
  return current;
}
