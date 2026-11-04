/**
 * A stand-in story host for the shell suites (query form, `?story=<id>`): it speaks the real
 * shell ⇄ render protocol for the stories of `storyRegistry` (`test/harness/fixtures.ts`). The
 * real host and its lifecycle are covered against real Storybook in `test/node/dev`; here only
 * the shell side is under test. `--import-fail` fails at `import` and `--render-fail` at
 * `render`, both before `ready`; every other story renders and posts `ready`, and runs its
 * `play` only when the URL asks for it, counted in `html.dataset.playCalls`.
 */
import { protocolVersion } from "../../../../src/model/protocol.ts";

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
