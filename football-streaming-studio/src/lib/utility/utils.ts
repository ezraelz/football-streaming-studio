import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatClock(minute: number, period: string) {
  if (period === "HT") return "HT";
  if (period === "FT") return "FT";
  return `${minute}'`;
}

/** "12s ago" — never negative, even if the server clock is slightly ahead. */
export function timeAgo(iso: string) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/** Whole seconds from `now` until `iso` (negative once passed). */
export function secondsUntil(iso: string, now: number = Date.now()) {
  return Math.round((new Date(iso).getTime() - now) / 1000);
}

/** "42s", "1m 05s", or "expired". */
export function formatCountdown(seconds: number) {
  if (seconds <= 0) return "expired";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
