// Vendored from @proto/ui (packages/ui/src/lib/utils.ts @ 5e799db) for the prebuilt shell (ADR-002).
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
