/**
 * Playwright-side commands for the render protocol suite: the render host runs in a
 * cross-origin iframe, so the test page cannot read its DOM or aim events at it; these act on
 * the frame whose URL contains `match`, in render viewport coordinates.
 */
import type { Frame, Page } from "playwright";
import type { BrowserCommand, BrowserCommandContext } from "vitest/node";

async function findFrame(context: BrowserCommandContext, match: string) {
  const page = (context as unknown as { page: Page }).page;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const frame = page.frames().find(candidate => candidate.url().includes(match));
    if (frame) return { page, frame };
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`No frame matches ${match}`);
}

/** Maps a render viewport point to page coordinates (the tester iframe may be scaled). */
async function toPage(frame: Frame, x: number, y: number) {
  const element = await frame.frameElement();
  const box = await element.boundingBox();
  const width = await frame.evaluate(() => window.innerWidth);
  if (!box) throw new Error("The render frame is not visible");
  const scale = box.width / width;
  return { x: box.x + x * scale, y: box.y + y * scale };
}

export const renderFrameEval: BrowserCommand<[match: string, expression: string]> = async (
  context,
  match,
  expression
) => {
  const { frame } = await findFrame(context, match);
  return frame.evaluate(expression);
};

type Pointer = { x: number; y: number };

export const renderFrameClick: BrowserCommand<[match: string, point: Pointer]> = async (
  context,
  match,
  point
) => {
  const { page, frame } = await findFrame(context, match);
  const at = await toPage(frame, point.x, point.y);
  await page.mouse.click(at.x, at.y);
};

export const renderFrameDrag: BrowserCommand<[match: string, from: Pointer, to: Pointer]> = async (
  context,
  match,
  from,
  to
) => {
  const { page, frame } = await findFrame(context, match);
  const start = await toPage(frame, from.x, from.y);
  const end = await toPage(frame, to.x, to.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
};

export const renderFrameKeys: BrowserCommand<[match: string, keys: string[]]> = async (
  context,
  match,
  keys
) => {
  const { page } = await findFrame(context, match);
  for (const key of keys) await page.keyboard.press(key);
};

declare module "vitest/browser" {
  interface BrowserCommands {
    renderFrameEval: (match: string, expression: string) => Promise<unknown>;
    renderFrameClick: (match: string, point: Pointer) => Promise<void>;
    renderFrameDrag: (match: string, from: Pointer, to: Pointer) => Promise<void>;
    renderFrameKeys: (match: string, keys: string[]) => Promise<void>;
  }
}
