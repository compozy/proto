import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ProtoError } from "../model/errors.ts";
import { startDev } from "./dev.ts";
import { confined } from "./scaffold.ts";
import type { ProtoProject } from "./project.ts";
export type CaptureTarget = {
  slug: string;
  state?: string;
  theme?: "light" | "dark";
  width?: number;
  role?: string;
};
export async function capture(project: ProtoProject, target: CaptureTarget, html = false) {
  const registry = await project.registry();
  const prototype = registry.prototypes.find(p => p.slug === target.slug);
  if (!prototype) throw new ProtoError("invalid_config", "Unknown prototype");
  const state = target.state ?? prototype.states[0].id;
  const theme = target.theme ?? "light";
  const width = target.width ?? 1440;
  if (
    !prototype.states.some(s => s.id === state) ||
    !Number.isInteger(width) ||
    width < 320 ||
    width > 3840
  )
    throw new ProtoError("invalid_config", "Invalid state or viewport width");
  let browser: import("playwright").Browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch();
  } catch {
    throw new ProtoError("playwright_missing");
  }
  let server: Awaited<ReturnType<typeof startDev>> | undefined;
  try {
    const origin = `http://127.0.0.1:${project.config.dev.port}`;
    try {
      const result = await fetch(`${origin}/__proto/bootstrap.json`, {
        signal: AbortSignal.timeout(1000),
      });
      if (!result.ok) throw Error("No server");
    } catch {
      server = await startDev(project, { quiet: true });
    }
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(
      project.url({ slug: target.slug, state, theme, role: target.role, bare: true }),
      { waitUntil: "domcontentloaded", timeout: 60_000 }
    );
    await page.waitForFunction(
      ({ slug, state }) =>
        document.documentElement.dataset.protoReady === `${slug}:${state}` ||
        document.querySelector('[data-testid="proto-render-error"]') !== null,
      { slug: target.slug, state },
      { timeout: 60_000 }
    );
    if (await page.locator('[data-testid="proto-render-error"]').count())
      throw new ProtoError("invalid_config", "Prototype failed to render.");
    await page.evaluate(() => document.fonts.ready);
    const directory = confined(project.root, join(project.config.evidence.dir, target.slug));
    mkdirSync(directory, { recursive: true });
    const name = html ? "index.html" : `${encodeURIComponent(state)}--${theme}--${width}.png`;
    const path = join(directory, name);
    if (html) {
      const content = await page.evaluate(() => {
        const copy = document.documentElement.cloneNode(true) as HTMLElement;
        copy
          .querySelectorAll("script,iframe,object,embed,link[rel=modulepreload]")
          .forEach(node => node.remove());
        copy.querySelectorAll("*").forEach(element => {
          const attributes = Array.from(element.attributes); // Snapshot the live collection before removing attributes.
          for (const attribute of attributes) {
            if (
              attribute.name.startsWith("on") ||
              attribute.name === "srcdoc" ||
              attribute.value.trim().toLowerCase().startsWith("javascript:")
            )
              element.removeAttribute(attribute.name);
            else if (["src", "href"].includes(attribute.name) && !attribute.value.startsWith("#"))
              element.setAttribute(attribute.name, new URL(attribute.value, location.href).href);
          }
        });
        return "<!doctype html>" + copy.outerHTML;
      });
      writeFileSync(path, content);
    } else await page.screenshot({ path, fullPage: false });
    return html
      ? { path: relative(project.root, path) }
      : { path: relative(project.root, path), width, height: 900 };
  } finally {
    await browser.close();
    await server?.close();
  }
}
