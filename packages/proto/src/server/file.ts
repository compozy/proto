import { mkdir, readFile, chmod, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FileStore, atomicWrite } from "../store/file-store.ts";
import { KeyLocks } from "../store/lock.ts";
import type { Credential, ReviewStorage } from "./storage.ts";
/** dir is the review directory, not the gallery's public build directory. */
export function fileStorage(dir: string): ReviewStorage {
  const directory = resolve(dir);
  const store = new FileStore({ root: directory, directory });
  const privateDir = join(directory, ".server");
  const locks = new KeyLocks(privateDir);
  const path = join(privateDir, "credentials.json");
  async function records() {
    try {
      return JSON.parse(await readFile(path, "utf8")) as Credential[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async function change(action: (values: Credential[]) => void) {
    await mkdir(privateDir, { recursive: true, mode: 0o700 });
    await chmod(privateDir, 0o700);
    await locks.run("credentials", async () => {
      const values = await records();
      action(values);
      await atomicWrite(path, values);
      await chmod(path, 0o600);
    });
  }
  let initialized: Promise<void> | undefined;
  return {
    store,
    configure(registry, commit) {
      store.options.registry = registry;
      store.options.commit = commit;
    },
    async checkSchema() {
      initialized ??= (async () => {
        await store.ready();
        const ignore = join(directory, ".gitignore");
        if (!(await readFile(ignore, "utf8")).split("\n").includes(".server/"))
          await appendFile(ignore, "\n.server/\n");
      })();
      await initialized;
    },
    credentials: {
      create: value =>
        change(values => {
          values.push(value);
        }),
      async find(hash) {
        return (await records()).find(c => c.hash === hash) ?? null;
      },
      async list(ownerId) {
        return (await records()).filter(c => c.ownerId === ownerId);
      },
      revoke: (ownerId, id) =>
        change(values => {
          const c = values.find(c => c.id === id && c.ownerId === ownerId);
          if (c) c.revokedAt = new Date().toISOString();
        }),
      used: id =>
        change(values => {
          const c = values.find(c => c.id === id);
          if (c) c.lastUsedAt = new Date().toISOString();
        }),
    },
  };
}
