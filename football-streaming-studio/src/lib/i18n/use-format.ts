"use client";
import { useMemo } from "react";
import { useI18n } from "./index";
import { ethCalendarPref, ethClockPref } from "@/lib/prefs";
import * as F from "./format";

/** Date/time helpers bound to the current language and the Ethiopian calendar/clock preferences. */
export function useFormat() {
  const { lang, t } = useI18n();
  const ethCalendar = ethCalendarPref.useValue();
  const ethClock = ethClockPref.useValue();
  return useMemo(() => {
    const p: F.FormatPrefs = { lang, ethCalendar, ethClock };
    return {
      time: (iso: string | Date) => F.formatTime(iso, p, t),
      day: (iso: string | Date, long = true) => F.formatDay(iso, p, t, long),
      ago: (iso: string) => F.timeAgo(iso, t),
      countdown: (s: number) => F.formatCountdown(s, t),
      chip: (d: Date) => F.chipParts(d, p),
      month: (d: Date) => F.monthName(d, p),
    };
  }, [lang, ethCalendar, ethClock, t]);
}
