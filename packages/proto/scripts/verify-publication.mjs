export function verifyAttestation(document, entry, commit) {
  const type = "https://slsa.dev/provenance/v1";
  const bundle = document.attestations?.find(item => item.predicateType === type)?.bundle;
  const statement = JSON.parse(
    Buffer.from(bundle?.dsseEnvelope?.payload ?? "", "base64").toString()
  );
  const definition = statement.predicate?.buildDefinition;
  const workflow = definition?.externalParameters?.workflow;
  const digest = statement.subject?.[0]?.digest?.sha512;
  if (
    !/^[a-f0-9]{40}$/.test(commit ?? "") ||
    statement.predicateType !== type ||
    !/^[a-f0-9]{128}$/.test(digest ?? "") ||
    `sha512-${Buffer.from(digest, "hex").toString("base64")}` !== entry.dist?.integrity ||
    workflow?.repository !== "https://github.com/compozy/proto" ||
    workflow?.path !== ".github/workflows/release.yml" ||
    workflow?.ref !== "refs/heads/main" ||
    !definition?.resolvedDependencies?.some(
      item =>
        item.uri === "git+https://github.com/compozy/proto@refs/heads/main" &&
        item.digest?.gitCommit === commit
    )
  )
    throw new Error(
      "Published provenance does not match release identity; GitHub release withheld"
    );
}

export async function waitForPublication({
  endpoint,
  version,
  tag,
  integrity,
  commit,
  timeoutMs = 600000,
  fetcher = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now,
  log = console.log,
}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 600000)
    throw new Error("Registry wait must be between 1 and 600000 milliseconds");
  const deadline = now() + timeoutMs;
  let delay = 5000;
  for (;;) {
    const response = await fetcher(endpoint, {
      signal: AbortSignal.timeout(Math.max(1, Math.min(30000, deadline - now()))),
    });
    if (!response.ok && response.status !== 404)
      throw new Error(`Registry verification failed: ${response.status}`);
    const published = response.ok ? await response.json() : {};
    const entry = published.versions?.[version];
    if (entry?.dist?.integrity && integrity && entry.dist.integrity !== integrity)
      throw new Error("Published integrity differs from the candidate tarball");
    if (entry?.dist?.attestations?.provenance) {
      const url = `https://registry.npmjs.org/-/npm/v1/attestations/${encodeURIComponent("@compozy/proto")}@${version}`;
      const attestation = await fetcher(url, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(30000, deadline - now()))),
      });
      if (!attestation.ok && attestation.status !== 404)
        throw new Error(`Attestation lookup failed: ${attestation.status}`);
      if (attestation.ok) {
        verifyAttestation(await attestation.json(), entry, commit);
        if (published["dist-tags"]?.[tag] === version) return;
      }
    }
    const remaining = deadline - now();
    if (remaining <= 0)
      throw new Error("Registry processing deadline exceeded; GitHub release withheld");
    const wait = Math.min(delay, remaining);
    log(
      `Waiting for npm processing of ${version}: retry in ${wait / 1000}s (${Math.ceil(remaining / 1000)}s remaining)`
    );
    await sleep(wait);
    delay = Math.min(delay * 2, 60000);
  }
}
