import type { ComponentType } from "react";
import { config } from "virtual:gallery-app";
import {
  flowProblems,
  flows,
  flowWarnings,
  problems,
  prototypes,
} from "virtual:gallery-prototypes";

import type { PrototypeMeta, PrototypeProps } from "../contract";
import { buildRegistry, type Entry, type Registry } from "./registry-model";

export type PrototypeModule = { meta: PrototypeMeta; default: ComponentType<PrototypeProps> };

export function kindFor(slug: string) {
  return prototypes.find(entry => entry.slug === slug)?.kind;
}

export function loaderFor(slug: string) {
  return prototypes.find(entry => entry.slug === slug)?.load;
}

export function useRegistry(): Registry {
  const entries: Entry[] = prototypes.flatMap(entry =>
    entry.meta ? [{ slug: entry.slug, kind: entry.kind, file: entry.file, meta: entry.meta }] : []
  );
  return buildRegistry({
    specs: config.specs,
    entries,
    broken: problems.map(problem => problem.message),
    flows,
    flowProblems,
    warnings: flowWarnings,
  });
}
