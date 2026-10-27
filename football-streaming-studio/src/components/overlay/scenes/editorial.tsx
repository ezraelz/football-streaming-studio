"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { EditorialCard } from "@/lib/api/client";
import { TeamCrest } from "@/components/overlay/crest";
import { LeagueBadge } from "@/components/overlay/league-badge";
import { alpha, themeFor, themeGradient, type LeagueTheme } from "@/lib/branding/leagues";

/* ──────────────────────────────────────────────────────────────────────────
   Editorial graphics layer — "analysis desk" layout
   The frame is split into screen positions so several graphics can be on air
   at once without covering the match scene:

        ┌──────────── scoreboard ────────────┐
        │ ┌────────┐ ┌────────────┐ ┌───────┐ │
        │ │  LEFT  │ │    MAIN    │ │ RIGHT │ │
        │ │ corner │ │   screen   │ │corner │ │
        │ └────────┘ └────────────┘ └───────┘ │
        │ ┌──────────── BOTTOM strip ───────┐ │
        │ └─────────────────────────────────┘ │

   Each card has a default position by type (see DEFAULT_ZONE) which the operator
   can override with `payload.zone`. A zone only takes space while it has cards:
   with just a left corner card the main screen widens to fill the rest.

   Every measurement is in canvas pixels (a 1920×1080 canvas scaled down), so text
   sizes are chosen for a stream viewer. Don't use text-xs/text-sm here.
   ────────────────────────────────────────────────────────────────────────── */

export interface OverlayTeam { name: string; color: string; crestUrl?: string | null }
type Size = "xl" | "lg" | "md" | "sm" | "xs"; // xs = bottom-strip density

interface Metrics {
  pad: number;      // card padding / corner radius
  label: number;    // header label (e.g. LINE-UPS)
  body: number;     // main text
  small: number;    // secondary text
  big: number;      // hero numbers (score, countdown)
  crest: number;
  gap: number;
  row: number;      // table / list row height
  lineRow: number;  // line-up row height
  line: number;     // line-up font size
  rows: { standings: number; scorers: number; h2h: number; goals: number };
}

const METRICS: Record<Size, Metrics> = {
  xl: { pad: 40, label: 22, body: 32, small: 22, big: 132, crest: 150, gap: 28, row: 54, lineRow: 40, line: 27, rows: { standings: 10, scorers: 8, h2h: 6, goals: 8 } },
  lg: { pad: 32, label: 20, body: 27, small: 19, big: 104, crest: 118, gap: 22, row: 46, lineRow: 36, line: 23, rows: { standings: 10, scorers: 8, h2h: 6, goals: 7 } },
  md: { pad: 26, label: 18, body: 23, small: 17, big: 78, crest: 84, gap: 16, row: 40, lineRow: 31, line: 20, rows: { standings: 10, scorers: 7, h2h: 6, goals: 6 } },
  sm: { pad: 20, label: 16, body: 19, small: 15, big: 58, crest: 62, gap: 12, row: 29, lineRow: 21, line: 16, rows: { standings: 6, scorers: 5, h2h: 4, goals: 4 } },
  xs: { pad: 16, label: 14, body: 18, small: 14, big: 46, crest: 46, gap: 8, row: 26, lineRow: 18, line: 14, rows: { standings: 4, scorers: 4, h2h: 2, goals: 2 } },
};

/* ── payload types ─────────────────────────────────────────────────────── */

interface PTeam { name: string; color: string; crest_url?: string | null; crestUrl?: string | null }
const crestOf = (t: PTeam) => t.crestUrl ?? t.crest_url ?? null;

interface FixtureIntroPayload { competition: string; home: PTeam; away: PTeam; kickoff_label: string; venue?: string }
interface SummaryPayload {
  competition: string; home: PTeam; away: PTeam;
  score: { home: number; away: number };
  goals: Array<{ minute: number; player: string; team: string }>;
}
interface CountdownPayload { competition: string; home_name: string; away_name: string; kickoff: string }
interface LineupSide { formation: string; players: Array<{ name: string; number: number; position: string }> }
interface LineupsPayload { home: LineupSide; away: LineupSide }
interface StandingsPayload { competition: string; rows: Array<{ position: number; team: string; played: number; points: number }> }
interface FormPayload { team: string; results: Array<{ outcome: "W" | "D" | "L"; opponent: string; score: string }> }
interface H2HPayload { meetings: Array<{ date: string; home: string; away: string; score: string }> }
interface TopScorersPayload { competition: string; players: Array<{ name: string; team: string; goals: number }> }

/* ── state helper used by the overlay page ─────────────────────────────── */

const keyOf = (c: Partial<EditorialCard>) => c.id ?? c.card_type ?? "card";

/**
 * Apply one `editorial.update` websocket message to the list of on-air cards.
 *  - visible card        → added (or updated in place, keeping its position)
 *  - hidden card with id → removed
 *  - hidden, no id       → treated as "hide all"
 */
export function applyEditorialUpdate(
  prev: EditorialCard[],
  msg: Partial<EditorialCard> | null | undefined,
): EditorialCard[] {
  if (!msg) return [];
  if (!msg.id && !msg.card_type) return msg.visible ? prev : [];
  const key = keyOf(msg);
  if (msg.visible) {
    return prev.some((c) => keyOf(c) === key)
      ? prev.map((c) => (keyOf(c) === key ? ({ ...c, ...msg } as EditorialCard) : c))
      : [...prev, msg as EditorialCard];
  }
  return prev.filter((c) => keyOf(c) !== key);
}

/* ── screen positions ─────────────────────────────────────────────────── */

export type Zone = "main" | "left" | "right" | "bottom" | "ticker";
export const ZONES: Zone[] = ["main", "left", "right", "bottom", "ticker"];
export const ZONE_LABEL: Record<Zone, string> = {
  main: "Main screen", left: "Left corner", right: "Right corner", bottom: "Bottom strip", ticker: "Ticker bar",
};

const DEFAULT_ZONE: Record<string, Zone> = {
  fixture_intro: "main", lineups: "main", match_summary: "main", countdown: "main",
  standings: "left", form: "left", top_scorers: "right",
  head_to_head: "bottom", custom: "bottom",
};

const isZone = (z: unknown): z is Zone => ZONES.includes(z as Zone);

/** A scrolling message bar: a "custom" card whose payload is `{ kind: "ticker", items: [...] }`. */
export interface TickerItem { text: string; tag?: string }
export interface TickerPayload {
  kind: "ticker";
  label?: string;                       // e.g. "Next matches", "News"
  items: Array<string | TickerItem>;
  source?: "fixtures" | "manual" | "news";
  competition?: string;
}
type CardLike = Pick<EditorialCard, "card_type" | "payload">;
export const isTickerCard = (card: CardLike) =>
  card.card_type === "custom" && (card.payload as { kind?: unknown } | null)?.kind === "ticker";

/** Where a card goes: tickers always use the ticker bar; others honour `payload.zone`, else their type default. */
export function zoneOf(card: CardLike): Zone {
  if (isTickerCard(card)) return "ticker";
  const z = (card.payload as { zone?: unknown } | null)?.zone;
  return isZone(z) && z !== "ticker" ? z : (DEFAULT_ZONE[card.card_type] ?? "main");
}

// Geometry of the overlay safe area (1920×1080 minus the 5% inset on every side).
const W = 1728;
const H = 972;
const TOP = 196;       // leaves room for the scoreboard
const GAP = 24;
const SIDE_W = 440;    // corner screens
const STRIP_H = 204;   // bottom strip
const TICKER_H = 76;   // ticker bar, flush with the bottom edge
const FLOOR = 40;      // breathing room under the zones when nothing sits below them

/** How far (px) to lift the commentary lower-third so it clears the bottom strip / ticker. */
export function lowerThirdLift(cards: EditorialCard[]): number | undefined {
  const shown = cards.filter((c) => c.visible);
  const ticker = shown.some((c) => zoneOf(c) === "ticker");
  const strip = shown.some((c) => zoneOf(c) === "bottom");
  if (!ticker && !strip) return undefined;
  return (ticker ? TICKER_H + GAP : 0) + (strip ? STRIP_H + GAP : 0) + 12;
}

const ORDER: Size[] = ["xl", "lg", "md", "sm", "xs"];
// Smallest tile (px) each density needs. Line-ups are the tallest content, so other
// cards get a 20% allowance (see `factorFor`).
const H_NEED: Record<Size, number> = { xl: 620, lg: 550, md: 475, sm: 345, xs: 0 };
const W_NEED: Record<Size, number> = { xl: 800, lg: 640, md: 480, sm: 340, xs: 0 };

/** Largest density, no bigger than `start`, whose content fits the tile. */
function fit(start: Size, w: number, h: number, factor: number): Size {
  for (const size of ORDER.slice(ORDER.indexOf(start))) {
    if (w >= W_NEED[size] && h >= H_NEED[size] * factor) return size;
  }
  return "xs";
}
const factorFor = (cards: EditorialCard[]) => (cards.some((c) => c.card_type === "lineups") ? 1 : 0.8);

const competitionOf = (card: EditorialCard, fallback?: string) => {
  const c = (card.payload as { competition?: unknown } | null)?.competition;
  return typeof c === "string" && c ? c : fallback;
};

/* ── layer ─────────────────────────────────────────────────────────────── */

export function EditorialLayer({
  cards, home, away, competition, guides = false,
}: {
  cards: EditorialCard[];
  home?: OverlayTeam;
  away?: OverlayTeam;
  /** League of the match; sets the theme for cards whose payload has no `competition`. */
  competition?: string;
  guides?: boolean;
}) {
  const shown = cards.filter((c) => c.visible);
  const inZone = (z: Zone, max: number) => shown.filter((c) => zoneOf(c) === z).slice(-max); // newest win

  // Cards without their own `competition` (line-ups, form…) borrow the league of any card that has one.
  const league = competition ?? shown.map((c) => competitionOf(c)).find(Boolean);

  const main = inZone("main", 4);
  const left = inZone("left", 2);
  const right = inZone("right", 2);
  const bottom = inZone("bottom", 3);
  const ticker = inZone("ticker", 1)[0];

  if (!guides && main.length + left.length + right.length + bottom.length === 0 && !ticker) return null;

  const tickerReserve = ticker ? TICKER_H + GAP : 0;
  const stripTop = H - tickerReserve - STRIP_H;
  const mainBottom = bottom.length ? stripTop - GAP : H - (ticker ? tickerReserve : FLOOR);
  const availH = mainBottom - TOP;
  const leftW = left.length ? SIDE_W : 0;
  const rightW = right.length ? SIDE_W : 0;
  const mainX = leftW ? leftW + GAP : 0;
  const mainW = W - mainX - (rightW ? rightW + GAP : 0);

  let order = 0; // stagger entrance across zones
  const view = (card: EditorialCard, size: Size, tileW: number) => (
    <CardView
      key={keyOf(card)} card={card} size={size} index={order++} narrow={tileW < 520}
      theme={themeFor(competitionOf(card, league))} home={home} away={away}
    />
  );

  // Main screen: 1 large · 2 side by side · 3 in a row (or 2×2 when narrow) · 4 as 2×2
  const n = main.length;
  const [mc, mr] = n <= 1 ? [1, 1] : n === 2 ? (mainW >= 1000 ? [2, 1] : [1, 2]) : n === 3 ? (mainW >= 1200 ? [3, 1] : [2, 2]) : [2, 2];
  const gridW = n === 1 ? Math.min(mainW, 1240) : mainW;
  const mainTileW = (gridW - GAP * (mc - 1)) / mc;
  const mainTileH = (availH - GAP * (mr - 1)) / mr;
  const mainSize = fit("xl", mainTileW, mainTileH, factorFor(main));

  // Corner screens stack their cards vertically
  const columnSize = (items: EditorialCard[]) =>
    fit("md", Infinity, (availH - GAP * (items.length - 1)) / Math.max(1, items.length), factorFor(items));

  // Bottom strip: a single short row
  const stripTileW = (W - GAP * (bottom.length - 1)) / Math.max(1, bottom.length);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {guides && <ZoneGuides />}

      {n > 0 && (
        <div
          className="absolute grid"
          style={{
            left: mainX + (mainW - gridW) / 2, top: TOP, width: gridW, height: availH, gap: GAP,
            gridTemplateColumns: `repeat(${mc}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${mr}, minmax(0, 1fr))`,
          }}
        >
          {main.map((c) => view(c, mainSize, mainTileW))}
        </div>
      )}

      {left.length > 0 && (
        <div className="absolute grid" style={{ left: 0, top: TOP, width: SIDE_W, height: availH, gap: GAP, gridTemplateRows: `repeat(${left.length}, minmax(0, 1fr))` }}>
          {left.map((c) => view(c, columnSize(left), SIDE_W))}
        </div>
      )}

      {right.length > 0 && (
        <div className="absolute grid" style={{ left: W - SIDE_W, top: TOP, width: SIDE_W, height: availH, gap: GAP, gridTemplateRows: `repeat(${right.length}, minmax(0, 1fr))` }}>
          {right.map((c) => view(c, columnSize(right), SIDE_W))}
        </div>
      )}

      {bottom.length > 0 && (
        <div className="absolute grid" style={{ left: 0, top: stripTop, width: W, height: STRIP_H, gap: GAP, gridTemplateColumns: `repeat(${bottom.length}, minmax(0, 1fr))` }}>
          {bottom.map((c) => view(c, "xs", stripTileW))}
        </div>
      )}

      {ticker && (
        <TickerBar
          key={keyOf(ticker)}
          payload={ticker.payload as unknown as TickerPayload}
          theme={themeFor(competitionOf(ticker, league))}
          index={order++}
        />
      )}
    </div>
  );
}

/** Dashed outlines of the screen positions (design aid, used by /overlay/demo). */
function ZoneGuides() {
  const stripTop = H - TICKER_H - GAP - STRIP_H;
  const availH = stripTop - GAP - TOP;
  const box = (label: string, x: number, y: number, w: number, h: number) => (
    <div
      key={label}
      className="absolute flex items-start justify-start rounded-3xl border-2 border-dashed border-white/25 p-3 text-sm font-bold uppercase tracking-widest text-white/40"
      style={{ left: x, top: y, width: w, height: h }}
    >
      {label}
    </div>
  );
  return (
    <>
      {box("Left corner", 0, TOP, SIDE_W, availH)}
      {box("Main screen", SIDE_W + GAP, TOP, W - 2 * (SIDE_W + GAP), availH)}
      {box("Right corner", W - SIDE_W, TOP, SIDE_W, availH)}
      {box("Bottom strip", 0, stripTop, W, STRIP_H)}
      {box("Ticker bar", 0, H - TICKER_H, W, TICKER_H)}
    </>
  );
}

/** Scrolling message bar along the bottom edge — next matches today, news later. */
function TickerBar({ payload, theme, index }: { payload: TickerPayload; theme: LeagueTheme; index: number }) {
  const items: TickerItem[] = (payload.items ?? [])
    .map((i) => (typeof i === "string" ? { text: i } : i))
    .filter((i): i is TickerItem => !!i?.text);
  if (items.length === 0) return null;

  const chars = items.reduce((total, i) => total + i.text.length + (i.tag?.length ?? 0) + 6, 0);
  const rowW = Math.max(1500, chars * 17);       // approximate pixel width of one pass
  const duration = Math.round(rowW / 110);       // ≈110 px/s
  const mask = "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)";

  const row = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center" style={{ minWidth: rowW }}>
      {items.map((it, i) => (
        <span key={i} className="flex shrink-0 items-center">
          {it.tag && (
            <span
              className="mr-3 rounded-md px-2.5 py-0.5 font-extrabold uppercase"
              style={{ fontSize: 20, letterSpacing: "0.08em", background: alpha(theme.accent, 0.2), color: theme.accent }}
            >
              {it.tag}
            </span>
          )}
          <span className="font-semibold text-white" style={{ fontSize: 30 }}>{it.text}</span>
          <span className="mx-8 inline-block rotate-45" style={{ width: 10, height: 10, background: theme.accent }} />
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="ov-card-in absolute flex overflow-hidden border border-white/10 bg-[#0a101c]/92 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl"
      style={{ left: 0, top: H - TICKER_H, width: W, height: TICKER_H, borderRadius: 20, ["--ov-delay" as string]: `${index * 140}ms` } as CSSProperties}
    >
      <div
        className="relative flex shrink-0 items-center gap-4 pl-6 pr-8"
        style={{ background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` }}
      >
        {theme.id !== "default" && <LeagueBadge theme={theme} size={44} />}
        <span className="font-black uppercase text-white" style={{ fontSize: 24, letterSpacing: "0.14em" }}>
          {payload.label ?? "Next"}
        </span>
        <span className="absolute inset-y-0 right-0 w-1" style={{ background: theme.accent }} />
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden" style={{ WebkitMaskImage: mask, maskImage: mask }}>
        <div className="ov-marquee flex h-full w-max items-center whitespace-nowrap" style={{ animationDuration: `${duration}s` }}>
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}

function CardView({
  card, size, index, narrow, theme, home, away,
}: CommonProps & { card: EditorialCard }) {
  const p = card.payload;
  const common = { size, index, narrow, theme, home, away };
  switch (card.card_type) {
    case "fixture_intro": return <IntroCard payload={p as unknown as FixtureIntroPayload} {...common} />;
    case "lineups":       return <LineupsCard payload={p as unknown as LineupsPayload} {...common} />;
    case "standings":     return <StandingsCard payload={p as unknown as StandingsPayload} {...common} />;
    case "form":          return <FormCard payload={p as unknown as FormPayload} {...common} />;
    case "head_to_head":  return <H2HCard payload={p as unknown as H2HPayload} {...common} />;
    case "top_scorers":   return <ScorersCard payload={p as unknown as TopScorersPayload} {...common} />;
    case "match_summary": return <SummaryCard payload={p as unknown as SummaryPayload} {...common} />;
    case "countdown":     return <CountdownCard payload={p as unknown as CountdownPayload} {...common} />;
    default:              return <CustomCard title={card.title} payload={p} {...common} />;
  }
}

interface CommonProps { size: Size; index: number; narrow?: boolean; theme: LeagueTheme; home?: OverlayTeam; away?: OverlayTeam }

/* ── shared pieces ─────────────────────────────────────────────────────── */

function Frame({
  type, subtitle, size, index, theme, glow, children,
}: {
  type: string;
  subtitle?: string;
  size: Size;
  index: number;
  theme: LeagueTheme;
  glow?: [string, string];
  children: ReactNode;
}) {
  const m = METRICS[size];
  return (
    <section
      className="ov-card-in relative flex min-h-0 flex-col overflow-hidden border border-white/10 bg-[#0a101c]/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl"
      style={{ borderRadius: m.pad, ["--ov-delay" as string]: `${index * 140}ms` } as CSSProperties}
    >
      {/* league colour wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${alpha(theme.primary, 0.6)} 0%, transparent 58%)` }}
      />
      {glow && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(60% 90% at 0% 55%, ${alpha(glow[0], 0.26)}, transparent 70%), radial-gradient(60% 90% at 100% 55%, ${alpha(glow[1], 0.26)}, transparent 70%)`,
          }}
        />
      )}
      <div className="relative shrink-0" style={{ height: 7, background: themeGradient(theme) }} />
      <header
        className="relative flex shrink-0 items-center justify-between gap-4"
        style={{ padding: `${m.pad * 0.6}px ${m.pad}px 0` }}
      >
        <span
          className="flex items-center gap-3 font-extrabold uppercase"
          style={{ fontSize: m.label, letterSpacing: "0.2em", color: theme.accent }}
        >
          <span className="inline-block rounded-full" style={{ width: m.label * 0.5, height: m.label * 0.5, background: theme.accent }} />
          {type}
        </span>
        <span className="flex min-w-0 items-center gap-3">
          {subtitle && (
            <span className="truncate font-medium text-white/65" style={{ fontSize: m.small }}>{subtitle}</span>
          )}
          {theme.id !== "default" && <LeagueBadge theme={theme} size={Math.round(m.label * 1.8)} />}
        </span>
      </header>
      <div
        className="relative min-h-0 flex-1"
        style={{ padding: `${m.gap}px ${m.pad}px ${m.pad * 0.8}px` }}
      >
        {children}
      </div>
    </section>
  );
}

function matchesTeam(name: string, t?: OverlayTeam) {
  if (!t) return false;
  const a = name.toLowerCase();
  const b = t.name.toLowerCase();
  return a.includes(b) || b.includes(a);
}

function Dot({ color, size }: { color: string; size: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

/* ── cards ─────────────────────────────────────────────────────────────── */

function IntroCard({ theme, payload, size, index }: CommonProps & { payload: FixtureIntroPayload }) {
  const m = METRICS[size];
  return (
    <Frame
      theme={theme} type="Match preview" subtitle={payload.competition} size={size} index={index} glow={[payload.home.color, payload.away.color]}
    >
      <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
        <div className="flex w-full items-center justify-around">
          <TeamColumn team={payload.home} m={m} />
          <span
            className="rounded-full border border-white/15 bg-white/5 font-black text-white/60"
            style={{ fontSize: m.body, padding: `${m.gap * 0.3}px ${m.gap}px`, letterSpacing: "0.1em" }}
          >
            VS
          </span>
          <TeamColumn team={payload.away} m={m} />
        </div>
        <div>
          <div className="font-bold text-white" style={{ fontSize: m.body * 1.15 }}>{payload.kickoff_label}</div>
          {payload.venue && <div className="mt-1 text-white/55" style={{ fontSize: m.small }}>{payload.venue}</div>}
        </div>
      </div>
    </Frame>
  );
}

function TeamColumn({ team, m }: { team: PTeam; m: Metrics }) {
  return (
    <div className="flex min-w-0 flex-col items-center" style={{ gap: m.gap * 0.5 }}>
      <TeamCrest name={team.name} color={team.color} crestUrl={crestOf(team)} size={m.crest} />
      <div className="max-w-full truncate font-extrabold uppercase text-white" style={{ fontSize: m.body, letterSpacing: "0.04em" }}>
        {team.name}
      </div>
    </div>
  );
}

function SummaryCard({ theme, payload, size, index }: CommonProps & { payload: SummaryPayload }) {
  const m = METRICS[size];
  const isHome = (t: string) => t.toLowerCase().includes(payload.home.name.toLowerCase()) || payload.home.name.toLowerCase().includes(t.toLowerCase());
  const homeGoals = payload.goals.filter((g) => isHome(g.team)).slice(0, m.rows.goals);
  const awayGoals = payload.goals.filter((g) => !isHome(g.team)).slice(0, m.rows.goals);

  return (
    <Frame
      theme={theme} type="Full time" subtitle={payload.competition} size={size} index={index} glow={[payload.home.color, payload.away.color]}
    >
      <div className="flex h-full flex-col" style={{ gap: m.gap }}>
        <div className="flex items-center justify-around">
          <TeamColumn team={payload.home} m={m} />
          <div className="font-black tabular-nums text-white" style={{ fontSize: m.big, lineHeight: 1, textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
            {payload.score.home}<span className="mx-[0.25em] text-white/40">–</span>{payload.score.away}
          </div>
          <TeamColumn team={payload.away} m={m} />
        </div>

        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-10 overflow-hidden border-t border-white/10 pt-3" style={{ fontSize: m.small + 2 }}>
            <GoalList goals={homeGoals} align="left" accent={theme.accent} />
            <GoalList goals={awayGoals} align="right" accent={theme.accent} />
          </div>
        )}
      </div>
    </Frame>
  );
}

function GoalList({ goals, align, accent }: { goals: SummaryPayload["goals"]; align: "left" | "right"; accent: string }) {
  return (
    <ul className={`space-y-1 ${align === "right" ? "text-right" : ""}`}>
      {goals.map((g, i) => (
        <li key={i} className={`flex items-baseline gap-2 text-white/90 ${align === "right" ? "flex-row-reverse" : ""}`}>
          <span className="tabular-nums" style={{ color: accent }}>{g.minute}&apos;</span>
          <span className="truncate font-medium">{g.player}</span>
        </li>
      ))}
    </ul>
  );
}

function CountdownCard({ theme, payload, size, index }: CommonProps & { payload: CountdownPayload }) {
  const m = METRICS[size];
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = now === null ? 0 : Math.max(0, new Date(payload.kickoff).getTime() - now);
  const parts: [string, number][] = [
    ["Hours", Math.floor(diff / 3600000)],
    ["Minutes", Math.floor((diff % 3600000) / 60000)],
    ["Seconds", Math.floor((diff % 60000) / 1000)],
  ];
  const kickedOff = now !== null && diff === 0;

  return (
    <Frame theme={theme} type="Kick-off in" subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
        <div className="font-bold text-white" style={{ fontSize: m.body * 1.1 }}>
          {payload.home_name} <span className="text-white/40">vs</span> {payload.away_name}
        </div>
        {kickedOff ? (
          <div className="font-black uppercase" style={{ fontSize: m.big * 0.6, color: theme.accent }}>Kick-off!</div>
        ) : (
          <div className="flex items-start" style={{ gap: m.gap * 0.6 }}>
            {parts.map(([label, value], i) => (
              <div key={label} className="flex items-start" style={{ gap: m.gap * 0.6 }}>
                <div className="flex flex-col items-center">
                  <div
                    className="rounded-2xl border border-white/10 bg-white/[0.06] font-black tabular-nums text-white"
                    style={{ fontSize: m.big * 0.8, lineHeight: 1, padding: `${m.gap * 0.5}px ${m.gap * 0.8}px` }}
                  >
                    {String(value).padStart(2, "0")}
                  </div>
                  <div className="mt-2 font-semibold uppercase text-white/50" style={{ fontSize: m.small, letterSpacing: "0.2em" }}>{label}</div>
                </div>
                {i < parts.length - 1 && (
                  <span className="font-black text-white/30" style={{ fontSize: m.big * 0.7, lineHeight: 1, paddingTop: m.gap * 0.5 }}>:</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>
  );
}

function LineupsCard({ theme, payload, size, index, narrow, home, away }: CommonProps & { payload: LineupsPayload }) {
  const m = METRICS[size];
  const sides = [
    { data: payload.home, name: home?.name ?? "Home", color: home?.color ?? "#34d399" },
    { data: payload.away, name: away?.name ?? "Away", color: away?.color ?? "#38bdf8" },
  ];
  const showPos = (size === "xl" || size === "lg") && !narrow;
  const surnameOnly = size === "sm" || !!narrow;
  const surname = (n: string) => n.split(" ").slice(-1)[0];

  if (size === "xs") {
    // Bottom strip: formation + starting XI as one line of surnames per team
    return (
      <Frame theme={theme} type="Line-ups" size={size} index={index}>
        <div className="grid h-full grid-cols-2" style={{ columnGap: m.pad }}>
          {sides.map((s, si) => (
            <div key={si} className="min-w-0">
              <div className="flex items-center gap-2 font-extrabold uppercase text-white" style={{ fontSize: m.body * 0.9 }}>
                <Dot color={s.color} size={m.small * 0.8} />
                <span className="truncate">{s.name}</span>
                <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 font-semibold tabular-nums text-white/80" style={{ fontSize: m.small }}>{s.data.formation}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-white/85" style={{ fontSize: m.small + 1, lineHeight: 1.35 }}>
                {s.data.players.slice(0, 11).map((p) => surname(p.name)).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  return (
    <Frame theme={theme} type="Line-ups" size={size} index={index}>
      <div className="grid h-full grid-cols-2" style={{ columnGap: m.pad }}>
        {sides.map((s, si) => (
          <div key={si} className="flex min-h-0 min-w-0 flex-col">
            <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
              <span className="flex min-w-0 items-center gap-3 font-extrabold uppercase text-white" style={{ fontSize: m.body * 0.85 }}>
                <Dot color={s.color} size={m.small * 0.8} />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/10 px-3 font-semibold tabular-nums text-white/80" style={{ fontSize: m.small }}>
                {s.data.formation}
              </span>
            </div>
            <ul className="min-h-0 flex-1 overflow-hidden">
              {s.data.players.slice(0, 11).map((p, i) => (
                <li key={`${p.number ?? "x"}-${p.name}-${i}`} className="flex items-center gap-3" style={{ height: m.lineRow }}>
                  <span
                    className="flex shrink-0 items-center justify-center rounded-md font-bold tabular-nums text-white"
                    style={{ width: m.lineRow * 0.95, height: m.lineRow * 0.78, fontSize: m.line * 0.85, background: alpha(s.color, 0.55) }}
                  >
                    {p.number ?? "–"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-white" style={{ fontSize: m.line }}>
                    {surnameOnly ? surname(p.name) : p.name}
                  </span>
                  {showPos && <span className="shrink-0 font-semibold uppercase text-white/45" style={{ fontSize: m.small * 0.85 }}>{p.position}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function StandingsCard({ theme, payload, size, index, home, away }: CommonProps & { payload: StandingsPayload }) {
  const m = METRICS[size];
  const rows = payload.rows.slice(0, m.rows.standings);
  const cols = `${m.row * 0.9}px minmax(0,1fr) ${m.row * 1.3}px ${m.row * 1.5}px`;

  return (
    <Frame theme={theme} type="Standings" subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full flex-col">
        <div className="grid items-center border-b border-white/10 pb-2 font-semibold uppercase text-white/45" style={{ gridTemplateColumns: cols, fontSize: m.small * 0.9, letterSpacing: "0.15em" }}>
          <span>#</span><span>Team</span><span className="text-right">P</span><span className="text-right">Pts</span>
        </div>
        <ul className="min-h-0 flex-1 overflow-hidden">
          {rows.map((r) => {
            const mine = matchesTeam(r.team, home) || matchesTeam(r.team, away);
            return (
              <li
                key={r.position}
                className={`grid items-center border-b border-white/5 ${mine ? "rounded-lg" : ""}`}
                style={{ gridTemplateColumns: cols, height: m.row, fontSize: m.body * 0.85, background: mine ? alpha(theme.accent, 0.18) : undefined }}
              >
                <span className="font-bold tabular-nums text-white/60">{r.position}</span>
                <span className={`truncate ${mine ? "font-extrabold text-white" : "font-medium text-white/90"}`}>{r.team}</span>
                <span className="text-right tabular-nums text-white/70">{r.played}</span>
                <span className="text-right font-extrabold tabular-nums text-white">{r.points}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Frame>
  );
}

const OUTCOME: Record<"W" | "D" | "L", string> = {
  W: "linear-gradient(160deg,#34d399,#059669)",
  D: "linear-gradient(160deg,#a1a1aa,#52525b)",
  L: "linear-gradient(160deg,#f87171,#b91c1c)",
};

function FormCard({ theme, payload, size, index, home, away }: CommonProps & { payload: FormPayload }) {
  const m = METRICS[size];
  const team = [home, away].find((t) => matchesTeam(payload.team, t));
  const tile = m.crest * 0.8;

  return (
    <Frame theme={theme} type="Recent form" size={size} index={index} glow={team ? [team.color, team.color] : undefined}>
      <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
        <div className="font-extrabold uppercase text-white" style={{ fontSize: m.body * 1.1, letterSpacing: "0.04em" }}>{payload.team}</div>
        <div className="flex" style={{ gap: m.gap * 0.7 }}>
          {payload.results.slice(0, 5).map((r, i) => (
            <div key={i} className="flex flex-col items-center" style={{ gap: m.gap * 0.3 }}>
              <div
                className="flex items-center justify-center rounded-2xl font-black text-white shadow-lg"
                style={{ width: tile, height: tile, fontSize: tile * 0.5, background: OUTCOME[r.outcome] }}
              >
                {r.outcome}
              </div>
              {size !== "sm" && size !== "xs" && (
                <div className="max-w-[9ch] truncate text-white/75" style={{ fontSize: m.small * 0.9 }}>{r.opponent}</div>
              )}
              {size !== "sm" && (
                <div className="font-bold tabular-nums text-white/90" style={{ fontSize: m.small }}>{r.score}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function tally(meetings: H2HPayload["meetings"]) {
  const wins: Record<string, number> = {};
  let draws = 0;
  for (const mt of meetings) {
    const s = mt.score.match(/(\d+)\s*[-–:]\s*(\d+)/);
    if (!s) continue;
    const a = +s[1], b = +s[2];
    if (a === b) draws++;
    else { const w = a > b ? mt.home : mt.away; wins[w] = (wins[w] ?? 0) + 1; }
  }
  return { wins, draws };
}

function H2HCard({ theme, payload, size, index, home, away }: CommonProps & { payload: H2HPayload }) {
  const m = METRICS[size];
  const { wins, draws } = tally(payload.meetings);
  const names = Object.keys(wins);
  const showBar = names.length <= 2 && names.length + draws > 0;
  const colorFor = (n: string, fallback: string) =>
    (matchesTeam(n, home) ? home?.color : matchesTeam(n, away) ? away?.color : undefined) ?? fallback;
  const segs = [
    { label: names[0], value: wins[names[0]] ?? 0, color: colorFor(names[0] ?? "", "#34d399") },
    { label: "Draws", value: draws, color: "#71717a" },
    { label: names[1], value: wins[names[1]] ?? 0, color: colorFor(names[1] ?? "", "#38bdf8") },
  ].filter((s) => s.value > 0 && s.label);

  return (
    <Frame theme={theme} type="Head to head" size={size} index={index}>
      <div className="flex h-full flex-col" style={{ gap: m.gap * 0.7 }}>
        {showBar && size !== "sm" && (
          <div>
            <div className="flex h-4 overflow-hidden rounded-full bg-white/10">
              {segs.map((s) => <div key={s.label} style={{ flex: s.value, background: s.color }} />)}
            </div>
            <div className="mt-2 flex justify-between font-semibold text-white/85" style={{ fontSize: m.small }}>
              {segs.map((s) => <span key={s.label}>{s.label} · <span className="tabular-nums">{s.value}</span></span>)}
            </div>
          </div>
        )}
        <ul className="min-h-0 flex-1 overflow-hidden">
          {payload.meetings.slice(0, m.rows.h2h).map((mt, i) => (
            <li key={i} className="grid items-center border-b border-white/5" style={{ gridTemplateColumns: `${m.small * 5}px minmax(0,1fr) auto`, height: m.row, gap: m.gap * 0.6, fontSize: m.body * 0.8 }}>
              <span className="tabular-nums text-white/45" style={{ fontSize: m.small * 0.9 }}>{mt.date}</span>
              <span className="truncate text-white/90">{mt.home} <span className="text-white/35">—</span> {mt.away}</span>
              <span className="font-extrabold tabular-nums text-white">{mt.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

function ScorersCard({ theme, payload, size, index }: CommonProps & { payload: TopScorersPayload }) {
  const m = METRICS[size];
  const players = payload.players.slice(0, m.rows.scorers);
  const max = Math.max(1, ...players.map((p) => p.goals));

  return (
    <Frame theme={theme} type="Top scorers" subtitle={payload.competition} size={size} index={index}>
      <ul className="flex h-full flex-col justify-start overflow-hidden">
        {players.map((p, i) => (
          <li key={i} className="flex items-center border-b border-white/5" style={{ height: m.row * 1.15, gap: m.gap * 0.8 }}>
            <span
              className={`flex shrink-0 items-center justify-center rounded-full font-black tabular-nums ${i === 0 ? "bg-amber-400 text-black" : "bg-white/10 text-white/80"}`}
              style={{ width: m.row * 0.7, height: m.row * 0.7, fontSize: m.body * 0.75 }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-bold text-white" style={{ fontSize: m.body * 0.88 }}>
                  {p.name} <span className="font-medium text-white/45" style={{ fontSize: m.small * 0.9 }}>{p.team}</span>
                </span>
                <span className="font-black tabular-nums text-white" style={{ fontSize: m.body * 1.1 }}>{p.goals}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${(p.goals / max) * 100}%`, background: `linear-gradient(90deg, ${theme.secondary}, ${theme.accent})` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function CustomCard({ theme, title, payload, size, index }: CommonProps & { title: string; payload: Record<string, unknown> }) {
  const m = METRICS[size];
  const entries = Object.entries(payload ?? {})
    .filter(([k]) => k !== "zone")
    .slice(0, size === "xs" ? 4 : size === "sm" ? 5 : 8);
  return (
    <Frame theme={theme} type={title || "Info"} size={size} index={index}>
      <dl className="h-full overflow-hidden">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-6 border-b border-white/5" style={{ minHeight: m.row }}>
            <dt className="font-semibold uppercase text-white/50" style={{ fontSize: m.small * 0.9, letterSpacing: "0.12em" }}>{k.replace(/_/g, " ")}</dt>
            <dd className="truncate text-right font-medium text-white" style={{ fontSize: m.body * 0.85 }}>
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </dd>
          </div>
        ))}
      </dl>
    </Frame>
  );
}
