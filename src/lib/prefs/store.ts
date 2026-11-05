"use client";
import { useSyncExternalStore } from "react";

/**
 * Tiny persisted preference (localStorage) usable with React's useSyncExternalStore.
 * - Server render and first client render use `fallback` (no hydration mismatch).
 * - `initial` (optional) is what a first-time visitor gets on the client (e.g. browser language).
 * - Values are primitives so getSnapshot is always referentially stable.
 */
export function createPref<T extends string | boolean>(opts: {
  key: string;
  fallback: T;
  parse: (raw: string) => T | undefined;
  initial?: () => T;
}) {
  const { key, fallback, parse, initial } = opts;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      const v = raw == null ? undefined : parse(raw);
      if (v !== undefined) return v;
    } catch { /* storage blocked (private mode, OBS) */ }
    return initial ? initial() : fallback;
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (e.key === key) cb(); };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };

  const set = (value: T) => {
    try { window.localStorage.setItem(key, String(value)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  };

  const useValue = (): T => useSyncExternalStore(subscribe, read, () => fallback);

  return { read, set, subscribe, useValue };
}
