import { HttpStore } from "../store/http-store.ts";
import { remoteToken } from "../auth/credentials.ts";
import { existsSync, watch as watchFs, globSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
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
  watch(onChange: (registry: Registry) => void): () => void;
  url(target: UrlTarget, options?: { remote?: boolean }): string;
  store(options?: { remote?: boolean }): ReviewStore;
  screenshot(target: CaptureTarget): Promise<{ path: string; width: number; height: number }>;
  evidence(target: CaptureTarget): Promise<{ path: string }>;
  migrate(options: MigrateOptions): Promise<MigrationReport>;
}
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
  const project: ProtoProject = {
    root,
    config,
    async registry() {
      const legacy = {
        title: config.title,
        specs: config.specs,
        prototypes: config.prototypes,
        drafts: config.drafts,
        flows: config.flows,
        roles: config.roles,
        siteUrl: config.siteUrl,
      };
      const found = findPrototypes(root, root, legacy);
      const flow = findFlows(root, root, found.entries, legacy);
      const problems = [...found.problems, ...flow.problems].filter(
        p => !(config.specs === null && p.code === "unknown_spec")
      );
      return {
        title: config.title,
        locale: config.locale,
        specs: config.specs,
        roles: config.roles,
        siteUrl: config.siteUrl,
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
        problems: problems.map(p => ({
          ...p,
          slug: "slug" in p ? (p.slug ?? undefined) : undefined,
        })) as Registry["problems"],
        warnings: [
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
    },
    watch(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void project.registry().then(onChange);
        }, 75);
      };
      // Native macOS watchers can miss events in managed hosts; use the reliable polling backend.
      if (config.dev.poll || process.platform === "darwin") {
        const snapshot = () =>
          globSync(["**/*.proto.tsx", "**/*.flow.ts"], {
            cwd: root,
            exclude: ["**/node_modules/**", "**/.pending/**", "**/*.tmp/**", "**/*.lock*/**"],
          })
            .sort()
            .map(file => {
              try {
                return `${file}:${statSync(join(root, file)).mtimeMs}`;
              } catch {
                return file;
              }
            })
            .join("\n");
        let previous = snapshot();
        const interval = setInterval(() => {
          const next = snapshot();
          if (next !== previous) {
            previous = next;
            refresh();
          }
        }, 200);
        return () => {
          clearInterval(interval);
          clearTimeout(timer);
        };
      }
      const watcher = watchFs(root, { recursive: true }, (_event, file) => {
        if (
          !file ||
          /(?:\.lock|\.tmp|\.pending\/|node_modules\/)/.test(file) ||
          !/\.(proto\.tsx|flow\.ts)$/.test(file)
        )
          return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          void project.registry().then(onChange);
        }, 75);
      });
      return () => {
        clearTimeout(timer);
        watcher.close();
      };
    },
    url(target, options) {
      const base = options?.remote
        ? process.env.PROTO_REMOTE_URL || config.review.remote?.url
        : `http://127.0.0.1:${config.dev.port}`;
      if (!base) throw new ProtoError("invalid_config", "review.remote.url is required");
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
