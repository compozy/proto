import { createRoot } from "react-dom/client";
import { config } from "virtual:proto/story-config";
import { entries } from "virtual:proto/story-entries";
import { loadPreview, previewPath } from "virtual:proto/story-preview";
import {
  composeStories,
  setProjectAnnotations,
  addons,
  mockChannel,
  within,
  userEvent,
  type ComposedStory,
} from "virtual:proto/story-runtime";
import { storyCompileAllowance, type StoryResult, type StoryStage } from "../model/protocol.ts";
import { createBridge } from "./bridge.ts";
import { RenderBoundary, StoryPicker } from "./shared.tsx";

import { RenderCommit } from "./render-commit.ts";
import { messageOf } from "./errors.ts";

// Public Storybook entry points do not export this event constant.
const STORY_RENDERED = "storyRendered";
const params = new URLSearchParams(window.location.search);
const storyId =
  params.get("story") ?? decodeURIComponent(window.location.pathname.split("/").at(-1) ?? "");
const bridge = createBridge({
  self: window,
  shellOrigin: config.shellOrigin,
  frame: params.get("frame"),
});
const started = performance.now();
const requestedTimeout = Number(params.get("timeout") ?? 30000);
const timeout = Math.min(
  120000,
  Math.max(1000, Number.isFinite(requestedTimeout) ? requestedTimeout : 30000)
);
let stage: StoryStage = "import";
let hasPlay: boolean | null = null;
let terminal = false;
const lifecycle = new AbortController();
const compilerErrors: { files: string[]; message: string }[] = [];
let importedFile = "";
function modulePath(value: string) {
  try {
    const path = decodeURIComponent(new URL(value, window.location.href).pathname);
    if (path.startsWith("/@fs/")) return path.slice(4);
    return /^https?:/.test(value) ? config.dir + path : path;
  } catch {
    return value.split("?")[0]!;
  }
}
async function importMessage(error: unknown) {
  const message = messageOf(error);
  // A rejection can name a transitive module rather than the requested entry.
  const rejected = new Set(
    [importedFile, ...(message.match(/(?:https?:\/\/|\/)[^\s"'<>]+/g) ?? [])].map(modulePath)
  );
  const matching = () => compilerErrors.find(error => error.files.some(file => rejected.has(file)));
  const generic = /(?:dynamically imported module|Importing a module script|Failed to fetch)/i.test(
    message
  );
  if (!matching() && generic && import.meta.hot) {
    // HTTP rejection and the HMR error use different sockets. Neither is ordered first.
    const remaining = Math.max(0, Math.min(500, timeout - counted - 51));
    await new Promise(resolve => setTimeout(resolve, remaining));
  }
  return matching()?.message ?? message;
}
function report(status: StoryResult["status"], error: string | null = null) {
  if (terminal) return;
  terminal = status !== "running";
  const result: StoryResult = {
    story: storyId,
    stage,
    status,
    hasPlay,
    error: error?.slice(0, 4000) ?? null,
    durationMs: Math.round(performance.now() - started),
  };
  document.documentElement.dataset.protoStory = JSON.stringify(result);
  bridge.post({ type: "story:status", ...result });
  if (terminal) {
    clearInterval(deadline);
    lifecycle.abort();
  }
}
// Time the story server spends compiling modules is not the story's: a cold module graph (a
// loader importing a whole route tree, or many cold pages at once) pauses the clock, up to
// `storyCompileAllowance`. The server reports compilation while transforms are in flight.
let compiledAt = Number.NEGATIVE_INFINITY;
let counted = 0;
let tickedAt = started;
let beatAt = started;
const deadline = setInterval(() => {
  const now = performance.now();
  const compiling = now - compiledAt < 1000;
  if (!compiling) counted += now - tickedAt;
  tickedAt = now;
  if (counted >= timeout) report("failed", `Story timed out at ${stage} after ${timeout} ms`);
  else if (now - started >= timeout + storyCompileAllowance)
    report(
      "failed",
      `Story timed out at ${stage} after ${Math.round(now - started)} ms, ${Math.round(now - started - counted)} ms of them compiling on the story server`
    );
  else if (compiling && now - beatAt >= 1000) {
    // The runner's own deadline follows these reports while the clock is paused.
    beatAt = now;
    report("running");
  }
}, 50);
function enter(next: StoryStage) {
  stage = next;
  report("running");
}
function applyTheme(theme: unknown) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}
function nextPaint() {
  return new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 100);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      })
    );
  });
}
/** user-event installs a clipboard stub; restore the descriptor as Storybook's preview does. */
function setupUserEvent() {
  const clipboard = Object.getOwnPropertyDescriptor(window.navigator, "clipboard");
  const user = userEvent.setup();
  if (clipboard) Object.defineProperty(window.navigator, "clipboard", clipboard);
  else Reflect.deleteProperty(window.navigator, "clipboard");
  return user;
}
if (import.meta.hot) {
  import.meta.hot.on("proto:story-compiling", () => {
    compiledAt = performance.now();
  });
  import.meta.hot.on(
    "proto:story-import-error",
    (payload: { entries: string[]; message: string }) => {
      compilerErrors.push({ files: payload.entries.map(modulePath), message: payload.message });
    }
  );
  import.meta.hot.on("vite:error", payload => {
    compilerErrors.push({
      files: [payload.err.id, payload.err.loc?.file]
        .filter((file): file is string => !!file)
        .map(modulePath),
      message: payload.err.message,
    });
  });
}
async function run() {
  enter("import");
  try {
    const entry = entries.find(file => file.stories.some(story => story.id === storyId));
    const indexed = entry?.stories.find(story => story.id === storyId);
    if (!entry || !indexed) throw new Error(`Unknown story: ${storyId}`);
    if (config.staticBuild && !window.isSecureContext)
      throw new Error("Story service workers need a secure context: use HTTPS or a loopback host.");
    importedFile = previewPath;
    const preview = await loadPreview();
    lifecycle.signal.throwIfAborted();
    const project = setProjectAnnotations([preview]);
    const channel = mockChannel();
    addons.setChannel(channel);
    await project.beforeAll?.();
    lifecycle.signal.throwIfAborted();
    importedFile = entry.modulePath;
    const module = await entry.load();
    lifecycle.signal.throwIfAborted();
    const theme = params.get("theme") === "dark" ? "dark" : "light";
    const stories = composeStories(
      { ...module, default: { ...module.default, title: entry.title } },
      { initialGlobals: { [config.themeGlobal]: theme } }
    ) as unknown as Record<string, ComposedStory>;
    const Story = stories[indexed.exportName];
    if (!Story || Story.id !== indexed.id)
      throw new Error(`Story id mismatch: expected ${indexed.id}, received ${Story?.id}`);
    hasPlay = typeof Story.play === "function";
    enter("load");
    applyTheme(Story.globals[config.themeGlobal] ?? theme);
    await Story.load();
    lifecycle.signal.throwIfAborted();
    enter("render");
    const canvasElement = document.getElementById("proto-story-canvas")!;
    const layout = Story.parameters.layout;
    canvasElement.style.padding = layout === "fullscreen" ? "0" : "1rem";
    if (layout === "centered")
      Object.assign(canvasElement.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        boxSizing: "border-box",
      });
    const root = createRoot(canvasElement);
    await new Promise<void>((resolve, reject) => {
      root.render(
        <RenderBoundary
          component={Story}
          onError={error => {
            report("failed", messageOf(error));
            reject(error);
          }}
        >
          <RenderCommit onCommit={resolve}>
            <Story />
          </RenderCommit>
        </RenderBoundary>
      );
    });
    lifecycle.signal.throwIfAborted();
    channel.emit(STORY_RENDERED, Story.id);
    document.documentElement.dataset.protoReady = `${entry.slug}:${indexed.id}`;
    bridge.post({ type: "ready", slug: entry.slug, state: indexed.id });
    const overlays = document.getElementById("proto-story-overlays")!;
    createRoot(overlays).render(<StoryPicker bridge={bridge} />);
    await nextPaint();
    lifecycle.signal.throwIfAborted();
    if (params.get("play") !== "0" && Story.play) {
      enter("play");
      await Story.play({
        canvasElement,
        canvas: within(canvasElement),
        userEvent: setupUserEvent(),
      });
    }
    report("passed");
  } catch (error) {
    report("failed", stage === "import" ? await importMessage(error) : messageOf(error));
  }
}
void run();
