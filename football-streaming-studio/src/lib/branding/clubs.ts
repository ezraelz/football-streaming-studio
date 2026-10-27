/**
 * Club kit styles. Used ONLY to draw an original, generated crest (a shield in the club's
 * colours and kit pattern). These are not the clubs' official crests.
 *
 * To use an official crest, drop a licensed SVG at  public/crests/<slug>.svg  where <slug>
 * is the club name lower-cased with non-letters turned into dashes
 * (e.g. "Manchester City" → public/crests/manchester-city.svg). <TeamCrest> tries, in order:
 *   1. the crest URL supplied by your data provider,
 *   2. public/crests/<slug>.svg,
 *   3. the generated shield below.
 */
export type KitPattern = "solid" | "stripes" | "hoops" | "halves" | "band" | "sash";

export interface ClubStyle { secondary: string; pattern: KitPattern; match: string[] }

export const slugify = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const CLUB_STYLES: ClubStyle[] = [
  // England
  { secondary: "#ffffff", pattern: "solid", match: ["arsenal"] },
  { secondary: "#ffffff", pattern: "solid", match: ["chelsea"] },
  { secondary: "#ffffff", pattern: "solid", match: ["manchester city", "man city"] },
  { secondary: "#fbe122", pattern: "solid", match: ["manchester united", "man united", "man utd"] },
  { secondary: "#ffffff", pattern: "solid", match: ["liverpool"] },
  { secondary: "#132257", pattern: "solid", match: ["tottenham", "spurs"] },
  { secondary: "#ffffff", pattern: "stripes", match: ["newcastle"] },
  { secondary: "#95bfe5", pattern: "solid", match: ["aston villa", "west ham"] },
  { secondary: "#ffffff", pattern: "stripes", match: ["brighton"] },
  { secondary: "#1b458f", pattern: "stripes", match: ["crystal palace"] },
  { secondary: "#ffffff", pattern: "solid", match: ["everton", "leicester"] },
  // Spain
  { secondary: "#a50044", pattern: "stripes", match: ["barcelona"] },
  { secondary: "#ffffff", pattern: "solid", match: ["real madrid"] },
  { secondary: "#ffffff", pattern: "stripes", match: ["atletico", "atlético", "athletic"] },
  { secondary: "#ffffff", pattern: "stripes", match: ["real sociedad"] },
  // Italy
  { secondary: "#ffffff", pattern: "stripes", match: ["juventus"] },
  { secondary: "#000000", pattern: "stripes", match: ["inter", "milan"] },
  { secondary: "#ffffff", pattern: "solid", match: ["napoli", "lazio"] },
  { secondary: "#f0bc42", pattern: "halves", match: ["roma"] },
  // Germany
  { secondary: "#ffffff", pattern: "solid", match: ["bayern"] },
  { secondary: "#000000", pattern: "solid", match: ["dortmund"] },
  { secondary: "#ffffff", pattern: "solid", match: ["leverkusen", "leipzig", "frankfurt"] },
  // France & others
  { secondary: "#da291c", pattern: "band", match: ["paris saint", "psg"] },
  { secondary: "#ffffff", pattern: "solid", match: ["marseille", "lyon", "monaco"] },
  { secondary: "#ffffff", pattern: "band", match: ["ajax"] },
  { secondary: "#ffffff", pattern: "stripes", match: ["porto"] },
  { secondary: "#ffffff", pattern: "solid", match: ["benfica", "sporting"] },
  { secondary: "#ffffff", pattern: "hoops", match: ["celtic"] },
];

export function clubStyle(name: string): ClubStyle | undefined {
  const n = name.toLowerCase();
  return CLUB_STYLES.find((c) => c.match.some((m) => n.includes(m)));
}

/** Perceived brightness 0–255 of a "#rrggbb" colour (other formats count as dark). */
export function luminance(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 60;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}
