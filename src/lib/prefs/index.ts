"use client";
import { createPref } from "./store";

export type Lang = "en" | "am";
export type ThemeMode = "system" | "light" | "dark";
export type OverlayTone = "dark" | "light";
export type { FormatId } from "@/lib/overlay/stage";
export type Accent = "pitch" | "royal" | "gold" | "crimson";
export const ACCENTS: Accent[] = ["pitch", "royal", "gold", "crimson"];

export const langPref = createPref<Lang>({
  key: "studio.lang",
  fallback: "en",
  parse: (r) => (r === "en" || r === "am" ? r : undefined),
  // First visit: follow the browser (Amharic browsers get Amharic).
  initial: () => (typeof navigator !== "undefined" && /^am\b/i.test(navigator.language) ? "am" : "en"),
});

export const themePref = createPref<ThemeMode>({
  key: "studio.theme",
  fallback: "system",
  parse: (r) => (r === "system" || r === "light" || r === "dark" ? r : undefined),
});

/** Primary colour of the studio (and of the overlay URL Settings generates). */
export const accentPref = createPref<Accent>({
  key: "studio.accent",
  fallback: "pitch",
  parse: (r) => ((ACCENTS as string[]).includes(r) ? (r as Accent) : undefined),
});

/** Show dates in the Ethiopian (Ge'ez) calendar. */
export const ethCalendarPref = createPref<boolean>({
  key: "studio.ethCalendar",
  fallback: false,
  parse: (r) => (r === "true" ? true : r === "false" ? false : undefined),
});

/** Show times on the traditional Ethiopian clock (hour 1 = 7:00 local). */
export const ethClockPref = createPref<boolean>({
  key: "studio.ethClock",
  fallback: false,
  parse: (r) => (r === "true" ? true : r === "false" ? false : undefined),
});

/** Defaults for the overlay URL that Settings generates for OBS. */
export const overlayToneOverlayPref = createPref<OverlayTone>({
  key: "studio.overlayTone",
  fallback: "dark",
  parse: (r) => (r === "dark" || r === "light" ? r : undefined),
});
export const overlayLitePref = createPref<boolean>({
  key: "studio.overlayLite",
  fallback: false,
  parse: (r) => (r === "true" ? true : r === "false" ? false : undefined),
});
/** Output format of the overlay: 16:9 (YouTube), 9:16 (TikTok/Shorts/Reels) or 1:1. */
export const formatPref = createPref<"landscape" | "portrait" | "square">({
  key: "studio.format",
  fallback: "landscape",
  parse: (r) => (r === "landscape" || r === "portrait" || r === "square" ? r : undefined),
});
/** "follow" = same language as the studio; otherwise force one for the broadcast. */
export const overlayLangPref = createPref<"follow" | Lang>({
  key: "studio.overlayLang",
  fallback: "follow",
  parse: (r) => (r === "follow" || r === "en" || r === "am" ? r : undefined),
});
