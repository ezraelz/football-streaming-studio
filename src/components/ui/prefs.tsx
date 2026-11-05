"use client";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utility/utils";
import { focusRing } from "@/components/ui/button";
import { LANGS, useI18n, useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import type { ThemeMode } from "@/lib/prefs";

/** Two-way language switch (English / አማርኛ). `compact` shows short labels. */
export function LanguageSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { lang, setLang } = useI18n();
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t("prefs.language")}
      className={cn("inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-0.5", className)}
    >
      <Languages className="mx-1.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
      {LANGS.map((l) => {
        const active = l.id === lang;
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l.id}
            onClick={() => setLang(l.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              focusRing,
              active ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            {compact ? l.short : l.native}
          </button>
        );
      })}
    </div>
  );
}

const THEME_OPTS: { id: ThemeMode; icon: typeof Sun; key: "prefs.theme.system" | "prefs.theme.light" | "prefs.theme.dark" }[] = [
  { id: "system", icon: Monitor, key: "prefs.theme.system" },
  { id: "light", icon: Sun, key: "prefs.theme.light" },
  { id: "dark", icon: Moon, key: "prefs.theme.dark" },
];

/** Three-way System / Light / Dark switch. */
export function ThemeSwitch({ showLabels = false, className }: { showLabels?: boolean; className?: string }) {
  const { mode, setMode } = useTheme();
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t("prefs.theme")}
      className={cn("inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-0.5", className)}
    >
      {THEME_OPTS.map(({ id, icon: Icon, key }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(key)}
            title={t(key)}
            onClick={() => setMode(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              focusRing,
              active ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {showLabels && t(key)}
          </button>
        );
      })}
    </div>
  );
}

/** One-tap light/dark toggle for tight spaces (login page, mobile header). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setMode } = useTheme();
  const t = useT();
  const toLight = resolved === "dark";
  return (
    <button
      type="button"
      onClick={() => setMode(toLight ? "light" : "dark")}
      aria-label={toLight ? t("prefs.switchToLight") : t("prefs.switchToDark")}
      title={toLight ? t("prefs.switchToLight") : t("prefs.switchToDark")}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:text-zinc-50",
        focusRing,
        className,
      )}
    >
      {toLight ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
