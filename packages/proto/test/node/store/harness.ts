import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore, type FileStoreOptions } from "../../../src/store/file-store.ts";
export async function makeFileStore(options: Partial<FileStoreOptions> = {}) {
  const root = await mkdtemp(join(tmpdir(), "proto-store-"));
  let retired = false;
  const store = new FileStore({
    root,
    registry: async () => ({
      prototypes: retired ? [] : [{ slug: "login-form", spec: "auth" }],
      flows: [{ id: "sign-in", spec: "auth" }],
    }),
    ...options,
  });
  return {
    root,
    store,
    retireKey: async () => {
      retired = true;
    },
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}
