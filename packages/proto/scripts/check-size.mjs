import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
export const budget = 400 * 1024;
/** Sum gzipped shell JS, CSS and HTML bytes; reject an empty bundle or a budget overrun. */
export async function checkSize(directory) {
  const files = await readdir(directory, { recursive: true, withFileTypes: true });
  const sizes = await Promise.all(
    files
      .filter(file => file.isFile() && /\.(js|css|html)$/.test(file.name))
      .map(async file => gzipSync(await readFile(resolve(file.parentPath, file.name))).length)
  );
  const bytes = sizes.reduce((total, size) => total + size, 0);
  if (!bytes) throw new Error("Shell bundle contains no JS, CSS or HTML");
  if (bytes > budget) throw new Error(`Shell gzip size ${bytes} exceeds ${budget} bytes`);
  console.log(`Shell gzip size: ${bytes}/${budget} bytes`);
  return bytes;
}
