import { matchesGlob } from "node:path";
import { validatePortRange } from "../config.ts";
import { ProtoError } from "../model/errors.ts";
import { storyHref, storyResultSchema, type StoryResult } from "../model/protocol.ts";
import { startDev } from "./dev.ts";
import { projectId } from "./story-server.ts";
import type { ProtoProject } from "./project.ts";
export type StoryRunOptions = {
  port?: number;
  root?: string;
  filter?: string;
  concurrency?: number;
  timeout?: number;
  theme?: "light" | "dark";
  signal?: AbortSignal;
};
export type StoryRunRow = Omit<StoryResult, "story"> & { id: string; root: string };
/** Shared headless story lifecycle engine for the CLI, MCP and parity harness. */
export async function runStories(project: ProtoProject, options: StoryRunOptions = {}) {
  const registry = await project.registry();
  if (options.root && !registry.storyRoots?.some(root => root.id === options.root))
    throw new ProtoError("invalid_input", `Unknown root "${options.root}".`);
  const selected = (registry.stories ?? [])
    .filter(file => !options.root || file.root === options.root)
    .flatMap(file =>
      file.stories
        .filter(story => !options.filter || matchesGlob(story.id, options.filter))
        .map(story => ({ file, story }))
    );
  if (!selected.length)
    throw new ProtoError(
      "story_not_found",
      `No story matches ${options.filter ?? options.root ?? "the selection"}.`
    );
  const timeout = Math.min(120000, Math.max(1000, options.timeout ?? 30000));
  const concurrency = options.concurrency ?? 6;
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 32 ||
    !Number.isFinite(timeout)
  )
    throw new ProtoError("invalid_input", "Invalid runner concurrency or timeout");
  let browser: import("playwright").Browser | undefined;
  let owned: Awaited<ReturnType<typeof startDev>> | undefined;
  const port = options.port ?? project.config.dev.port;
  validatePortRange(port, project.config.stories?.roots.length ?? 0);
  const origin = `http://127.0.0.1:${port}`;
  const mismatch = () => new ProtoError(
    "project_mismatch",
    `The server on ${port} belongs to another project; pass --port.`
  );
  options.signal?.throwIfAborted();
  let bootstrap:
    | { projectId?: string; storyRoots?: { id: string; renderUrl: string }[] }
    | undefined;
  let response: Response | undefined;
  try {
    try {
      response = await fetch(`${origin}/__proto/bootstrap.json`, {
        signal: AbortSignal.timeout(1000),
      });
    } catch {
      owned = await startDev(project, {
        quiet: true,
        port,
        storyRoots: [...new Set(selected.map(item => item.file.root))],
      });
      bootstrap = { projectId: projectId(project.root), storyRoots: owned.storyRoots };
    }
    if (response) {
      try {
        bootstrap = await response.json();
      } catch {
        throw mismatch();
      }
      if (!response.ok || bootstrap?.projectId !== projectId(project.root)) throw mismatch();
    }
    const rows: StoryRunRow[] = [];
    options.signal?.throwIfAborted();
    try {
      browser = await (await import("playwright")).chromium.launch();
    } catch {
      throw new ProtoError("playwright_missing");
    }
    const activeBrowser = browser;
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
        while (next < selected.length && !options.signal?.aborted) {
          const item = selected[next++]!;
          const renderUrl = bootstrap?.storyRoots?.find(
            root => root.id === item.file.root
          )?.renderUrl;
          if (!renderUrl)
            throw new ProtoError(
              "project_mismatch",
              `Running gallery does not host root ${item.file.root}`
            );
          const page = await activeBrowser.newPage();
          const abort = () => {
            void page.close().catch(() => {});
          };
          options.signal?.addEventListener("abort", abort, { once: true });
          if (options.signal?.aborted) abort();
          let started = Date.now();
          let last: StoryResult = {
            story: item.story.id,
            stage: "import",
            status: "running",
            hasPlay: null,
            error: null,
            durationMs: 0,
          };
          let timedOut = false;
          const pageBudget = timeout + 5000;
          let pageDeadline: ReturnType<typeof setTimeout> | undefined;
          try {
            await page.exposeFunction("__protoStoryReport", (value: unknown) => {
              const parsed = storyResultSchema.safeParse(value);
              if (last.status === "running" && parsed.success && parsed.data.story === item.story.id)
                last = parsed.data;
            });
            await page.addInitScript(() => {
              new MutationObserver(() => {
                const value = document.documentElement?.dataset.protoStory;
                if (value)
                  void (
                    window as unknown as { __protoStoryReport(value: unknown): Promise<void> }
                  ).__protoStoryReport(JSON.parse(value));
              }).observe(document, {
                subtree: true,
                attributes: true,
                attributeFilter: ["data-proto-story"],
              });
            });
            started = Date.now();
            pageDeadline = setTimeout(() => {
              timedOut = true;
              void page.close().catch(() => {});
            }, pageBudget);
            await page.goto(
              storyHref(renderUrl, {
                kind: "story",
                root: item.file.root,
                slug: item.file.slug,
                story: item.story.id,
                theme: options.theme ?? "dark",
                play: true,
                timeout,
              }),
              { waitUntil: "commit", timeout: pageBudget }
            );
            const remaining = Math.max(1, pageBudget - (Date.now() - started));
            await page.waitForFunction(
              () => {
                const value = document.documentElement.dataset.protoStory;
                return value && JSON.parse(value).status !== "running";
              },
              undefined,
              { timeout: remaining }
            );
            if (last.status === "running")
              last = storyResultSchema.parse(
                await page.evaluate(() => JSON.parse(document.documentElement.dataset.protoStory!))
              );
          } catch (error) {
            try {
              const value = await page.evaluate(() => document.documentElement.dataset.protoStory);
              if (value && last.status === "running") last = storyResultSchema.parse(JSON.parse(value));
            } catch {
              /* A dead document has no readable result. */
            }
            if (last.status === "running")
              last = {
                ...last,
                status: "failed",
                error: timedOut || (error instanceof Error && error.name === "TimeoutError")
                  ? `Story timed out at ${last.stage} after ${pageBudget}ms.`
                  : String(error).slice(0, 4000),
                durationMs: Date.now() - started,
              };
          } finally {
            clearTimeout(pageDeadline);
            options.signal?.removeEventListener("abort", abort);
            await page.close().catch(() => {});
          }
          const { story, ...result } = last;
          rows.push({ ...result, id: story, root: item.file.root });
        }
      })
    );
    options.signal?.throwIfAborted();
    const order = new Map(selected.map((item, index) => [item.story.id, index]));
    rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return { results: rows, problems: registry.problems, warnings: registry.warnings };
  } finally {
    try {
      await browser?.close();
    } finally {
      await owned?.close();
    }
  }
}
