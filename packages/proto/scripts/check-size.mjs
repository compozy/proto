import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
export const budget = 400 * 1024;
export async function checkSize(directory) {
  const files = await readdir(directory, { recursive: true, withFileTypes: true });
  let bytes = 0;
  for (const file of files) {
    if (file.isFile() && /\.(js|css|html)$/.test(file.name)) {
      bytes += gzipSync(await readFile(resolve(file.parentPath, file.name))).length;
    }
  }
  if (!bytes) throw new Error("Shell bundle contains no JS, CSS or HTML");
  if (bytes > budget) throw new Error(`Shell gzip size ${bytes} exceeds ${budget} bytes`);
  console.log(`Shell gzip size: ${bytes}/${budget} bytes`);
  return bytes;
}
