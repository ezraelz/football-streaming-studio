/**
 * Club kit styles. Used ONLY to draw an original, generated crest (a shape in the club's
 * colours and kit pattern, with a generic emblem and the club's initials). These are NOT
 * the clubs' official crests — those are trademarked artwork.
 *
 * To use an official crest, drop a licensed SVG at  public/crests/<slug>.svg  where <slug>
 * is the club name lower-cased with non-letters turned into dashes
 * (e.g. "Manchester City" → public/crests/manchester-city.svg). <TeamCrest> tries, in order:
 *   1. the crest URL supplied by your data provider,
 *   2. public/crests/<slug>.svg,
 *   3. the generated crest below.
 *
 * `am` is the club's usual Amharic name, shown on the overlay when it runs in Amharic.
 */
export type KitPattern = "solid" | "stripes" | "hoops" | "halves" | "band" | "sash" | "tricolor";
export type CrestShape = "shield" | "arch" | "round" | "hex" | "escudo" | "kite" | "ring";
export type Emblem =
  | "star" | "ball" | "crown" | "bolt" | "chevron" | "none"
  | "lion" | "eagle" | "castle" | "bean" | "wave" | "sun" | "trident" | "cross";
export type Country = "eng" | "esp" | "ita" | "ger" | "fra" | "por" | "ned" | "sco" | "eth" | "afr";

export interface ClubStyle {
  /** Typical home colour; used only when the data feed supplies no team colour. */
  primary?: string;
  country?: Country;
  secondary: string;
  pattern: KitPattern;
  match: string[];
  am?: string;
  shape?: CrestShape;
  emblem?: Emblem;
}

export const slugify = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const W = "#ffffff";

export const CLUB_STYLES: ClubStyle[] = [
  /* ── Ethiopia (Ethiopian Premier League & national team) ── */
  { country: "eth", secondary: W, pattern: "solid", am: "ቅዱስ ጊዮርጊስ", match: ["saint george", "st george", "st. george", "giorgis"], emblem: "cross" },
  { country: "eth", secondary: W, pattern: "solid", am: "ኢትዮጵያ ቡና", match: ["ethiopian coffee", "ethiopia coffee", "ethiopia bunna", "ethiopian bunna"], emblem: "bean" },
  { country: "eth", secondary: W, pattern: "solid", am: "ፋሲል ከነማ", match: ["fasil"], emblem: "castle" },
  { country: "eth", secondary: W, pattern: "solid", am: "ባህር ዳር ከነማ", match: ["bahir dar"], emblem: "wave" },
  { country: "eth", secondary: W, pattern: "solid", am: "ሲዳማ ቡና", match: ["sidama"], emblem: "bean" },
  { country: "eth", secondary: W, pattern: "solid", am: "ሀዲያ ሆሳዕና", match: ["hadiya", "hossana", "hosaena"], emblem: "sun" },
  { country: "eth", secondary: W, pattern: "solid", am: "ወላይታ ድቻ", match: ["wolaita", "wolayita", "wolaitta"], emblem: "sun" },
  { country: "eth", secondary: W, pattern: "solid", am: "መቐለ 70 እንደርታ", match: ["mekelle", "mekele", "enderta"], emblem: "lion" },
  { country: "eth", secondary: W, pattern: "solid", am: "አዳማ ከተማ", match: ["adama"], emblem: "star" },
  { country: "eth", secondary: W, pattern: "solid", am: "ድሬዳዋ ከተማ", match: ["dire dawa"], emblem: "star" },
  { country: "eth", secondary: W, pattern: "solid", am: "ሀዋሳ ከተማ", match: ["hawassa", "awassa"], emblem: "wave" },
  { country: "eth", secondary: W, pattern: "solid", am: "ኢትዮጵያ መድን", match: ["ethiopian insurance", "ethiopia insurance", "ethiopia medin", "medin"], emblem: "chevron" },
  { country: "eth", secondary: W, pattern: "solid", am: "ንግድ ባንክ", match: ["commercial bank", "nigd bank", "ethiopia nigd"], emblem: "crown" },
  { country: "eth", secondary: W, pattern: "solid", am: "መከላከያ", match: ["defence force", "defense force", "mekelakeya"], emblem: "star" },
  { country: "eth", secondary: W, pattern: "solid", am: "አርባ ምንጭ ከተማ", match: ["arba minch"], emblem: "wave" },
  { country: "eth", secondary: W, pattern: "solid", am: "ወልድያ", match: ["woldia", "welwalo", "wolkite"] },
  // National team: flag-coloured tricolour with the lion (Lion of Judah is a national symbol).
  { country: "eth", secondary: "#fcdd09", pattern: "tricolor", am: "ኢትዮጵያ", match: ["ethiopia", "walias"], emblem: "lion", shape: "shield" },

  /* ── Africa (CAF competitions) ── */
  { country: "afr", primary: "#d00000", secondary: W, pattern: "solid", am: "አል አህሊ", match: ["al ahly", "ahly"], emblem: "eagle" },
  { country: "afr", primary: "#ffffff", secondary: "#c8102e", pattern: "band", am: "ዛማሌክ", match: ["zamalek"], emblem: "crown" },
  { country: "afr", primary: "#f9d71c", secondary: "#0a7d3a", pattern: "solid", am: "ማሜሎዲ ሰንዳውንስ", match: ["sundowns"], emblem: "sun" },
  { country: "afr", primary: "#f2b705", secondary: "#111", pattern: "solid", am: "ካይዘር ቺፍስ", match: ["kaizer chiefs"], emblem: "star" },
  { country: "afr", primary: "#111111", secondary: W, pattern: "solid", am: "ኦርላንዶ ፓይሬትስ", match: ["orlando pirates"], emblem: "cross" },
  { country: "afr", primary: "#111111", secondary: W, pattern: "solid", am: "ቲፒ ማዜምቤ", match: ["mazembe"], emblem: "star" },
  { country: "afr", primary: "#c8102e", secondary: W, pattern: "solid", am: "ዊዳድ", match: ["wydad"], emblem: "star" },
  { country: "afr", primary: "#0a7d3a", secondary: W, pattern: "solid", am: "ራጃ", match: ["raja"], emblem: "eagle" },

  /* ── England ── */
  { country: "eng", primary: "#ef0107", secondary: W, pattern: "solid", am: "አርሰናል", match: ["arsenal"], emblem: "chevron" },
  { country: "eng", primary: "#034694", secondary: W, pattern: "solid", am: "ቼልሲ", match: ["chelsea"], emblem: "lion" },
  { country: "eng", primary: "#6cabdd", secondary: W, pattern: "solid", am: "ማንቼስተር ሲቲ", match: ["manchester city", "man city"], emblem: "ball", shape: "round" },
  { country: "eng", primary: "#da291c", secondary: "#fbe122", pattern: "solid", am: "ማንቼስተር ዩናይትድ", match: ["manchester united", "man united", "man utd"], emblem: "trident" },
  { country: "eng", primary: "#c8102e", secondary: W, pattern: "solid", am: "ሊቨርፑል", match: ["liverpool"], emblem: "eagle" },
  { country: "eng", primary: "#ffffff", secondary: "#132257", pattern: "solid", am: "ቶተንሃም", match: ["tottenham", "spurs"], emblem: "ball" },
  { country: "eng", primary: "#111111", secondary: W, pattern: "stripes", am: "ኒውካስል", match: ["newcastle"], emblem: "castle" },
  { country: "eng", primary: "#670e36", secondary: "#95bfe5", pattern: "solid", am: "አስቶን ቪላ", match: ["aston villa"], emblem: "lion" },
  { country: "eng", primary: "#7a263a", secondary: "#95bfe5", pattern: "solid", am: "ዌስትሃም", match: ["west ham"], emblem: "castle" },
  { country: "eng", primary: "#0057b8", secondary: W, pattern: "stripes", am: "ብራይተን", match: ["brighton"], emblem: "bolt" },
  { country: "eng", primary: "#1b458f", secondary: "#c4122e", pattern: "stripes", am: "ክሪስታል ፓላስ", match: ["crystal palace"], emblem: "eagle" },
  { country: "eng", primary: "#003399", secondary: W, pattern: "solid", am: "ኤቨርተን", match: ["everton"], emblem: "castle" },
  { country: "eng", primary: "#003090", secondary: W, pattern: "solid", am: "ሌስተር ሲቲ", match: ["leicester"], emblem: "bolt" },
  /* ── Spain ── */
  { country: "esp", primary: "#004d98", secondary: "#a50044", pattern: "stripes", am: "ባርሴሎና", match: ["barcelona"], emblem: "ball" },
  { country: "esp", primary: "#ffffff", secondary: "#febe10", pattern: "solid", am: "ሪያል ማድሪድ", match: ["real madrid"], emblem: "crown", shape: "round" },
  { country: "esp", primary: "#cb3524", secondary: W, pattern: "stripes", am: "አትሌቲኮ ማድሪድ", match: ["atletico", "atlético"], emblem: "star" },
  { country: "esp", primary: "#ee2523", secondary: W, pattern: "stripes", match: ["athletic"], emblem: "lion" },
  { country: "esp", primary: "#0067b1", secondary: W, pattern: "stripes", match: ["real sociedad"], emblem: "crown" },
  { country: "esp", primary: "#ffffff", secondary: "#d4021d", pattern: "solid", match: ["sevilla"], emblem: "ball" },
  { country: "esp", primary: "#ffffff", secondary: "#000", pattern: "solid", match: ["valencia"], emblem: "wave" },
  /* ── Italy ── */
  { country: "ita", primary: "#111111", secondary: W, pattern: "stripes", am: "ጁቬንቱስ", match: ["juventus"], emblem: "star" },
  { country: "ita", primary: "#0068a8", secondary: "#000000", pattern: "stripes", am: "ኢንተር ሚላን", match: ["inter"], emblem: "star" },
  { country: "ita", primary: "#fb090b", secondary: "#000000", pattern: "stripes", am: "ኤሲ ሚላን", match: ["milan"], emblem: "cross" },
  { country: "ita", primary: "#12a0d7", secondary: W, pattern: "solid", am: "ናፖሊ", match: ["napoli"], emblem: "sun" },
  { country: "ita", primary: "#87d8f7", secondary: W, pattern: "solid", match: ["lazio"], emblem: "eagle" },
  { country: "ita", primary: "#8e1f2f", secondary: "#f0bc42", pattern: "halves", am: "ሮማ", match: ["roma"], emblem: "lion" },
  /* ── Germany ── */
  { country: "ger", primary: "#dc052d", secondary: W, pattern: "solid", am: "ባየርን ሙኒክ", match: ["bayern"], emblem: "star" },
  { country: "ger", primary: "#fde100", secondary: "#000000", pattern: "solid", am: "ቦሩሲያ ዶርትሙንድ", match: ["dortmund"], emblem: "ball" },
  { country: "ger", primary: "#e32221", secondary: "#000", pattern: "solid", match: ["leverkusen"], emblem: "lion" },
  { country: "ger", primary: "#dd0741", secondary: W, pattern: "solid", match: ["leipzig"], emblem: "bolt" },
  { country: "ger", primary: "#e1000f", secondary: "#000", pattern: "solid", match: ["frankfurt"], emblem: "eagle" },
  /* ── France & others ── */
  { country: "fra", primary: "#004170", secondary: "#da291c", pattern: "band", am: "ፒኤስጂ", match: ["paris saint", "psg"], emblem: "star" },
  { country: "fra", primary: "#2faee0", secondary: W, pattern: "solid", match: ["marseille"], emblem: "star" },
  { country: "fra", primary: "#ffffff", secondary: "#1c3f94", pattern: "solid", match: ["lyon"], emblem: "lion" },
  { country: "fra", primary: "#e30613", secondary: W, pattern: "halves", match: ["monaco"], emblem: "crown" },
  { country: "ned", primary: "#ffffff", secondary: "#d2122e", pattern: "band", am: "አያክስ", match: ["ajax"], emblem: "star" },
  { country: "por", primary: "#0b3b8c", secondary: W, pattern: "stripes", match: ["porto"], emblem: "ball" },
  { country: "por", primary: "#e30613", secondary: W, pattern: "solid", match: ["benfica"], emblem: "eagle" },
  { country: "por", primary: "#00814a", secondary: W, pattern: "hoops", match: ["sporting"], emblem: "lion" },
  { country: "sco", primary: "#ffffff", secondary: "#00a651", pattern: "hoops", match: ["celtic"], emblem: "cross" },
];

export function clubStyle(name: string): ClubStyle | undefined {
  const n = name.toLowerCase();
  return CLUB_STYLES.find((c) => c.match.some((m) => n.includes(m)));
}

/** The club's Amharic name when the overlay runs in Amharic and we know it; otherwise the name as given. */
export function localTeamName(name: string, lang: "en" | "am"): string {
  if (lang !== "am") return name;
  return clubStyle(name)?.am ?? name;
}

/** Perceived brightness 0–255 of a "#rrggbb" colour (other formats count as dark). */
export function luminance(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 60;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

/** Crest silhouette conventions by football culture (generic shapes, not any club's actual badge). */
const COUNTRY_SHAPE: Record<Country, CrestShape> = {
  eng: "shield", esp: "escudo", ita: "kite", ger: "ring", fra: "arch", por: "shield",
  ned: "round", sco: "shield", eth: "round", afr: "hex",
};

/** A club's usual home colour when the feed has none (or only the neutral placeholder). */
export function clubPrimary(name: string, given?: string | null): string {
  const bad = !given || /^#?(3f3f46|71717a|52525b)$/i.test(given);
  return bad ? clubStyle(name)?.primary ?? given ?? "#3f3f46" : given!;
}

/** Small stable hash so a club always gets the same generated look. */
function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SHAPES: CrestShape[] = ["shield", "arch", "hex", "round", "escudo", "kite", "ring"];
// Emblems picked for clubs without a specific one (culture-specific ones such as castle/bean/wave are explicit only).
const EMBLEMS: Emblem[] = ["star", "ball", "crown", "bolt", "chevron", "lion", "eagle", "sun", "cross", "none"];

/** Shape + emblem for a club: explicit override, else derived from its name (stable). */
export function crestDesign(name: string): { shape: CrestShape; emblem: Emblem } {
  const style = clubStyle(name);
  const h = hash(name.toLowerCase());
  return {
    shape: style?.shape ?? (style?.country ? COUNTRY_SHAPE[style.country] : SHAPES[h % SHAPES.length]),
    emblem: style?.emblem ?? EMBLEMS[(h >> 3) % EMBLEMS.length],
  };
}
