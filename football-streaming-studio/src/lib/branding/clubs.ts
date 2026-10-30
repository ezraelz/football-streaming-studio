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
export type CrestShape = "shield" | "arch" | "round" | "hex";
export type Emblem = "star" | "ball" | "crown" | "bolt" | "chevron" | "none";

export interface ClubStyle {
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
  { secondary: W, pattern: "solid", am: "ቅዱስ ጊዮርጊስ", match: ["saint george", "st george", "st. george", "giorgis"] },
  { secondary: W, pattern: "solid", am: "ኢትዮጵያ ቡና", match: ["ethiopian coffee", "ethiopia coffee", "ethiopia bunna", "ethiopian bunna"] },
  { secondary: W, pattern: "solid", am: "ፋሲል ከነማ", match: ["fasil"] },
  { secondary: W, pattern: "solid", am: "ባህር ዳር ከነማ", match: ["bahir dar"] },
  { secondary: W, pattern: "solid", am: "ሲዳማ ቡና", match: ["sidama"] },
  { secondary: W, pattern: "solid", am: "ሀዲያ ሆሳዕና", match: ["hadiya", "hossana", "hosaena"] },
  { secondary: W, pattern: "solid", am: "ወላይታ ድቻ", match: ["wolaita", "wolayita", "wolaitta"] },
  { secondary: W, pattern: "solid", am: "መቐለ 70 እንደርታ", match: ["mekelle", "mekele", "enderta"] },
  { secondary: W, pattern: "solid", am: "አዳማ ከተማ", match: ["adama"] },
  { secondary: W, pattern: "solid", am: "ድሬዳዋ ከተማ", match: ["dire dawa"] },
  { secondary: W, pattern: "solid", am: "ሀዋሳ ከተማ", match: ["hawassa", "awassa"] },
  { secondary: W, pattern: "solid", am: "ኢትዮጵያ መድን", match: ["ethiopian insurance", "ethiopia insurance", "ethiopia medin", "medin"] },
  { secondary: W, pattern: "solid", am: "ንግድ ባንክ", match: ["commercial bank", "nigd bank", "ethiopia nigd"] },
  { secondary: W, pattern: "solid", am: "መከላከያ", match: ["defence force", "defense force", "mekelakeya"] },
  { secondary: W, pattern: "solid", am: "አርባ ምንጭ ከተማ", match: ["arba minch"] },
  { secondary: W, pattern: "solid", am: "ወልድያ", match: ["woldia", "welwalo", "wolkite"] },
  // National team: flag-coloured tricolour. (Matched last among the Ethiopian entries.)
  { secondary: "#fcdd09", pattern: "tricolor", am: "ኢትዮጵያ", match: ["ethiopia", "walias"], emblem: "star", shape: "shield" },

  /* ── Africa (CAF competitions) ── */
  { secondary: W, pattern: "solid", am: "አል አህሊ", match: ["al ahly", "ahly"] },
  { secondary: "#c8102e", pattern: "band", am: "ዛማሌክ", match: ["zamalek"] },
  { secondary: W, pattern: "solid", am: "ማሜሎዲ ሰንዳውንስ", match: ["sundowns"] },
  { secondary: W, pattern: "solid", am: "ካይዘር ቺፍስ", match: ["kaizer chiefs"] },
  { secondary: W, pattern: "solid", am: "ኦርላንዶ ፓይሬትስ", match: ["orlando pirates"] },
  { secondary: W, pattern: "solid", am: "ቲፒ ማዜምቤ", match: ["mazembe"] },
  { secondary: W, pattern: "solid", am: "ዊዳድ", match: ["wydad"] },
  { secondary: W, pattern: "solid", am: "ራጃ", match: ["raja"] },

  /* ── England ── */
  { secondary: W, pattern: "solid", am: "አርሰናል", match: ["arsenal"] },
  { secondary: W, pattern: "solid", am: "ቼልሲ", match: ["chelsea"] },
  { secondary: W, pattern: "solid", am: "ማንቼስተር ሲቲ", match: ["manchester city", "man city"] },
  { secondary: "#fbe122", pattern: "solid", am: "ማንቼስተር ዩናይትድ", match: ["manchester united", "man united", "man utd"] },
  { secondary: W, pattern: "solid", am: "ሊቨርፑል", match: ["liverpool"] },
  { secondary: "#132257", pattern: "solid", am: "ቶተንሃም", match: ["tottenham", "spurs"] },
  { secondary: W, pattern: "stripes", am: "ኒውካስል", match: ["newcastle"] },
  { secondary: "#95bfe5", pattern: "solid", am: "አስቶን ቪላ", match: ["aston villa"] },
  { secondary: "#95bfe5", pattern: "solid", am: "ዌስትሃም", match: ["west ham"] },
  { secondary: W, pattern: "stripes", am: "ብራይተን", match: ["brighton"] },
  { secondary: "#1b458f", pattern: "stripes", am: "ክሪስታል ፓላስ", match: ["crystal palace"] },
  { secondary: W, pattern: "solid", am: "ኤቨርተን", match: ["everton"] },
  { secondary: W, pattern: "solid", am: "ሌስተር ሲቲ", match: ["leicester"] },
  /* ── Spain ── */
  { secondary: "#a50044", pattern: "stripes", am: "ባርሴሎና", match: ["barcelona"] },
  { secondary: W, pattern: "solid", am: "ሪያል ማድሪድ", match: ["real madrid"] },
  { secondary: W, pattern: "stripes", am: "አትሌቲኮ ማድሪድ", match: ["atletico", "atlético"] },
  { secondary: W, pattern: "stripes", match: ["athletic"] },
  { secondary: W, pattern: "stripes", match: ["real sociedad"] },
  /* ── Italy ── */
  { secondary: W, pattern: "stripes", am: "ጁቬንቱስ", match: ["juventus"] },
  { secondary: "#000000", pattern: "stripes", am: "ኢንተር ሚላን", match: ["inter"] },
  { secondary: "#000000", pattern: "stripes", am: "ኤሲ ሚላን", match: ["milan"] },
  { secondary: W, pattern: "solid", am: "ናፖሊ", match: ["napoli"] },
  { secondary: W, pattern: "solid", match: ["lazio"] },
  { secondary: "#f0bc42", pattern: "halves", am: "ሮማ", match: ["roma"] },
  /* ── Germany ── */
  { secondary: W, pattern: "solid", am: "ባየርን ሙኒክ", match: ["bayern"] },
  { secondary: "#000000", pattern: "solid", am: "ቦሩሲያ ዶርትሙንድ", match: ["dortmund"] },
  { secondary: W, pattern: "solid", match: ["leverkusen", "leipzig", "frankfurt"] },
  /* ── France & others ── */
  { secondary: "#da291c", pattern: "band", am: "ፒኤስጂ", match: ["paris saint", "psg"] },
  { secondary: W, pattern: "solid", match: ["marseille", "lyon", "monaco"] },
  { secondary: W, pattern: "band", am: "አያክስ", match: ["ajax"] },
  { secondary: W, pattern: "stripes", match: ["porto"] },
  { secondary: W, pattern: "solid", match: ["benfica", "sporting"] },
  { secondary: W, pattern: "hoops", match: ["celtic"] },
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

/** Small stable hash so a club always gets the same generated look. */
function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SHAPES: CrestShape[] = ["shield", "arch", "hex", "round"];
const EMBLEMS: Emblem[] = ["star", "ball", "crown", "bolt", "chevron", "none"];

/** Shape + emblem for a club: explicit override, else derived from its name (stable). */
export function crestDesign(name: string): { shape: CrestShape; emblem: Emblem } {
  const style = clubStyle(name);
  const h = hash(name.toLowerCase());
  return {
    shape: style?.shape ?? SHAPES[h % SHAPES.length],
    emblem: style?.emblem ?? EMBLEMS[(h >> 3) % EMBLEMS.length],
  };
}
