import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publicationAuth } from "./publication-auth.mjs";
if (process.env.GITHUB_REF !== "refs/heads/main")
  throw new Error("Publication is restricted to refs/heads/main");
const bootstrapToken = process.env.BOOTSTRAP_NPM_TOKEN;
delete process.env.BOOTSTRAP_NPM_TOKEN;
const stage = fileURLToPath(new URL("../dist/package/", import.meta.url));
const { name, version } = JSON.parse(
  await readFile(new URL("../dist/package/package.json", import.meta.url), "utf8")
);
if (process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN)
  throw new Error("Publication requires OIDC, not npm tokens");
if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) throw new Error("GitHub Actions OIDC is required");
if (process.env.REQUESTED_VERSION !== version)
  throw new Error("Requested version does not match committed package");
const channel = process.env.CHANNEL;
if (
  !["stable", "beta"].includes(channel) ||
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-beta\.(0|[1-9]\d*))?$/.test(version) ||
  (channel === "beta") !== version.includes("-beta.")
)
  throw new Error("Invalid version/channel");
const tag = channel === "stable" ? "latest" : "beta";
const integrity = JSON.parse(
  execFileSync("npm", ["pack", stage, "--dry-run", "--ignore-scripts", "--json"], {
    encoding: "utf8",
  })
)[0].integrity;
const endpoint = `https://registry.npmjs.org/${name}`;
const packageResponse = await fetch(endpoint);
const auth = publicationAuth(packageResponse.status, { version, channel, bootstrapToken });
const response = await fetch(`${endpoint}/${version}`);
if (response.ok) {
  const published = await response.json();
  if (published.dist?.integrity !== integrity)
    throw new Error("Existing immutable version differs from the candidate tarball");
  console.log(`${name}@${version} already published with matching integrity`);
} else {
  if (response.status !== 404) throw new Error(`Registry lookup failed: ${response.status}`);
  const authDir = auth === "bootstrap" ? await mkdtemp(join(tmpdir(), "proto-npm-auth-")) : null;
  try {
    const env = { ...process.env };
    if (authDir) {
      const config = join(authDir, ".npmrc");
      await writeFile(config, "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\n", {
        mode: 0o600,
      });
      env.NPM_CONFIG_USERCONFIG = config;
      env.NODE_AUTH_TOKEN = bootstrapToken;
    }
    execFileSync(
      "npm",
      ["publish", stage, "--ignore-scripts", "--access", "public", "--provenance", "--tag", tag],
      { stdio: "inherit", env }
    );
  } finally {
    if (authDir) await rm(authDir, { recursive: true, force: true });
  }
}
// Verify the registry before creating a tag or announcing success on GitHub.
let verified = false;
for (let attempt = 0; attempt < 12; attempt++) {
  const result = await fetch(endpoint);
  if (!result.ok) throw new Error(`Registry verification failed: ${result.status}`);
  const published = await result.json();
  const entry = published.versions?.[version];
  if (
    published["dist-tags"]?.[tag] === version &&
    entry?.dist?.integrity === integrity &&
    entry.dist.attestations?.provenance
  ) {
    verified = true;
    break;
  }
  await new Promise(resolve => setTimeout(resolve, 5000));
}
if (!verified)
  throw new Error(
    "Registry version, dist-tag, integrity or provenance did not match; GitHub release withheld"
  );
