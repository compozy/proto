import { expect, it } from "vitest";
import { parseShareArgs } from "../../../src/share/cli.ts";
import { hostnames } from "../../../src/share/connection.ts";

// Invariant owner: share CLI parser. Canonical suite: node/share; UT-003 uses the CLI boundary.
it("UT-015: invitees deduplicate case-insensitively and approver wins", () => {
  const parsed = parseShareArgs(["--slug", "status", "--approver", "Ana@example.com", "--approver", "ana@example.com", "--commenter", "ANA@example.com", "--commenter=bob@example.com"]);
  expect(parsed.options).toEqual({ target: { kind: "prototype", slug: "status" }, approvers: ["ana@example.com"], commenters: ["bob@example.com"] });
  expect(parseShareArgs(["status"]).command).toBe("status");
  expect(parseShareArgs(["--app", "app", "status"])).toMatchObject({ command: "status", app: "app" });
});
it("UT-015: --name is the whole label for sibling hosts", () => {
  const args = parseShareArgs(["connect", "--name", "team-review", "--domain=example.com"]);
  expect(hostnames(args.name!, args.domain!)).toEqual({ shellHost: "team-review.example.com", renderHost: "team-review-render.example.com" });
});
it.each([
  ["status", "extra"], ["stop", "--all"], ["connect", "--approver", "ana@example.com"],
  ["disconnect", "--name", "x"], ["refresh", "--domain", "example.com"],
])("control parser rejects irrelevant arguments: %j", (...args) => {
  expect(() => parseShareArgs(args)).toThrow();
});
