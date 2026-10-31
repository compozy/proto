import type { Plugin } from "vite";

/**
 * Fails a production build when a prototype-only module reaches a chunk: prototypes, fixtures,
 * stories, drafts, flows, the gallery package, preview wiring or Storybook config.
 */
export function productionBoundary(): Plugin {
  const prototypeOnly =
    /\.(proto|fixtures|stories)\.[cm]?[jt]sx?(?:\?|$)|\/src\/drafts\/|\/apps\/[^/]+\/(flows|preview|gallery|\.storybook)\/|\/packages\/(?:gallery|proto)\//;
  return {
    name: "gallery:production-boundary",
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const id of Object.keys(output.modules)) {
          if (prototypeOnly.test(id))
            this.error(
              `production_boundary: Prototype-only module reached the production bundle: ${id}`
            );
        }
      }
    },
  };
}
