"use client";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { en, type MsgKey } from "./en";
import { am } from "./am";
import { langPref, type Lang } from "@/lib/prefs";

export type { Lang, MsgKey };

export const LANGS: { id: Lang; native: string; short: string }[] = [
  { id: "en", native: "English", short: "EN" },
  { id: "am", native: "አማርኛ", short: "አማ" },
];

const DICTS: Record<Lang, Record<MsgKey, string>> = { en, am };

export type TFn = (key: MsgKey, vars?: Record<string, string | number>) => string;

function translate(lang: Lang, key: MsgKey, vars?: Record<string, string | number>) {
  let s = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

interface I18nValue { lang: Lang; t: TFn; setLang: (l: Lang) => void }
const Ctx = createContext<I18nValue | null>(null);

/**
 * Wrap the app once (root layout). Pass `lang` to force a language for a subtree —
 * the OBS overlay does this from its `?lang=` URL parameter.
 */
export function I18nProvider({ children, lang: forced }: { children: ReactNode; lang?: Lang }) {
  const stored = langPref.useValue();
  const lang = forced ?? stored;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, t: (k, v) => translate(lang, k, v), setLang: langPref.set }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (v) return v;
  // Outside a provider (e.g. an isolated test): English.
  return { lang: "en", t: (k, vars) => translate("en", k, vars), setLang: () => {} };
}

export const useT = () => useI18n().t;

/** Look up a key that may not exist (e.g. a stat name from the data feed); falls back to a readable label. */
export function tOr(t: TFn, key: string, fallback: string): string {
  return key in en ? t(key as MsgKey) : fallback;
}

export const prettify = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
