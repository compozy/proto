import { matchesGlob } from "node:path";
import { ProtoError } from "../model/errors.ts";
import { storyHref, storyResultSchema, type StoryResult } from "../model/protocol.ts";
import { startDev } from "./dev.ts";
import { projectId } from "./story-server.ts";
import type { ProtoProject } from "./project.ts";
export type StoryRunOptions = {
  root?: string;
  filter?: string;
  concurrency?: number;
  timeout?: number;
  theme?: "light" | "dark";
  signal?: AbortSignal;
};
export type StoryRunRow = Omit<StoryResult, "story"> & { id: string; root: string };
/** Internal batch engine; deliberately absent from the capability catalog. */
export async function runStories(project: ProtoProject, options: StoryRunOptions = {}) {
  const registry = await project.registry();
  if (options.root && !registry.storyRoots?.some(root => root.id === options.root))
    throw new ProtoError("invalid_input", "Unknown story root");
  const selected = (registry.stories ?? [])
    .filter(file => !options.root || file.root === options.root)
    .flatMap(file =>
      file.stories
        .filter(story => !options.filter || matchesGlob(story.id, options.filter))
        .map(story => ({ file, story }))
    );
  if (!selected.length) throw new ProtoError("story_not_found");
  const timeout = Math.min(120000, Math.max(1000, options.timeout ?? 30000));
  const concurrency = options.concurrency ?? 4;
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 32 ||
    !Number.isFinite(timeout)
  )
    throw new ProtoError("invalid_input", "Invalid runner concurrency or timeout");
  let browser: import("playwright").Browser | undefined;
  let owned: Awaited<ReturnType<typeof startDev>> | undefined;
  const origin = `http://127.0.0.1:${project.config.dev.port}`;
  let bootstrap:
    | { projectId?: string; storyRoots?: { id: string; renderUrl: string }[] }
    | undefined;
  let response: Response | undefined;
  try {
    response = await fetch(`${origin}/__proto/bootstrap.json`, {
      signal: AbortSignal.timeout(1000),
    });
  } catch {
    owned = await startDev(project, {
      quiet: true,
      storyRoots: [...new Set(selected.map(item => item.file.root))],
    });
    bootstrap = { projectId: projectId(project.root), storyRoots: owned.storyRoots };
  }
  if (response) {
    try {
      bootstrap = await response.json();
    } catch {
      throw new ProtoError("project_mismatch");
    }
    if (!response.ok || bootstrap?.projectId !== projectId(project.root))
      throw new ProtoError("project_mismatch");
  }
  const rows: StoryRunRow[] = [];
  try {
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
            void page.close();
          };
          options.signal?.addEventListener("abort", abort, { once: true });
          const started = Date.now();
          let last: StoryResult = {
            story: item.story.id,
            stage: "import",
            status: "running",
            hasPlay: null,
            error: null,
            durationMs: 0,
          };
          const pageDeadline = setTimeout(() => {
            void page.close();
          }, timeout + 5000);
          await page.exposeFunction("__protoStoryReport", (value: unknown) => {
            const parsed = storyResultSchema.safeParse(value);
            if (parsed.success && parsed.data.story === item.story.id) last = parsed.data;
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
          try {
            await page.goto(
              storyHref(renderUrl, {
                kind: "story",
                root: item.file.root,
                slug: item.file.slug,
                story: item.story.id,
                theme: options.theme ?? "light",
                play: true,
                timeout,
              }),
              { waitUntil: "commit", timeout: timeout + 5000 }
            );
            const remaining = Math.max(1, timeout + 5000 - (Date.now() - started));
            await page.waitForFunction(
              () => {
                const value = document.documentElement.dataset.protoStory;
                return value && JSON.parse(value).status !== "running";
              },
              undefined,
              { timeout: remaining }
            );
            last = storyResultSchema.parse(
              await page.evaluate(() => JSON.parse(document.documentElement.dataset.protoStory!))
            );
          } catch (error) {
            try {
              const value = await page.evaluate(() => document.documentElement.dataset.protoStory);
              if (value) last = storyResultSchema.parse(JSON.parse(value));
            } catch {
              /* A dead document has no readable result. */
            }
            last = {
              ...last,
              status: "failed",
              error: String(error).slice(0, 4000),
              durationMs: Date.now() - started,
            };
          } finally {
            clearTimeout(pageDeadline);
            options.signal?.removeEventListener("abort", abort);
            await page.close();
          }
          const { story, ...result } = last;
          rows.push({ ...result, id: story, root: item.file.root });
        }
      })
    );
    return { results: rows, problems: registry.problems, warnings: registry.warnings };
  } finally {
    await browser?.close();
    await owned?.close();
  }
}
