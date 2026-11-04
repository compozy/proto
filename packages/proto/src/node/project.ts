import { indexStories, type StoryCache } from "./stories.ts";
import { HttpStore } from "../store/http-store.ts";
import { remoteToken } from "../auth/credentials.ts";
import { existsSync, watch as watchFs, globSync, statSync } from "node:fs";
import { resolve, join, matchesGlob, sep } from "node:path";
import { loadConfigFromFile } from "vite";
import { resolveProtoConfig, type ResolvedProtoConfig } from "../config.ts";
import { ProtoError } from "../model/errors.ts";
import type { Registry } from "../model/registry.ts";
import { findPrototypes } from "./discovery.ts";
import { findFlows } from "./flows.ts";

import { capture, type CaptureTarget } from "./capture.ts";
import { FileStore, type ReviewStore } from "../store/index.ts";
import { sourceRoots } from "../model/source.ts";
import { migrateFiles, type MigrateOptions, type MigrationReport } from "../migrate/index.ts";

export type UrlTarget = {
  slug: string;
  state?: string;
  theme?: "light" | "dark";
  role?: string;
  width?: number;
  bare?: boolean;
};

export interface ProtoProject {
  readonly root: string;
  readonly config: ResolvedProtoConfig;
  registry(): Promise<Registry>;
  readonly revision: number;
  invalidateStories(rootId: string, files: readonly string[]): void;
  watch(onChange: (registry: Registry) => void): () => void;
  url(target: UrlTarget, options?: { remote?: boolean }): string;
  store(options?: { remote?: boolean }): ReviewStore;
  screenshot(target: CaptureTarget): Promise<{ path: string; width: number; height: number }>;
  evidence(target: CaptureTarget): Promise<{ path: string }>;
  migrate(options: MigrateOptions): Promise<MigrationReport>;
}
/** Load configuration and expose discovery, watched snapshots, stores and authoring operations. */
export async function loadProject(
  cwd: string,
  configFile = "proto.config.ts"
): Promise<ProtoProject> {
  const root = resolve(cwd);
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "development" },
    resolve(root, configFile),
    root
  );
  if (!loaded) throw new ProtoError("invalid_config", `Missing ${configFile}`);
  const config = resolveProtoConfig(
    loaded.config as unknown as Parameters<typeof resolveProtoConfig>[0],
    root
  );
  const listeners = new Set<(registry: Registry) => void>();
  let cached: Registry | undefined;
  let generation = 0;
  let revision = 0;
  const revisions = new WeakMap<Registry, number>();
  const storyCache: StoryCache = new Map();
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshRequest = 0;
  async function publishLatest(request: number): Promise<void> {
    if (request !== refreshRequest || !listeners.size) return;
    const registry = await project.registry();
    if (request !== refreshRequest || !listeners.size) return;
    // A concurrent read can finish a newer build before this continuation runs.
    // Follow that snapshot instead of losing the refresh notification.
    if (revisions.get(registry) !== generation) return publishLatest(request);
    for (const listener of listeners) listener(registry);
  }
  const refresh = () => {
    cached = undefined;
    generation++;
    clearTimeout(refreshTimer);
    const request = ++refreshRequest;
    refreshTimer = setTimeout(() => {
      void publishLatest(request);
    }, 75);
  };
  let stopWatch: (() => void) | undefined;
  /** Share one authored-file watcher across subscribers and debounce registry refresh notifications. */
  const observe = () => {
    const patterns = [
      ...(typeof config.prototypes === "string" ? [config.prototypes] : config.prototypes),
      "**/*.flow.ts",
      config.canvas,
    ];
    const watchedFiles = () =>
      globSync(patterns, {
        cwd: root,
        exclude: ["**/node_modules/**", "**/.pending/**", "**/*.tmp/**", "**/*.lock*/**"],
      });
    let close: () => void;
    if (config.dev.poll || process.platform === "darwin") {
      // One observer serves shell and Vite. Include misplaced flows so diagnostics stay live.
      const fingerprint = () =>
        watchedFiles()
          .sort()
          .map(file => {
            try {
              const info = statSync(join(root, file));
              return `${file}:${info.mtimeMs}:${info.size}:${info.ino}`;
            } catch {
              return file;
            }
          })
          .join("\n");
      let previous = fingerprint();
      const interval = setInterval(() => {
        const next = fingerprint();
        if (next !== previous) {
          previous = next;
          refresh();
        }
      }, 200);
      close = () => clearInterval(interval);
    } else {
      const watcher = watchFs(root, { recursive: true }, (event, file) => {
        const changed = file?.replaceAll("\\", "/");
        if (!changed || /(?:\.lock|\.tmp|\.pending\/|node_modules\/)/.test(changed)) return;
        const absolute = resolve(root, changed);
        if (patterns.some(pattern => matchesGlob(absolute, resolve(root, pattern)))) {
          refresh();
          return;
        }
        if (event !== "rename") return;
        const descendant = (file: string) => resolve(root, file).startsWith(absolute + sep);
        // Native watchers may report only the directory when its descendants leave the tree.
        const previous = [
          { file: config.canvas },
          ...(cached?.prototypes ?? []),
          ...(cached?.flows ?? []),
          ...(cached?.problems ?? []),
        ];
        if (
          previous.some(item => descendant(item.file)) ||
          (statSync(absolute, { throwIfNoEntry: false })?.isDirectory() &&
            watchedFiles().some(descendant))
        )
          refresh();
      });
      close = () => watcher.close();
    }
    return () => {
      clearTimeout(refreshTimer);
      close();
    };
  };
  const project: ProtoProject = {
    root,
    config,
    get revision() {
      return revision;
    },
    invalidateStories(rootId, files) {
      const rootConfig = config.stories?.roots.find(item => item.id === rootId);
      if (!rootConfig) return;
      for (const file of files)
        storyCache.delete(`${rootId}:${resolve(root, rootConfig.dir, file)}`);
      refresh();
    },
    /** Discover a registry snapshot, reusing it only while a watcher can invalidate stale entries. */
    async registry() {
      if (cached) return cached;
      const requested = ++generation;
      const stories = indexStories(root, config.stories?.roots ?? [], storyCache);
      const legacy = {
        title: config.title,
        specs: config.specs,
        prototypes: config.prototypes,
        drafts: config.drafts,
        flows: config.flows,
        roles: config.roles,
        siteUrl: config.siteUrl,
        sourceRoots: sourceRoots(config),
      };
      const found = findPrototypes(root, root, legacy);
      const flow = findFlows(root, root, found.entries, legacy);
      const problems = [...found.problems, ...flow.problems].filter(
        p => !(config.specs === null && p.code === "unknown_spec")
      );
      const registry: Registry = {
        ...(config.stories
          ? {
              storyRoots: config.stories.roots.map(item => ({
                id: item.id,
                title: item.title ?? item.id,
              })),
              stories: stories.entries,
            }
          : {}),
        title: config.title,
        locale: config.locale,
        specs: config.specs,
        roles: config.roles,
        siteUrl: config.siteUrl,
        sourceRoots: sourceRoots(config),
        prototypes: found.entries.flatMap(p =>
          p.meta
            ? [
                {
                  slug: p.slug,
                  kind: p.kind,
                  file: p.file,
                  title: p.meta.title,
                  spec: p.meta.spec ?? null,
                  surface: p.meta.surface ?? null,
                  route: p.meta.route ?? null,
                  blocks: [...(p.meta.blocks ?? [])],
                  roles: [...(p.meta.roles ?? Object.keys(config.roles))],
                  standalone: p.meta.standalone ?? false,
                  states: p.meta.states.map(s => ({
                    ...s,
                  })) as Registry["prototypes"][number]["states"],
                },
              ]
            : []
        ),
        flows: flow.flows.map(f => ({ ...f, steps: f.nodes.length })),
        problems: [
          ...stories.problems,
          ...(problems.map(p => ({
            ...p,
            slug: "slug" in p ? (p.slug ?? undefined) : undefined,
          })) as Registry["problems"]),
        ],
        warnings: [
          ...stories.warnings,
          ...flow.warnings.map(w => ({
            code: "uncovered_state" as const,
            message: `${w.slug}: ${w.state} is uncovered`,
            proto: w.slug,
            state: w.state,
          })),
          ...(config.specs === null
            ? [
                {
                  code: "specs_unavailable" as const,
                  message: "Spec catalog unavailable; spec checks skipped",
                },
              ]
            : []),
          ...(!existsSync(join(root, config.canvas))
            ? [{ code: "canvas_missing" as const, message: "Canvas missing; using passthrough" }]
            : []),
        ],
      };
      revisions.set(registry, requested);
      // Without observers, explicit CLI reads remain fresh without a background process.
      if (requested === generation) {
        revision = requested;
        if (listeners.size) cached = registry;
      }
      return registry;
    },
    watch(onChange) {
      // Each subscription has its own lifetime, even when a caller reuses a callback.
      const listener = (registry: Registry) => onChange(registry);
      listeners.add(listener);
      stopWatch ??= observe();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stopWatch?.();
          stopWatch = undefined;
          cached = undefined;
        }
      };
    },
    /** Build a local or remote presentation URL, validating the remote base before adding context. */
    url(target, options) {
      const base = options?.remote
        ? process.env.PROTO_REMOTE_URL || config.review.remote?.url
        : `http://127.0.0.1:${config.dev.port}`;
      if (!base) throw new ProtoError("invalid_config", "review.remote.url is required");
      if (!URL.canParse(base))
        throw new ProtoError("invalid_config", "The remote review URL is invalid.");
      const url =
        target.bare && !options?.remote
          ? new URL(
              `/__proto/render/${encodeURIComponent(target.slug)}`,
              `http://127.0.0.1:${config.dev.port + 1}`
            )
          : new URL(base);
      if (target.bare && !options?.remote) url.searchParams.set("chrome", "0");
      else url.searchParams.set("p", target.slug);
      if (target.state) url.searchParams.set("state", target.state);
      if (target.theme) url.searchParams.set("theme", target.theme);
      if (target.role) url.searchParams.set("role", target.role);
      if (target.width) url.searchParams.set("w", String(target.width));
      return url.href;
    },
    store(options) {
      if (options?.remote) {
        const url = process.env.PROTO_REMOTE_URL || config.review.remote?.url;
        if (!url)
          throw new ProtoError("auth_required", "Configure review.remote.url or PROTO_REMOTE_URL.");
        return new HttpStore({ url, token: () => remoteToken(url) });
      }
      return new FileStore({
        root,
        registry: () => project.registry(),
        roots: sourceRoots(config),
      });
    },
    screenshot: target =>
      capture(project, target, false) as Promise<{ path: string; width: number; height: number }>,
    evidence: target => capture(project, target, true),
    migrate: options => migrateFiles(root, options),
  };
  return project;
}
