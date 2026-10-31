/**
 * Shell copy in `en` and `pt-BR` (bootstrap `locale`). Only copy is translated: URL values,
 * slugs, codes and commands stay as they are in every locale. `{name}` placeholders; keys with
 * `.one`/`.other` variants are picked by `count`.
 */
import { createContext, use, type ReactNode } from "react";

import { en, ptBR, type MessageKey } from "./messages";

export type Locale = "en" | "pt-BR";
type Vars = Record<string, string | number>;

const catalogs: Record<Locale, Record<string, string>> = { en, "pt-BR": ptBR };

export function translate(locale: Locale, key: MessageKey | PluralKey, vars: Vars = {}) {
  const catalog = catalogs[locale];
  const variant =
    typeof vars.count === "number" ? `${key}.${vars.count === 1 ? "one" : "other"}` : key;
  const template = catalog[variant] ?? catalog[key] ?? en[key as MessageKey] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** Keys that exist only as `.one`/`.other` variants. */
type Plural<Key> = Key extends `${infer Base}.one` ? Base : never;
export type PluralKey = Plural<MessageKey>;

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale() {
  return use(LocaleContext);
}

export function useT() {
  const locale = use(LocaleContext);
  return (key: MessageKey | PluralKey, vars?: Vars) => translate(locale, key, vars);
}

export type Translate = ReturnType<typeof useT>;
