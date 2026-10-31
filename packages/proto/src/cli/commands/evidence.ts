import { defineCommand } from "citty";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { assertSlug } from "../../node/comments-store";
import { currentApp, repoRoot } from "../../node/paths";

/** Serializes the rendered DOM: no scripts or source tags, absolute asset URLs. */
const snapshot = `(() => {
  const root = document.documentElement.cloneNode(true);
  root.querySelectorAll("script").forEach(node => node.remove());
  root.querySelectorAll("[data-proto-src]").forEach(node => node.removeAttribute("data-proto-src"));
  root.querySelectorAll("[src],[href]").forEach(node => {
    for (const name of ["src", "href"]) {
      const value = node.getAttribute(name);
      if (value && !value.startsWith("#") && !value.startsWith("data:"))
        node.setAttribute(name, new URL(value, location.href).href);
    }
  });
  return "<!doctype html>" + root.outerHTML;
})()`;

export default defineCommand({
  meta: {
    description:
      "Save the rendered prototype as docs/design/<app>/<slug>/index.html (needs proto dev)",
  },
  args: {
    slug: { type: "positional", required: true },
    state: { type: "string" },
    theme: { type: "enum", options: ["light", "dark"], default: "light" },
    port: { type: "string", default: "4400", description: "Port of the running proto dev" },
  },
  async run({ args }) {
    assertSlug(args.slug);
    const origin = `http://127.0.0.1:${Number(args.port)}`;
    const url = new URL(`/${args.slug}`, origin);
    url.searchParams.set("chrome", "0");
    url.searchParams.set("theme", args.theme);
    if (args.state) url.searchParams.set("state", args.state);
    try {
      await fetch(url, { signal: AbortSignal.timeout(3000) });
    } catch {
      throw new Error(`proto dev is not running on ${origin}`);
    }
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
      await page.goto(url.href, { waitUntil: "networkidle" });
      const html = await page.evaluate<string>(snapshot);
      const folder = resolve(repoRoot, "docs/design", currentApp().name, args.slug);
      mkdirSync(folder, { recursive: true });
      const file = resolve(folder, "index.html");
      writeFileSync(file, html);
      execFileSync("bunx", ["oxfmt", file], { cwd: repoRoot, stdio: "ignore" });
      console.log(relative(repoRoot, file));
    } finally {
      await browser.close();
    }
  },
});
