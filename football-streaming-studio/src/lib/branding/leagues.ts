/**
 * League themes — colour palettes that make a competition instantly recognisable
 * (Premier League purple, Champions League navy, …). These are plain colour schemes
 * with an original generated badge; they are NOT the official logos.
 *
 * To use an official league logo, drop a licensed SVG at  public/leagues/<id>.svg
 * (e.g. public/leagues/premier-league.svg). <LeagueBadge> picks it up automatically
 * and falls back to the generated badge when the file is missing.
 *
 * Order matters: the first theme whose `match` fragment is found in the competition
 * name wins, so specific names (Ethiopian Premier League, CAF Champions League) come
 * before generic ones (Premier League, Champions League).
 */
export type Motif = "ball" | "star" | "cup" | "crown" | "bolt" | "laurel" | "stars";

export interface LeagueTheme {
  id: string;        // file name under public/leagues/
  name: string;
  am?: string;       // Amharic display name
  short: string;     // monogram on the generated badge
  primary: string;   // dominant brand colour (card tint, badge base)
  secondary: string; // second brand colour (gradient end)
  accent: string;    // bright highlight (labels, bars, highlights)
  ink: string;       // text colour that reads on `primary`
  motif?: Motif;     // generic symbol drawn on the generated badge
  flag?: [string, string, string]; // optional three-band stripe on the badge
  match: string[];   // lower-case fragments matched against the competition name
}

export const DEFAULT_THEME: LeagueTheme = {
  id: "default", name: "Football", am: "እግር ኳስ", short: "FB",
  primary: "#064e3b", secondary: "#0c4a6e", accent: "#34d399", ink: "#ffffff", motif: "ball", match: [],
};

const ETH_FLAG: [string, string, string] = ["#078930", "#fcdd09", "#da121a"];

export const LEAGUE_THEMES: LeagueTheme[] = [
  /* ── Ethiopia & Africa first (specific names before generic ones) ── */
  { id: "ethiopian-premier-league", name: "Ethiopian Premier League", am: "የኢትዮጵያ ፕሪሚየር ሊግ", short: "EPL", primary: "#065f2c", secondary: "#0a3d1c", accent: "#fcdd09", ink: "#ffffff", motif: "laurel", flag: ETH_FLAG, match: ["ethiopian premier", "ethiopia premier", "ethiopian higher", "ethiopian cup", "ethiopia cup"] },
  { id: "caf-champions-league", name: "CAF Champions League", am: "የካፍ ቻምፒዮንስ ሊግ", short: "CAF", primary: "#0b3b2e", secondary: "#061f19", accent: "#f5c542", ink: "#ffffff", motif: "cup", match: ["caf champions", "african champions"] },
  { id: "caf-confederation-cup", name: "CAF Confederation Cup", am: "የካፍ ኮንፌዴሬሽን ዋንጫ", short: "CCC", primary: "#7a1f2b", secondary: "#2a0a10", accent: "#ffb454", ink: "#ffffff", motif: "cup", match: ["confederation cup", "caf confederation"] },
  { id: "afcon", name: "Africa Cup of Nations", am: "የአፍሪካ ዋንጫ", short: "AFCON", primary: "#14532d", secondary: "#7f1d1d", accent: "#facc15", ink: "#ffffff", motif: "stars", match: ["africa cup of nations", "afcon", "african cup of nations"] },
  { id: "cecafa", name: "CECAFA Cup", am: "ሴካፋ ዋንጫ", short: "CEC", primary: "#0b4a6f", secondary: "#08283c", accent: "#5eead4", ink: "#ffffff", motif: "star", match: ["cecafa"] },

  /* ── Europe's top leagues ── */
  { id: "premier-league", name: "Premier League", am: "የእንግሊዝ ፕሪሚየር ሊግ", short: "PL", primary: "#38003c", secondary: "#e90052", accent: "#00ff85", ink: "#ffffff", motif: "crown", match: ["premier league", "english premier"] },
  { id: "la-liga", name: "La Liga", am: "ላ ሊጋ", short: "LL", primary: "#b3121a", secondary: "#ff6a13", accent: "#ffc72c", ink: "#ffffff", motif: "ball", match: ["la liga", "laliga", "primera division", "primera división"] },
  { id: "serie-a", name: "Serie A", am: "ሴሪያ ኤ", short: "SA", primary: "#0a3d8f", secondary: "#0a1f44", accent: "#27c6ff", ink: "#ffffff", motif: "star", match: ["serie a"] },
  { id: "bundesliga", name: "Bundesliga", am: "ቡንደስሊጋ", short: "BL", primary: "#c8102e", secondary: "#5a0a16", accent: "#ffffff", ink: "#ffffff", motif: "ball", match: ["bundesliga"] },
  { id: "ligue-1", name: "Ligue 1", am: "ሊግ 1", short: "L1", primary: "#0b1f5b", secondary: "#13307f", accent: "#d6e600", ink: "#ffffff", motif: "bolt", match: ["ligue 1"] },
  { id: "champions-league", name: "Champions League", am: "ቻምፒዮንስ ሊግ", short: "UCL", primary: "#0a1a4f", secondary: "#143a9a", accent: "#7db4ff", ink: "#ffffff", motif: "stars", match: ["champions league"] },
  { id: "europa-league", name: "Europa League", am: "ዩሮፓ ሊግ", short: "UEL", primary: "#a14a00", secondary: "#1a1208", accent: "#ff9a2e", ink: "#ffffff", motif: "star", match: ["europa league"] },
  { id: "conference-league", name: "Conference League", am: "ኮንፈረንስ ሊግ", short: "UECL", primary: "#0a5c36", secondary: "#08281a", accent: "#4be08a", ink: "#ffffff", motif: "laurel", match: ["conference league"] },
  { id: "eredivisie", name: "Eredivisie", am: "ኤሬዲቪዚ", short: "ED", primary: "#c2410c", secondary: "#431407", accent: "#fdba74", ink: "#ffffff", motif: "ball", match: ["eredivisie"] },
  { id: "liga-portugal", name: "Liga Portugal", am: "የፖርቹጋል ሊግ", short: "LP", primary: "#0b6b3a", secondary: "#8a1c1c", accent: "#ffd54a", ink: "#ffffff", motif: "ball", match: ["primeira liga", "liga portugal"] },
  { id: "mls", name: "MLS", am: "ኤምኤልኤስ", short: "MLS", primary: "#0b1f3a", secondary: "#b3122f", accent: "#7fb3ff", ink: "#ffffff", motif: "stars", match: ["major league soccer", "mls"] },
  { id: "world-cup", name: "World Cup", am: "የዓለም ዋንጫ", short: "WC", primary: "#5b0f2e", secondary: "#1c0a14", accent: "#f2c14e", ink: "#ffffff", motif: "cup", match: ["world cup"] },
  { id: "euros", name: "European Championship", am: "የአውሮፓ ዋንጫ", short: "EC", primary: "#0a2a6b", secondary: "#0a1030", accent: "#5cd1ff", ink: "#ffffff", motif: "stars", match: ["european championship", "euro 20", "euros"] },
  { id: "fa-cup", name: "FA Cup", am: "ኤፍኤ ካፕ", short: "FA", primary: "#8a0f1c", secondary: "#2a0a10", accent: "#f5d27a", ink: "#ffffff", motif: "cup", match: ["fa cup"] },
  { id: "efl", name: "EFL", am: "ኢኤፍኤል", short: "EFL", primary: "#0a3b8f", secondary: "#c8102e", accent: "#ffffff", ink: "#ffffff", motif: "bolt", match: ["championship", "efl", "league cup", "carabao"] },
];

/** Best theme for a competition name; falls back to the neutral default. */
export function themeFor(competition?: string | null): LeagueTheme {
  const c = (competition ?? "").toLowerCase();
  if (!c) return DEFAULT_THEME;
  return LEAGUE_THEMES.find((t) => t.match.some((m) => c.includes(m))) ?? DEFAULT_THEME;
}

/** Competition name for display: the Amharic name when the overlay is in Amharic and we know it. */
export function competitionLabel(competition: string | undefined | null, lang: "en" | "am"): string | undefined {
  if (!competition) return undefined;
  if (lang !== "am") return competition;
  const t = themeFor(competition);
  return t.id === DEFAULT_THEME.id ? competition : t.am ?? competition;
}

export const themeGradient = (t: LeagueTheme) =>
  `linear-gradient(90deg, ${t.secondary}, ${t.primary} 35%, ${t.accent})`;

/** "#rrggbb" + 0–1 alpha → "#rrggbbaa" (other colour formats pass through). */
export function alpha(color: string, a: number) {
  return /^#[0-9a-f]{6}$/i.test(color)
    ? `${color}${Math.round(a * 255).toString(16).padStart(2, "0")}`
    : color;
}

/** Mix a "#rrggbb" colour toward black (amt 0–1). Used to keep neon accents readable on light cards. */
export function darken(color: string, amt: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.round(v * (1 - amt)).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

/** Accent colour that stays legible on the chosen card tone. */
export function accentOn(theme: LeagueTheme, tone: "dark" | "light") {
  if (tone === "dark") return theme.accent;
  const lum = 0.299 * parseInt(theme.accent.slice(1, 3), 16) + 0.587 * parseInt(theme.accent.slice(3, 5), 16) + 0.114 * parseInt(theme.accent.slice(5, 7), 16);
  return /^#[0-9a-f]{6}$/i.test(theme.accent) && lum > 110 ? darken(theme.accent, 0.5) : theme.accent;
}
