/**
 * Where the shell runs, learned from `bootstrap.json`, and where each frame loads from. Plain
 * module (no React): the data provider in `shell-data.tsx` and the frame hooks share it.
 */
import type { Bootstrap } from "../../model/bootstrap";

/** Relative, so the shell works under any base path (static builds, remote `basePath`). */
export const bootstrapHref = "__proto/bootstrap.json";

export type ShellEnv = {
  bootstrap: Bootstrap;
  /** Absolute prototype render base (bootstrap `renderUrl` resolved against the document). */
  renderUrl: string;
  /** The only origin prototype frames accept messages from; stories use `frameEndpoint`. */
  renderOrigin: string;
};

/** Where one frame loads and the only origin its messages are accepted from. */
export type FrameEndpoint = { renderUrl: string; origin: string };

/**
 * The endpoint of a frame target: the render host for a prototype (`root` null), or that story
 * root's server from bootstrap `storyRoots`. Null when no server runs for the root (a root left
 * out of `proto dev`, or a build without stories): such a frame never loads.
 */
export function frameEndpoint(env: ShellEnv, root: string | null): FrameEndpoint | null {
  if (root === null) return { renderUrl: env.renderUrl, origin: env.renderOrigin };
  const story = env.bootstrap.storyRoots?.find(item => item.id === root);
  if (!story) return null;
  const renderUrl = new URL(story.renderUrl, document.baseURI).href;
  return { renderUrl, origin: new URL(renderUrl).origin };
}
