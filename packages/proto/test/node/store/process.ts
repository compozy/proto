/** Real OS-process writer for concurrency and interruption tests. */
import { join } from "node:path";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
const keepAlive = setInterval(() => {}, 1000);
const [mode, root, id] = process.argv.slice(2) as [string, string, string];
if (mode === "crash") {
  fs.promises.rename = async () => {
    process.stdout.write("temp-ready\n");
    await new Promise(() => {});
  };
  syncBuiltinESMExports();
}
const { FileStore, atomicWrite } = await import("../../../src/store/file-store.ts");
const store = new FileStore({ root });
const input = {
  body: "New comment",
  context: {
    state: "default",
    theme: "light" as const,
    role: null,
    viewport: { width: 1440, height: 900 },
  },
  target: { kind: "node" as const, node: null, label: "Whole flow" },
};
if (mode === "reply" || mode === "crash") {
  const deadline = Date.now() + 60000;
  for (;;) {
    try {
      await store.reply(id, { body: `Reply from ${process.pid}` }, { kind: "agent" });
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== "key_busy" || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    }
  }
} else if (mode === "add") await store.add("login-form", input, { kind: "agent" });
else if (mode === "pause") {
  await store.ready();
  const release = await store.locks.acquire("login-form");
  const file = await store.readFile("login-form");
  file.sequence = 1;
  const resumed = new Promise<void>(resolve => process.once("SIGCONT", () => resolve()));
  process.stdout.write("locked\n");
  // Register the resume handler before announcing readiness to the parent.
  await resumed;
  await atomicWrite(join(store.directory, "login-form.json"), file);
  await release();
}

clearInterval(keepAlive);
