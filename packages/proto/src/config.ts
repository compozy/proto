/**
 * Per-app gallery configuration, `apps/<app>/gallery.config.ts`. Plain data: the CLI and the
 * Vite plugin read it in Node and hand a serialized copy to the gallery shell.
 */
export type GalleryConfig = {
  /** Shown in the gallery title and sidebar header. */
  title: string;
  /**
   * Optional groups (specs) in gallery order: id → short title. A prototype or flow names one with
   * `spec`; the rest are listed under "Unsorted".
   */
  specs?: Readonly<Record<string, string>>;
  /** Optional roles a prototype can be previewed as (`?role=`): id → label, in picker order. */
  roles?: Readonly<Record<string, string>>;
  /** Origin that relative URLs of external flow nodes resolve against (`site` nodes). */
  siteUrl?: string;
};

export type ResolvedGalleryConfig = {
  title: string;
  specs: Record<string, string>;
  roles: Record<string, string>;
  siteUrl: string | null;
};

export function defineGalleryConfig<const Config extends GalleryConfig>(config: Config): Config {
  return config;
}

export function resolveGalleryConfig(config: GalleryConfig): ResolvedGalleryConfig {
  return {
    title: config.title,
    specs: { ...config.specs },
    roles: { ...config.roles },
    siteUrl: config.siteUrl ? new URL(config.siteUrl).origin : null,
  };
}

/** Public configuration evaluated in Node, never inside a prototype module. */
export type ImportMatcher = string | RegExp;
export type ProtoConfig = {
  title: string;
  prototypes?: string | readonly string[];
  drafts?: string;
  flows?: string;
  canvas?: string;
  specs?: Readonly<Record<string, string>> | ((root: string) => Record<string, string> | null);
  roles?: Readonly<Record<string, string>>;
  siteUrl?: string;
  locale?: "en" | "pt-BR";
  guards?: { forbidRuntimeImports?: readonly ImportMatcher[]; productionBoundary?: boolean };
  review?: { remote?: { url: string } };
  evidence?: { dir?: string };
  build?: { includeReview?: boolean };
  dev?: { port?: number; poll?: boolean; allowedHosts?: readonly string[] };
};

import { z } from "zod";
import { ProtoError } from "./model/errors.ts";

const labels = z.record(z.string().regex(/^[a-z0-9][a-z0-9_-]*$/), z.string());
const protoConfigSchema = z.object({
  title: z.string().min(1),
  prototypes: z.union([z.string(), z.array(z.string())]).default("src/**/*.proto.tsx"),
  drafts: z.string().default("src/drafts"),
  flows: z.string().default("flows"),
  canvas: z.string().default("proto.canvas.tsx"),
  specs: z
    .union([
      labels,
      z.custom<(root: string) => Record<string, string> | null>(
        value => typeof value === "function"
      ),
    ])
    .optional(),
  roles: labels.default({}),
  siteUrl: z.url().optional(),
  locale: z.enum(["en", "pt-BR"]).default("en"),
  guards: z
    .object({
      forbidRuntimeImports: z.array(z.union([z.string(), z.instanceof(RegExp)])).default([]),
      productionBoundary: z.boolean().default(true),
    })
    .prefault({}),
  review: z.object({ remote: z.object({ url: z.url() }).optional() }).prefault({}),
  evidence: z.object({ dir: z.string().default("docs/design") }).prefault({}),
  build: z.object({ includeReview: z.boolean().default(false) }).prefault({}),
  dev: z
    .object({
      port: z.number().int().min(1).max(65534).default(4400),
      poll: z.boolean().default(false),
      allowedHosts: z
        .array(
          z
            .string()
            .regex(/^[a-zA-Z0-9.-]+$/, "dev.allowedHosts entries must be hostnames without ports")
        )
        .default([]),
    })
    .prefault({}),
});

export type ResolvedProtoConfig = Omit<z.output<typeof protoConfigSchema>, "specs" | "siteUrl"> & {
  specs: Record<string, string> | null;
  siteUrl: string | null;
};

export function defineProtoConfig<const Config extends ProtoConfig>(config: Config): Config {
  return config;
}

export function resolveProtoConfig(
  input: ProtoConfig,
  root: string,
  env: Record<string, string | undefined> = process.env
): ResolvedProtoConfig {
  const result = protoConfigSchema.safeParse(input);
  if (!result.success)
    throw new ProtoError(
      "invalid_config",
      result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")
    );
  const config = result.data;
  let specs: unknown;
  try {
    specs = typeof config.specs === "function" ? config.specs(root) : (config.specs ?? {});
  } catch (error) {
    throw new ProtoError("invalid_config", `specs: ${String(error)}`);
  }
  const catalog = labels.nullable().safeParse(specs);
  if (!catalog.success) throw new ProtoError("invalid_config", `specs: ${catalog.error.message}`);
  const port = env.PROTO_PORT === undefined ? config.dev.port : Number(env.PROTO_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65534)
    throw new ProtoError(
      "invalid_config",
      "dev.port: expected an integer between 1 and 65534 (PROTO_PORT)"
    );
  return {
    ...config,
    specs: catalog.data,
    siteUrl: config.siteUrl ? new URL(config.siteUrl).origin : null,
    dev: { ...config.dev, port, poll: env.PROTO_POLL === "1" || config.dev.poll },
  };
}
