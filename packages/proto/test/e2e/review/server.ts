/**
 * The real `proto dev` of `apps/app` (shell from `dist/shell`, render server, review router)
 * with its review store in a temporary directory, so journeys never touch the repository's
 * review files. `bun test/e2e/review/server.ts [port]` serves it for manual checks.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { sourceRoots } from "../../../src/model/source.ts";
import { startDev } from "../../../src/node/dev.ts";
import { loadProject } from "../../../src/node/project.ts";
import {
  createDevAuthorizer,
  createReviewRouter,
  ReviewEvents,
} from "../../../src/review/index.ts";
import { FileStore } from "../../../src/store/index.ts";

export const app = resolve(import.meta.dirname, "../../../../../apps/app");

export async function freePort() {
  for (;;) {
    const server = createServer();
    await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>(done => server.close(() => done()));
    // The render server takes port + 1.
    const next = createServer();
    const free = await new Promise<boolean>(done => {
      next.once("error", () => done(false));
      next.listen(port + 1, "127.0.0.1", () => next.close(() => done(true)));
    });
    if (free) return port;
  }
}

export async function startReviewDev(port?: number) {
  const project = await loadProject(app);
  const directory = await mkdtemp(join(tmpdir(), "proto-review-e2e-"));
  const store = new FileStore({
    root: project.root,
    directory,
    registry: () => project.registry(),
    roots: sourceRoots(project.config),
  });
  const selected = port ?? (await freePort());
  const origin = `http://127.0.0.1:${selected}`;
  const events = new ReviewEvents();
  const router = createReviewRouter({
    store,
    registry: () => project.registry(),
    events,
    authorize: createDevAuthorizer({ shellOrigin: origin }),
    roots: sourceRoots(project.config),
    commit: () => "a41c9e2f0b7d4c6e8a1b2c3d4e5f60718293a4b5",
  });
  const server = await startDev(project, { port: selected, review: router });
  const stopEvents = events.subscribe(event => {
    if (event.type !== "registry") server.publish(event.type, { key: event.key });
  });
  // Writes made outside the router (the CLI, an agent) reach the shell like in `proto dev`.
  const stopWatch = await store.subscribe(event => events.publish(event));
  return {
    origin: server.origin,
    store,
    async close() {
      stopWatch();
      stopEvents();
      await server.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

if (import.meta.main) {
  const server = await startReviewDev(Number(process.argv[2]) || undefined);
  console.log(`proto review e2e server: ${server.origin}`);
}
