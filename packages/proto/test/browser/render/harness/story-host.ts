/**
 * A stand-in story host for the shell suites (query form, `?story=<id>`): it speaks the real
 * shell ⇄ render protocol for the stories of `storyRegistry` (`test/harness/fixtures.ts`). The
 * real host and its lifecycle are covered against real Storybook in `test/node/dev`; here only
 * the shell side is under test. `--import-fail` fails at `import` and `--render-fail` at
 * `render`, both before `ready`; every other story renders and posts `ready`, and runs its
 * `play` only when the URL asks for it, counted in `html.dataset.playCalls`. A rendered story
 * answers the shell's `pick:start` (mode in `html.dataset.picking`) with the clicked element and
 * its `anchors:watch` with the real render-side measurement (`src/render/anchors.ts`), as the
 * real story host does through `StoryPicker`, so comment pins can place themselves.
 */
import { anchorSchema, protocolVersion } from "../../../../src/model/protocol.ts";
import { watchAnchors } from "../../../../src/render/anchors.ts";

const params = new URLSearchParams(window.location.search);
const story = params.get("story") ?? "";
const frame = params.get("frame") ?? "";
const slug = story.split("--")[0] ?? "";
const html = document.documentElement;
html.dataset.playCalls = "0";

const post = (message: Record<string, unknown>) =>
  window.parent.postMessage({ proto: protocolVersion, frame, ...message }, "*");
const report = (
  stage: "import" | "load" | "render" | "play",
  status: "running" | "passed" | "failed",
  hasPlay: boolean | null,
  error: string | null = null
) => post({ type: "story:status", story, stage, status, hasPlay, error, durationMs: 1 });

report("import", "running", null);
if (story.endsWith("--import-fail")) {
  report("import", "failed", null, "Failed to fetch dynamically imported module");
} else if (story.endsWith("--render-fail")) {
  report("render", "failed", false, "render failure");
} else {
  const hasPlay = story.endsWith("--primary");
  const button = document.createElement("button");
  button.textContent = story;
  document.body.append(button);
  let unwatch = () => {};
  window.addEventListener("message", event => {
    const data = event.data as {
      frame?: unknown;
      type?: unknown;
      mode?: unknown;
      anchors?: unknown;
    } | null;
    if (event.source !== window.parent || data?.frame !== frame) return;
    if (data.type === "pick:start") html.dataset.picking = String(data.mode);
    if (data.type === "pick:cancel") delete html.dataset.picking;
    if (data.type === "anchors:watch") {
      unwatch();
      const anchors = anchorSchema.array().parse(data.anchors);
      unwatch = watchAnchors(window, anchors, rects => post({ type: "anchors", rects }));
    }
  });
  button.addEventListener("click", () => {
    if (!html.dataset.picking) return;
    delete html.dataset.picking;
    const rect = button.getBoundingClientRect();
    const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    post({
      type: "pick:result",
      target: {
        kind: "element",
        selector: "button",
        testId: null,
        tag: "button",
        text: button.textContent ?? "",
        source: null,
        sourceChain: [],
        rect: box,
        rectNormalized: {
          x: box.x / window.innerWidth,
          y: box.y / window.innerHeight,
          width: box.width / window.innerWidth,
          height: box.height / window.innerHeight,
        },
        offset: null,
      },
    });
  });
  post({ type: "ready", slug, state: story });
  if (hasPlay && params.get("play") === "1") {
    html.dataset.playCalls = String(Number(html.dataset.playCalls) + 1);
    report("play", "running", true);
    button.textContent = "Clicked";
    report("play", "passed", true);
  } else {
    report("render", "passed", hasPlay);
  }
}
