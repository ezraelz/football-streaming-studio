/**
 * League themes — colour palettes that make a competition instantly recognisable
 * (Premier League purple, Champions League navy, …). These are plain colour schemes;
 * they are NOT the official logos.
 *
 * To use an official league logo, drop a licensed SVG at  public/leagues/<id>.svg
 * (e.g. public/leagues/premier-league.svg). <LeagueBadge> picks it up automatically
 * and falls back to the generated badge when the file is missing.
 */
export interface LeagueTheme {
  id: string;        // file name under public/leagues/
  name: string;
  short: string;     // monogram on the generated badge
  primary: string;   // dominant brand colour (card tint, badge base)
  secondary: string; // second brand colour (gradient end)
  accent: string;    // bright highlight (labels, bars, highlights)
  ink: string;       // text colour that reads on `primary`
  match: string[];   // lower-case fragments matched against the competition name
}

export const DEFAULT_THEME: LeagueTheme = {
  id: "default", name: "Football", short: "FB",
  primary: "#064e3b", secondary: "#0c4a6e", accent: "#34d399", ink: "#ffffff", match: [],
};

export const LEAGUE_THEMES: LeagueTheme[] = [
  { id: "premier-league", name: "Premier League", short: "PL", primary: "#38003c", secondary: "#e90052", accent: "#00ff85", ink: "#ffffff", match: ["premier league", "english premier"] },
  { id: "la-liga", name: "La Liga", short: "LL", primary: "#b3121a", secondary: "#ff6a13", accent: "#ffc72c", ink: "#ffffff", match: ["la liga", "laliga", "primera division", "primera división"] },
  { id: "serie-a", name: "Serie A", short: "SA", primary: "#0a3d8f", secondary: "#0a1f44", accent: "#27c6ff", ink: "#ffffff", match: ["serie a"] },
  { id: "bundesliga", name: "Bundesliga", short: "BL", primary: "#c8102e", secondary: "#5a0a16", accent: "#ffffff", ink: "#ffffff", match: ["bundesliga"] },
  { id: "ligue-1", name: "Ligue 1", short: "L1", primary: "#0b1f5b", secondary: "#13307f", accent: "#d6e600", ink: "#ffffff", match: ["ligue 1"] },
  { id: "champions-league", name: "Champions League", short: "UCL", primary: "#0a1a4f", secondary: "#143a9a", accent: "#7db4ff", ink: "#ffffff", match: ["champions league"] },
  { id: "europa-league", name: "Europa League", short: "UEL", primary: "#a14a00", secondary: "#1a1208", accent: "#ff9a2e", ink: "#ffffff", match: ["europa league"] },
  { id: "conference-league", name: "Conference League", short: "UECL", primary: "#0a5c36", secondary: "#08281a", accent: "#4be08a", ink: "#ffffff", match: ["conference league"] },
  { id: "eredivisie", name: "Eredivisie", short: "ED", primary: "#c2410c", secondary: "#431407", accent: "#fdba74", ink: "#ffffff", match: ["eredivisie"] },
  { id: "liga-portugal", name: "Liga Portugal", short: "LP", primary: "#0b6b3a", secondary: "#8a1c1c", accent: "#ffd54a", ink: "#ffffff", match: ["primeira liga", "liga portugal"] },
  { id: "mls", name: "MLS", short: "MLS", primary: "#0b1f3a", secondary: "#b3122f", accent: "#7fb3ff", ink: "#ffffff", match: ["major league soccer", "mls"] },
  { id: "world-cup", name: "World Cup", short: "WC", primary: "#5b0f2e", secondary: "#1c0a14", accent: "#f2c14e", ink: "#ffffff", match: ["world cup"] },
  { id: "euros", name: "European Championship", short: "EC", primary: "#0a2a6b", secondary: "#0a1030", accent: "#5cd1ff", ink: "#ffffff", match: ["european championship", "euro 20", "euros"] },
  { id: "fa-cup", name: "FA Cup", short: "FA", primary: "#8a0f1c", secondary: "#2a0a10", accent: "#f5d27a", ink: "#ffffff", match: ["fa cup"] },
  { id: "efl", name: "EFL", short: "EFL", primary: "#0a3b8f", secondary: "#c8102e", accent: "#ffffff", ink: "#ffffff", match: ["championship", "efl", "league cup", "carabao"] },
];

/** Best theme for a competition name; falls back to the neutral default. */
export function themeFor(competition?: string | null): LeagueTheme {
  const c = (competition ?? "").toLowerCase();
  if (!c) return DEFAULT_THEME;
  return LEAGUE_THEMES.find((t) => t.match.some((m) => c.includes(m))) ?? DEFAULT_THEME;
}

export const themeGradient = (t: LeagueTheme) =>
  `linear-gradient(90deg, ${t.secondary}, ${t.primary} 35%, ${t.accent})`;

/** "#rrggbb" + 0–1 alpha → "#rrggbbaa" (other colour formats pass through). */
export function alpha(color: string, a: number) {
  return /^#[0-9a-f]{6}$/i.test(color)
    ? `${color}${Math.round(a * 255).toString(16).padStart(2, "0")}`
    : color;
}
