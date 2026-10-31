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
