import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore, type FileStoreOptions } from "../../../src/store/file-store.ts";
export async function makeFileStore(options: Partial<FileStoreOptions> = {}) {
  const root = await mkdtemp(join(tmpdir(), "proto-store-"));
  const store = new FileStore({
    root,
    registry: async () => ({
      prototypes: [{ slug: "login-form", spec: "auth" }],
      flows: [{ id: "sign-in", spec: "auth" }],
    }),
    ...options,
  });
  return { root, store, dispose: () => rm(root, { recursive: true, force: true }) };
}
