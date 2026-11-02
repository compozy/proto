/** Real development-gallery workload; run after build:shell. No application data is used. */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { loadProject } from "../src/node/project.ts";
import { startDev } from "../src/node/dev.ts";
import { onFreePorts } from "../test/node/ports.ts";

const count = Number(process.argv[2] ?? 120);
if (!Number.isInteger(count) || count < 12 || count > 1000)
  throw new Error("Use 12–1000 prototypes");
const workload = process.argv[3] ?? "flat";
if (!["flat", "reviews"].includes(workload)) throw new Error("Use flat or reviews workload");
const parent = resolve(import.meta.dirname, "../.tmp");
await mkdir(parent, { recursive: true });
const root = await mkdtemp(join(parent, "gallery-benchmark-"));
const specimens = Array.from({ length: count }, (_, index) => `screen-${index}`);
await mkdir(join(root, "src"));
await mkdir(join(root, "flows"));
const specs = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => [`spec-${index}`, `Spec ${index}`])
);
await writeFile(
  join(root, "proto.config.ts"),
  `export default {title:"Gallery benchmark",specs:${JSON.stringify(specs)},dev:{poll:true}};`
);
await writeFile(
  join(root, "vite.config.ts"),
  `import react from "@vitejs/plugin-react"; export default {plugins:[react()]};`
);
await writeFile(join(root, "proto.canvas.tsx"), `export const Canvas=({children})=>children;`);
await writeFile(
  join(root, "src/view.tsx"),
  `export function View(){return <button data-testid="specimen">Preview</button>;}`
);
for (const [index, slug] of specimens.entries())
  await writeFile(
    join(root, `src/${slug}.proto.tsx`),
    `import {definePrototype} from "@compozy/proto"; import {View} from "./view"; export const meta=definePrototype({title:"${slug}",${workload === "reviews" ? `spec:"spec-${index % 10}",` : ""}states:[{id:"default",label:"Default"}]}); export default View;`
  );
await writeFile(
  join(root, "flows/journey.flow.ts"),
  `import {defineFlow} from "@compozy/proto/flow"; export const flow=defineFlow({title:"Journey",start:["step-0"],nodes:${JSON.stringify(Object.fromEntries(specimens.map((slug, index) => [`step-${index}`, { proto: slug, state: "default", ...(index === count - 1 ? { end: true } : {}) }])))},edges:${JSON.stringify(specimens.slice(1).map((_, index) => [`step-${index}`, `step-${index + 1}`, { on: "Next" }]))}});`
);
const project = await loadProject(root);
let server: Awaited<ReturnType<typeof startDev>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  server = await onFreePorts(port => startDev(project, { port, quiet: true }));
  const readTimes: number[] = [];
  for (let index = 0; index < 10; index++) {
    const start = performance.now();
    await project.registry();
    readTimes.push(performance.now() - start);
  }
  if (workload === "reviews") {
    const store = project.store();
    for (const slug of specimens)
      await store.add(
        slug,
        {
          body: `Review ${slug}`,
          context: {
            state: "default",
            theme: "light",
            role: null,
            viewport: { width: 1440, height: 1000 },
          },
          target: {
            kind: "element",
            selector: "button",
            testId: "specimen",
            tag: "button",
            text: "Preview",
            source: "src/view.tsx:1:1",
            sourceChain: [],
            rect: { x: 0, y: 0, width: 80, height: 24 },
            rectNormalized: { x: 0, y: 0, width: 0.1, height: 0.024 },
            offset: null,
          },
        },
        { kind: "reviewer" }
      );
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const requests: Record<string, number> = {};
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.includes("/__proto/api/")) {
      const path = url.pathname.replace(/\/reviews\/[^/]+$/, "/reviews/:key");
      requests[path] = (requests[path] ?? 0) + 1;
    }
  });
  await page.addInitScript(() => {
    const metrics = { ready: 0, longTasks: [] as number[] };
    Object.assign(window, { bench: metrics });
    window.addEventListener("message", event => {
      if (event.data?.proto === 1 && event.data.type === "ready") metrics.ready++;
    });
    new PerformanceObserver(list => {
      metrics.longTasks.push(...list.getEntries().map(entry => entry.duration));
    }).observe({ type: "longtask", buffered: true });
  });
  const started = performance.now();
  await page.goto(server.origin);
  await page.waitForFunction(
    () => (window as unknown as { bench: { ready: number } }).bench.ready >= 3
  );
  const firstPreviewsMs = performance.now() - started;
  await page.getByRole("link", { name: "Screens", exact: true }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  const scroll = page.locator("main .overflow-y-auto").first();
  await scroll.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(1000);
  await scroll.evaluate(element => {
    element.scrollTop = 0;
  });
  await page.waitForTimeout(1000);
  await page
    .getByRole("button", { name: /Search/ })
    .first()
    .click();
  const search = page.getByRole("combobox", { name: "Search" });
  await search.fill(`screen-${count - 1}`);
  await page.getByRole("option").first().waitFor();
  await page.keyboard.press("Escape");
  const metrics = await page.evaluate(() => ({
    ...(window as unknown as { bench: { ready: number; longTasks: number[] } }).bench,
    frames: document.querySelectorAll("iframe").length,
    elements: document.querySelectorAll("*").length,
  }));
  console.log(
    JSON.stringify(
      {
        prototypes: count,
        workload,
        registryReadsMs: readTimes,
        firstPreviewsMs,
        requests,
        ...metrics,
      },
      null,
      2
    )
  );
} finally {
  await browser?.close();
  await server?.close();
  await rm(root, { recursive: true, force: true });
}
