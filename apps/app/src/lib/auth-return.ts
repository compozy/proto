/** Only the deployed review path can leave the SPA after sign-in. */
export function reviewReturn(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/proto/") || /[\\\r\n]/.test(value))
    return undefined;
  const origin = new URL(import.meta.env.VITE_API_URL).origin;
  const url = new URL(value, origin);
  return url.origin === origin && url.pathname.startsWith("/proto/") ? url.href : undefined;
}
