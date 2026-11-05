"use client";
import { useSyncExternalStore } from "react";

/**
 * One shared 1-second timer for the whole app. Components that need "now" subscribe to it instead of each
 * starting their own interval (the suggestions list used to run one timer per card). A component only
 * re-renders when ITS interval boundary passes, e.g. useNow(5000) re-renders every 5 s, not every second.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) { clearInterval(timer); timer = null; }
  };
}

export function useNow(intervalMs = 1000) {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}
