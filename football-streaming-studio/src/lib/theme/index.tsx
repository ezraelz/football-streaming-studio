"use client";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { themePref, type ThemeMode } from "@/lib/prefs";

export type ResolvedTheme = "light" | "dark";

const MQ = "(prefers-color-scheme: dark)";
const subscribeSystem = (cb: () => void) => {
  const mq = window.matchMedia(MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const systemDark = () => window.matchMedia(MQ).matches;

interface ThemeValue { mode: ThemeMode; resolved: ResolvedTheme; setMode: (m: ThemeMode) => void }
const Ctx = createContext<ThemeValue | null>(null);

/** The OBS overlay is a broadcast surface: it never follows the operator's light/dark setting. */
const isOverlayPath = () => typeof window !== "undefined" && window.location.pathname.startsWith("/overlay");

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = themePref.useValue();
  const prefersDark = useSyncExternalStore(subscribeSystem, systemDark, () => true);
  const resolved: ResolvedTheme = mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  useEffect(() => {
    const root = document.documentElement;
    const applied = isOverlayPath() ? "dark" : resolved;
    root.dataset.theme = applied;
    root.style.colorScheme = applied;
  }, [resolved]);

  const value = useMemo(() => ({ mode, resolved, setMode: themePref.set }), [mode, resolved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(Ctx) ?? { mode: "dark", resolved: "dark", setMode: () => {} };
}

/**
 * Runs before first paint (inline in <head>) so there is no dark→light flash.
 * Keep in sync with ThemeProvider above.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;if(location.pathname.indexOf('/overlay')===0){d.dataset.theme='dark';d.style.colorScheme='dark';return}var m=localStorage.getItem('studio.theme')||'system';var dark=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.dataset.theme=dark?'dark':'light';d.style.colorScheme=dark?'dark':'light';var l=localStorage.getItem('studio.lang');if(!l&&/^am/i.test(navigator.language))l='am';if(l==='am'||l==='en')d.lang=l}catch(e){}})();`;
