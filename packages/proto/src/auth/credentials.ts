import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile, rename, rm, chmod } from "node:fs/promises";
import { z } from "zod";
import { remoteUrl } from "../store/http-store.ts";
import { ProtoError } from "../model/errors.ts";
const entry = z.object({
  token: z.string().regex(/^pcr_[a-f0-9]{64}$/),
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.literal("comment")),
  remote: z.string().optional(),
});
export type SavedCredential = z.infer<typeof entry>;
export const credentialsPath = () => join(homedir(), ".config/compozy-proto/credentials.json");
export async function readCredentials(): Promise<Record<string, SavedCredential>> {
  try {
    return z.record(z.string(), entry).parse(JSON.parse(await readFile(credentialsPath(), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new ProtoError("invalid_credential", "Invalid local credentials file.");
  }
}
export async function saveCredential(url: string, value: SavedCredential | null) {
  const origin = remoteUrl(url).origin,
    values = await readCredentials();
  if (value) values[origin] = entry.parse(value);
  else delete values[origin];
  const path = credentialsPath(),
    directory = join(homedir(), ".config/compozy-proto");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(values, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
    await chmod(path, 0o600);
  } finally {
    await rm(temporary, { force: true });
  }
}
export async function remoteToken(url: string) {
  const token =
    process.env.PROTO_REMOTE_TOKEN || (await readCredentials())[remoteUrl(url).origin]?.token;
  if (!token) throw new ProtoError("auth_required", "Run proto auth login to save a credential.");
  return token;
}
