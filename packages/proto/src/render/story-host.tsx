import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
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
import type { StoryResult, StoryStage } from "../model/protocol.ts";
import { createBridge } from "./bridge.ts";
import { RenderBoundary, StoryPicker, messageOf } from "./shared.tsx";

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
    const remaining = Math.max(0, Math.min(500, timeout - (performance.now() - started) - 1));
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
  if (terminal) clearTimeout(deadline);
}
const deadline = setTimeout(
  () => report("failed", `Story timed out at ${stage} after ${timeout} ms`),
  timeout
);
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
  import.meta.hot.on("proto:story-import-error", (payload: { entries: string[]; message: string }) => {
    compilerErrors.push({ files: payload.entries.map(modulePath), message: payload.message });
  });
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
    if (terminal) return;
    const project = setProjectAnnotations([preview]);
    const channel = mockChannel();
    addons.setChannel(channel);
    await project.beforeAll?.();
    if (terminal) return;
    importedFile = entry.modulePath;
    const module = await entry.load();
    if (terminal) return;
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
    if (terminal) return;
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
    flushSync(() =>
      root.render(
        <RenderBoundary component={Story} onError={error => report("failed", messageOf(error))}>
          <Story />
        </RenderBoundary>
      )
    );
    if (terminal) return;
    channel.emit(STORY_RENDERED, Story.id);
    document.documentElement.dataset.protoReady = `${entry.slug}:${indexed.id}`;
    bridge.post({ type: "ready", slug: entry.slug, state: indexed.id });
    const overlays = document.getElementById("proto-story-overlays")!;
    createRoot(overlays).render(<StoryPicker bridge={bridge} />);
    await nextPaint();
    if (terminal) return;
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
