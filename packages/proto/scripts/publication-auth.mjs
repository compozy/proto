// A missing version of an existing package must never enable token authentication.
export function publicationAuth(status, { version, channel, bootstrapToken, token } = {}) {
  if (token) throw new Error("Direct npm tokens are refused; use OIDC");
  if (status === 200) return "oidc";
  if (status !== 404) throw new Error(`Registry lookup failed: ${status}`);
  if (version !== "0.1.0" || channel !== "stable" || !bootstrapToken)
    throw new Error("Package bootstrap requires stable 0.1.0 and the organization bootstrap token");
  return "bootstrap";
}
