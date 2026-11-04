import { existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { ProtoError } from "../model/errors.ts";

export function projectRoot(cwd: string, app?: string) {
  if (app) {
    const direct = resolve(cwd, app);
    if (existsSync(direct)) return direct;
    const nested = resolve(cwd, "apps", app);
    if (existsSync(nested)) return nested;
    throw new ProtoError("invalid_config", `App ${app} does not exist`);
  }
  for (let current = resolve(cwd); ; current = dirname(current)) {
    if (existsSync(join(current, "proto.config.ts"))) return current;
    if (dirname(current) === current) break;
  }
  const apps = join(cwd, "apps");
  const matches = existsSync(apps)
    ? readdirSync(apps).filter(name => existsSync(join(apps, name, "proto.config.ts")))
    : [];
  if (matches.length === 1) return join(apps, matches[0]!);
  if (matches.length > 1) throw new ProtoError("app_required");
  return resolve(cwd);
}
