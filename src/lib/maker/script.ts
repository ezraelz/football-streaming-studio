import type { EditorialCard } from "@/lib/api/client";
import { localTeamName } from "@/lib/branding/clubs";
import type { VoiceLang } from "./voice";

export type ShowKind = "pre" | "post";

/** Which graphics each kind of show uses, in the order they appear. */
export const TEMPLATES: Record<ShowKind, string[]> = {
  pre: ["match_preview", "fixture_intro", "form", "head_to_head", "lineups", "standings", "prediction"],
  post: ["match_summary", "match_stats", "xg_race", "shot_map", "player_stats", "standings"],
};

export interface Segment {
  id: string;
  /** The graphic on screen while this line is spoken (null = score bug only). */
  cardId: string | null;
  text: string;
}

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : fb);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (v: unknown) => { const n = num(v); return n == null ? null : Math.round(n <= 1 ? n * 100 : n); };
const surname = (n: string) => n.trim().split(/\s+/).slice(-1)[0] ?? n;
const join = (xs: string[], lang: VoiceLang) => {
  if (xs.length <= 1) return xs.join("");
  const and = lang === "am" ? " እና " : " and ";
  return xs.slice(0, -1).join(", ") + and + xs[xs.length - 1];
};
const ordinal = (n: number, lang: VoiceLang) => {
  if (lang === "am") return `${n}ኛ`;
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

interface Ctx { lang: VoiceLang; home: string; away: string; competition: string }

const tally = (results: Obj[]) => {
  let w = 0, d = 0, l = 0;
  for (const r of results) { const x = str(r.outcome); if (x === "W") w++; else if (x === "D") d++; else if (x === "L") l++; }
  return { w, d, l, n: w + d + l };
};

/** One spoken paragraph for a card, from its real data. Returns null when the card has nothing to say. */
function sentenceFor(card: EditorialCard, c: Ctx): string | null {
  const p = o(card.payload);
  const am = c.lang === "am";
  const T = (n: string) => localTeamName(n, c.lang);

  switch (card.card_type as string) {
    case "match_preview": {
      const text = str(p.preview).trim();
      if (!text) return null;
      return text.length > 420 ? text.slice(0, 417).replace(/\s+\S*$/, "") + "…" : text;
    }
    case "fixture_intro": {
      const when = str(p.kickoff_label), venue = str(p.venue);
      return am
        ? `እንኳን ደህና መጡ! የ${c.competition || "እግር ኳስ"} ጨዋታ ቅድመ ዳሰሳ፦ ${c.home} ከ${c.away} ጋር። ጨዋታው ${when || "በቅርቡ"} ይካሄዳል${venue ? `፣ በ${venue}` : ""}።`
        : `Welcome to the preview of ${c.home} against ${c.away}${c.competition ? ` in the ${c.competition}` : ""}. Kick-off is ${when || "coming up soon"}${venue ? ` at ${venue}` : ""}.`;
    }
    case "form": {
      const side = (k: string) => { const s = o(p[k]); const t = tally(arr(s.results)); return { name: str(s.team), ...t }; };
      const h = side("home"), a = side("away");
      if (!h.n && !a.n) return null;
      const line = (s: typeof h) => am
        ? `${T(s.name)} ባለፉት ${s.n} ጨዋታዎች ${s.w} አሸንፏል፣ ${s.d} አቻ ወጥቷል፣ ${s.l} ተሸንፏል።`
        : `${T(s.name)} have won ${s.w}, drawn ${s.d} and lost ${s.l} of their last ${s.n}.`;
      return [h.n ? line(h) : "", a.n ? line(a) : ""].filter(Boolean).join(" ");
    }
    case "head_to_head": {
      const ms = arr(p.meetings);
      if (!ms.length) return null;
      let hw = 0, aw = 0, d = 0;
      for (const m of ms) {
        const sc = str(m.score).match(/(\d+)\s*[-–:]\s*(\d+)/);
        if (!sc) continue;
        const x = +sc[1], y = +sc[2];
        if (x === y) { d++; continue; }
        const homeName = str(m.home_team ?? m.home), winner = x > y ? homeName : str(m.away_team ?? m.away);
        const isH = winner.toLowerCase().includes(c.home.toLowerCase()) || c.home.toLowerCase().includes(winner.toLowerCase());
        if (isH) hw++; else aw++;
      }
      return am
        ? `ባለፉት ${ms.length} የእርስ በርስ ግጥሚያዎች ${c.home} ${hw} ጊዜ አሸንፏል፣ ${c.away} ${aw} ጊዜ አሸንፏል፣ ${d} ጊዜ በአቻ ተጠናቅቋል።`
        : `In their last ${ms.length} meetings, ${c.home} won ${hw}, ${c.away} won ${aw}, and ${d} ended level.`;
    }
    case "lineups": {
      const h = o(p.home), a = o(p.away);
      const gk = (s: Obj) => { const g = arr(s.players).find((x) => /^g/i.test(str(x.position))); return g ? surname(str(g.name)) : ""; };
      const predicted = str(p.lineup_status) === "predicted";
      const hf = str(h.formation), af = str(a.formation);
      if (!hf && !af && !arr(h.players).length) return null;
      return am
        ? `${predicted ? "የተገመቱት አሰላለፎች፦ " : "የቡድኖቹ አሰላለፍ፦ "}${c.home} በ${hf || "—"}${gk(h) ? ` ግብ ጠባቂው ${gk(h)}` : ""}፤ ${c.away} በ${af || "—"}${gk(a) ? ` ግብ ጠባቂው ${gk(a)}` : ""}።`
        : `${predicted ? "Here are the predicted line-ups. " : "Here are the starting line-ups. "}${c.home} play ${hf || "their usual shape"}${gk(h) ? ` with ${gk(h)} in goal` : ""}, while ${c.away} line up ${af || "in their usual shape"}${gk(a) ? ` with ${gk(a)} in goal` : ""}.`;
    }
    case "standings": {
      const rows = arr(p.rows);
      const find = (n: string) => rows.find((r) => { const t = str(r.team).toLowerCase(); return t.includes(n.toLowerCase()) || n.toLowerCase().includes(t); });
      const h = find(c.home), a = find(c.away);
      if (!h && !a) return null;
      const part = (r: Obj | undefined, name: string) => r
        ? (am ? `${name} በ${str(r.points)} ነጥብ ${ordinal(Number(r.position), c.lang)} ደረጃ ላይ` : `${name} are ${ordinal(Number(r.position), c.lang)} on ${str(r.points)} points`)
        : "";
      return am
        ? `በደረጃ ሰንጠረዡ ${[part(h, c.home), part(a, c.away)].filter(Boolean).join("፤ ")} ይገኛል።`
        : `In the table, ${[part(h, c.home), part(a, c.away)].filter(Boolean).join(", while ")}.`;
    }
    case "prediction": {
      const m = o(p.model), k = o(p.market);
      const src = num(m.home) != null ? m : k;
      const h = pct(src.home), d = pct(src.draw), a = pct(src.away);
      if (h == null || d == null || a == null) return null;
      return am
        ? `የእኛ ትንበያ ለ${c.home} ${h}%፣ ለአቻ ውጤት ${d}%፣ ለ${c.away} ${a}% ዕድል ይሰጣል። ትንበያ እንጂ ዋስትና አይደለም።`
        : `Our forecast gives ${c.home} a ${h} percent chance, ${d} percent for a draw and ${a} percent for ${c.away}. These are estimates, not guarantees.`;
    }
    case "match_summary": {
      const s = o(p.score), hs = num(s.home), as = num(s.away);
      if (hs == null || as == null) return null;
      const goals = arr(p.goals).slice(0, 5).map((g) => `${surname(str(g.player))} ${str(g.minute)}'`);
      const head = am ? `ጨዋታው ተጠናቀቀ፦ ${c.home} ${hs}፣ ${c.away} ${as}።` : `Full time: ${c.home} ${hs}, ${c.away} ${as}.`;
      const tail = goals.length ? (am ? ` ግቦቹን ያስቆጠሩት ${join(goals, c.lang)}።` : ` Goals from ${join(goals, c.lang)}.`) : "";
      return head + tail;
    }
    case "match_stats": {
      const rows = arr(p.stats);
      const row = (k: string) => rows.find((r) => str(r.key) === k || str(r.label).toLowerCase().includes(k));
      const pos = row("possession"), sh = row("shots");
      const bits: string[] = [];
      if (pos) bits.push(am ? `${c.home} ${Math.round(Number(pos.home))}% ኳስ ተቆጣጥሯል` : `${c.home} had ${Math.round(Number(pos.home))} percent of the ball`);
      if (sh) bits.push(am ? `የግብ ሙከራዎች ${Math.round(Number(sh.home))} ለ ${Math.round(Number(sh.away))}` : `with ${Math.round(Number(sh.home))} shots to ${Math.round(Number(sh.away))}`);
      if (!bits.length) return null;
      return bits.join(am ? "፤ " : ", ") + (am ? "።" : ".");
    }
    case "xg_race": {
      const h = num(p.home_xg_final), a = num(p.away_xg_final);
      if (h == null || a == null) return null;
      return am
        ? `የሚጠበቁ ግቦች (xG)፦ ${c.home} ${h.toFixed(2)}፣ ${c.away} ${a.toFixed(2)}።`
        : `The expected goals tell the story: ${c.home} ${h.toFixed(2)}, ${c.away} ${a.toFixed(2)}.`;
    }
    case "shot_map": {
      const h = num(p.home_xg), a = num(p.away_xg);
      const shots = arr(p.shots).length;
      if (!shots) return null;
      return am ? `ከሁለቱም ቡድኖች በጠቅላላ ${shots} የግብ ሙከራዎች ተደርገዋል${h != null && a != null ? `፤ xG ${h.toFixed(2)} ለ ${a.toFixed(2)}` : ""}።`
                : `Here is every shot from the match — ${shots} in total${h != null && a != null ? `, with xG of ${h.toFixed(2)} to ${a.toFixed(2)}` : ""}.`;
    }
    case "player_stats": {
      const best = arr(p.players).map((x) => ({ n: str(x.name), r: Number(x.rating) })).filter((x) => x.n && Number.isFinite(x.r)).sort((x, y) => y.r - x.r)[0];
      if (!best) return null;
      return am ? `የጨዋታው ምርጥ ተጫዋች ${best.n} ሲሆን ${best.r.toFixed(1)} ነጥብ አግኝቷል።`
                : `Player of the match goes to ${best.n}, rated ${best.r.toFixed(1)}.`;
    }
    default:
      return null;
  }
}

const OUTRO: Record<ShowKind, Record<VoiceLang, string>> = {
  pre: { en: "That's the preview. Follow for more football!", am: "ቅድመ ዳሰሳው ይህ ነው። ተጨማሪ የእግር ኳስ ዜና ለማግኘት ይከታተሉን!" },
  post: { en: "That's the full-time review. Follow for more football!", am: "የጨዋታው ድህረ ዳሰሳ ይህ ነው። ተጨማሪ የእግር ኳስ ዜና ለማግኘት ይከታተሉን!" },
};

/** Build an editable script: one segment per card that has something to say, in the template's order. */
export function buildScript(kind: ShowKind, lang: VoiceLang, cards: EditorialCard[], ctx: Omit<Ctx, "lang">): Segment[] {
  const full: Ctx = { ...ctx, lang };
  const out: Segment[] = [];
  for (const type of TEMPLATES[kind]) {
    const card = cards.find((c) => (c.card_type as string) === type);
    if (!card) continue;
    const text = sentenceFor(card, full);
    if (text) out.push({ id: `seg-${card.id}`, cardId: card.id, text });
  }
  out.push({ id: "seg-outro", cardId: null, text: OUTRO[kind][lang] });
  return out;
}
