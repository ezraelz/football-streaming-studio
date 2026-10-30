import type { Lang } from "@/lib/prefs";
import type { TFn } from "./index";

export interface FormatPrefs { lang: Lang; ethCalendar: boolean; ethClock: boolean }

const locale = (lang: Lang) => (lang === "am" ? "am-ET" : "en-GB");

/** Ethiopian clock: the day starts at sunrise, so 7:00 local = 1:00. */
export function ethiopianHour(h: number): number {
  return (((h - 6) % 12) + 12) % 12 || 12;
}

function ethiopianPeriod(h: number, t: TFn): string {
  if (h >= 6 && h < 12) return t("time.morning");
  if (h >= 12 && h < 18) return t("time.afternoon");
  if (h >= 18) return t("time.evening");
  return t("time.night");
}

export function formatTime(iso: string | Date, p: FormatPrefs, t: TFn): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (p.ethClock) {
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${ethiopianHour(d.getHours())}:${mm} ${ethiopianPeriod(d.getHours(), t)}`;
  }
  return d.toLocaleTimeString(locale(p.lang), { hour: "2-digit", minute: "2-digit" });
}

/** "Today", "Tomorrow" or a full date (Gregorian or Ethiopian calendar). */
export function formatDay(iso: string | Date, p: FormatPrefs, t: TFn, long = true): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return t("time.today");
  if (d.toDateString() === tomorrow.toDateString()) return t("time.tomorrow");
  return formatDate(d, p, long);
}

export function formatDate(d: Date, p: FormatPrefs, long = true): string {
  const base = locale(p.lang);
  const tag = p.ethCalendar ? `${base}-u-ca-ethiopic` : `${base}-u-ca-gregory`;
  const opts: Intl.DateTimeFormatOptions = long
    ? { weekday: "long", month: "long", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric" };
  try {
    return new Intl.DateTimeFormat(tag, opts).format(d);
  } catch {
    return d.toLocaleDateString(base, opts); // browser without that calendar
  }
}

export function timeAgo(iso: string, t: TFn): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return t("time.secAgo", { n: diff });
  if (diff < 3600) return t("time.minAgo", { n: Math.floor(diff / 60) });
  return t("time.hourAgo", { n: Math.floor(diff / 3600) });
}

export function formatCountdown(seconds: number, t: TFn): string {
  if (seconds <= 0) return t("time.expired");
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
