import { createHmac, timingSafeEqual } from "node:crypto";
export type Grant = {
  kind: "ticket" | "grant";
  subject: string;
  audience: string;
  expires: number;
};
export function signGrant(value: Grant, secret: string) {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function readGrant(
  token: string | null,
  kind: Grant["kind"],
  audience: string,
  secret: string,
  now = Date.now()
): Grant | null {
  if (!token || token.length > 4096) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString()) as Grant;
    return value.kind === kind &&
      value.audience === audience &&
      typeof value.subject === "string" &&
      Number.isFinite(value.expires) &&
      value.expires > now
      ? value
      : null;
  } catch {
    return null;
  }
}
