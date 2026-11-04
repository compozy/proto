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
  const mismatch = () =>
    new ProtoError(
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
      if (!response.ok) throw mismatch();
      try {
        bootstrap = await response.json();
      } catch {
        throw mismatch();
      }
      if (bootstrap?.projectId !== projectId(project.root)) throw mismatch();
    }
    const rows: StoryRunRow[] = [];
    options.signal?.throwIfAborted();
    try {
      // The CLI owns SIGINT cancellation and closes pages/servers before returning its exit code.
      browser = await (await import("playwright")).chromium.launch({ handleSIGINT: false });
    } catch {
      throw new ProtoError("playwright_missing");
    }
    const chromium = (await import("playwright")).chromium;
    // One shared launch attempt per lost browser, including a failed relaunch. Workers
    // must not race to create replacements or retry a broken installation for every row.
    let replacement: Promise<import("playwright").Browser> | undefined;
    let replacedBrowser: import("playwright").Browser | undefined;
    const getBrowser = async () => {
      if (browser!.isConnected()) return browser!;
      if (replacedBrowser !== browser) {
        replacedBrowser = browser;
        replacement = chromium.launch({ handleSIGINT: false }).then(value => {
          browser = value;
          return value;
        });
      }
      return replacement!;
    };
    const renderUrls = new Map(bootstrap?.storyRoots?.map(root => [root.id, root.renderUrl]));
    const runStory = async (item: (typeof selected)[number]) => {
      if (options.signal?.aborted) return;
      const renderUrl = renderUrls.get(item.file.root);
      if (!renderUrl)
        throw new ProtoError(
          "project_mismatch",
          `Running gallery does not host root ${item.file.root}`
        );
      let page: import("playwright").Page | undefined;
      const abort = () => {
        void page?.close().catch(() => {});
      };
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
        page = await (await getBrowser()).newPage();
        options.signal?.addEventListener("abort", abort, { once: true });
        if (options.signal?.aborted) {
          abort();
          options.signal.throwIfAborted();
        }
        await page.exposeFunction("__protoStoryReport", (value: unknown) => {
          try {
            const parsed = storyResultSchema.safeParse(
              typeof value === "string" ? JSON.parse(value) : value
            );
            if (!parsed.success || parsed.data.story !== item.story.id) return false;
            if (last.status === "running") last = parsed.data;
            return last.status !== "running";
          } catch {
            return false;
          }
        });
        await page.addInitScript(() => {
          new MutationObserver(() => {
            const html = document.documentElement;
            const value = html?.dataset.protoStory;
            if (!html || typeof value !== "string") return;
            void (window as unknown as { __protoStoryReport(value: unknown): Promise<boolean> })
              .__protoStoryReport(value)
              .then(terminal => {
                // A synchronous polling flag, acknowledged only after Node validates the report.
                if (terminal) html.dataset.protoStoryTerminal = "true";
              });
          }).observe(document, {
            subtree: true,
            attributes: true,
            attributeFilter: ["data-proto-story"],
          });
        });
        started = Date.now();
        pageDeadline = setTimeout(() => {
          timedOut = true;
          void page?.close().catch(() => {});
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
          () => document.documentElement.dataset.protoStoryTerminal === "true",
          undefined,
          { timeout: remaining }
        );
        if (last.status === "running")
          throw new Error("Story terminal acknowledgement arrived without a validated report");
      } catch (error) {
        try {
          const value = await page?.evaluate(() => document.documentElement.dataset.protoStory);
          if (typeof value === "string" && last.status === "running") {
            const parsed = storyResultSchema.safeParse(JSON.parse(value));
            if (parsed.success && parsed.data.story === item.story.id) last = parsed.data;
          }
        } catch {
          /* A dead document has no readable result. */
        }
        if (last.status === "running")
          last = {
            ...last,
            status: "failed",
            error:
              timedOut || (error instanceof Error && error.name === "TimeoutError")
                ? `Story timed out at ${last.stage} after ${pageBudget}ms.`
                : String(error).slice(0, 4000),
            durationMs: Date.now() - started,
          };
      } finally {
        clearTimeout(pageDeadline);
        options.signal?.removeEventListener("abort", abort);
        await page?.close().catch(() => {});
      }
      const { story, ...result } = last;
      rows.push({ ...result, id: story, root: item.file.root });
    };
    // Prime the shared host/preview graph once per root before cold file heads
    // contend for it. No selected CSF file is imported by this preparation page.
    const warmRoot = async (renderUrl: string) => {
      let context: import("playwright").BrowserContext | undefined;
      const close = () => {
        void context?.close().catch(() => {});
      };
      options.signal?.addEventListener("abort", close, { once: true });
      try {
        context = await (await getBrowser()).newContext();
        if (options.signal?.aborted) {
          close();
          return;
        }
        const page = await context.newPage();
        page.on("pageerror", close);
        const budget = timeout + 5000;
        const started = Date.now();
        await page.goto(new URL("../story-warmup", renderUrl).href, {
          waitUntil: "commit",
          timeout: budget,
        });
        await page.waitForFunction(
          () => !!document.documentElement?.dataset.protoStoryWarmup,
          undefined,
          { timeout: Math.max(1, budget - (Date.now() - started)) }
        );
      } catch {
        // Preparation is not a selected story. Its failure cannot replace or
        // discard the real per-story outcomes, which retain their own deadlines.
      } finally {
        options.signal?.removeEventListener("abort", close);
        await context?.close().catch(() => {});
      }
    };
    const roots = new Map<string, Map<string, typeof selected>>();
    for (const item of selected) {
      let files = roots.get(item.file.root);
      if (!files) {
        files = new Map();
        roots.set(item.file.root, files);
      }
      const group = files.get(item.file.file);
      if (group) group.push(item);
      else files.set(item.file.file, [item]);
    }
    const ready: (() => Promise<void>)[] = [];
    for (const [root, files] of roots) {
      ready.push(async () => {
        const renderUrl = renderUrls.get(root);
        if (!renderUrl)
          throw new ProtoError("project_mismatch", `Running gallery does not host root ${root}`);
        await warmRoot(renderUrl);
        for (const group of files.values()) {
          ready.push(async () => {
            await runStory(group[0]!);
            // Failure is terminal too: keep its row and let the batch continue.
            for (const sibling of group.slice(1)) ready.push(() => runStory(sibling));
          });
        }
      });
    }
    const active = new Set<Promise<void>>();
    while (ready.length || active.size) {
      while (active.size < concurrency && ready.length && !options.signal?.aborted) {
        const job = ready.shift()!;
        const running: Promise<void> = job().finally(() => {
          active.delete(running);
        });
        active.add(running);
      }
      if (!active.size) break;
      await Promise.race(active);
    }
    options.signal?.throwIfAborted();
    const order = new Map(selected.map((item, index) => [item.story.id, index]));
    rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return { results: rows, problems: registry.problems, warnings: registry.warnings };
  } finally {
    try {
      await browser?.close().catch(() => {});
    } finally {
      await owned?.close();
    }
  }
}
