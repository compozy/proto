import { chmod, writeFile } from "node:fs/promises";
/** Real executable I/O fixture: version lookup, ready pid, and controlled unexpected exits. */
export async function cloudflaredStub(path: string, version = "2026.1.0") {
  await writeFile(path, `#!/usr/bin/env node
if (process.argv.includes('--version')) { console.log('cloudflared version ${version}'); process.exit(0); }
const fs = require('node:fs');
if (process.env.PROTO_STUB_REPORT) fs.writeFileSync(process.env.PROTO_STUB_REPORT, JSON.stringify({ pid: process.pid, argv: process.argv.slice(2) }));
if (process.env.PROTO_STUB_EXIT) setTimeout(() => process.exit(1), Number(process.env.PROTO_STUB_EXIT));
setInterval(() => {}, 1000);
process.on('SIGTERM', () => process.exit(0));
`, { mode: 0o700 });
  await chmod(path, 0o700);
  return path;
}
