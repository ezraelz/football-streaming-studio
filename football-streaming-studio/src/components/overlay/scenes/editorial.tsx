"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { EditorialCard, MomentumPayload } from "@/lib/api/client";
import { TeamCrest } from "@/components/overlay/crest";
import { LeagueBadge } from "@/components/overlay/league-badge";
import { useOverlayEnv } from "@/components/overlay/env";
import { BroadcastPanel } from "@/components/overlay/broadcast";
import { useI18n, type MsgKey } from "@/lib/i18n";
import { localTeamName } from "@/lib/branding/clubs";
import { accentOn, alpha, competitionLabel, themeFor, themeGradient, type LeagueTheme } from "@/lib/branding/leagues";
import { CardErrorBoundary } from "./card-error-boundary";

export interface OverlayTeam { name: string; color: string; crestUrl?: string | null }
type Size = "xl" | "lg" | "md" | "sm" | "xs";

interface Metrics {
  pad: number; label: number; body: number; small: number; big: number; crest: number;
  gap: number; row: number; lineRow: number; line: number;
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
interface LineupsPayload {
  home: LineupSide;
  away: LineupSide;
  lineup_status?: "confirmed" | "predicted" | "unavailable";
}
interface StandingsPayload {
  competition: string;
  rows: Array<{
    position: number;
    team: string;
    played: number;
    won?: number;
    drawn?: number;
    lost?: number;
    goals_for?: number;
    goals_against?: number;
    goal_difference?: number;
    points: number;
    zone?: { key: string; label: string; type: string } | null;
  }>;
  zones?: Array<{
    key: string;
    label: string;
    type: string;
    from: number;
    to: number;
  }>;
}

interface FormSide {
  team: string;
  results: Array<{ outcome: "W" | "D" | "L"; opponent: string; score: string }>;
}
interface FormPayload {
  home: FormSide;
  away: FormSide;
}
interface LegacyFormPayload {
  team: string;
  results: Array<{ outcome: "W" | "D" | "L"; opponent: string; score: string }>;
}
interface H2HPayload {
  meetings: Array<{ date: string; home_team?: string; home?: string; away_team?: string; away?: string; score: string; competition?: string }>;
  aggregate?: {
    total_matches?: number;
    home_wins?: number;
    draws?: number;
    away_wins?: number;
  };
}
interface TopScorersPayload { competition: string; players: Array<{ name: string; team: string; goals: number }> }

interface Shot {
  x: number;           // 0..100 (origin of the shot, from the shooting team's perspective)
  y: number;           // 0..100
  type: string;        // "goal" | "save" | "miss" | "block" | "post"
  is_home: boolean;
  minute: number | null;
  player?: string | null;
  xg?: number | null;
  xgot?: number | null;
}

interface ShotMapPayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_color: string;
  away_color: string;
  shots: Shot[];
  home_xg: number | null;
  away_xg: number | null;
  unavailable?: boolean;
}

interface MatchPreviewPayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_color: string;
  away_color: string;
  kickoff: string | null;
  venue: string | null;
  city: string | null;
  weather: string | null;
  temperature_c: number | null;
  referee: string | null;
  attendance: number | null;
  preview: string | null;
  fun_fact: string | null;
  unavailable?: boolean;
}

interface TopAssistsPayload {
  competition: string;
  players: Array<{ name: string; team: string; assists: number }>;
}

interface BestXIPlayer {
  name: string;
  team: string;
  position: string;
  rating: number | string | null;
  x: number;  // 0..100 (attacking direction = right)
  y: number;  // 0..100 (top = 0, bottom = 100)
}

interface BestXIPayload {
  competition: string;
  formation: string;
  players: BestXIPlayer[];
  unavailable?: boolean;
}

interface PlayerStat {
  player_id: string | number | null;
  name: string;
  team: "home" | "away";
  minutes: number;
  rating: number | string | null;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passes: number;
  pass_accuracy: number | null;
  tackles: number;
  interceptions: number;
  xg: number | null;
  xg_on_target: number | null;
  big_chances_created: number;
  carries: number;
}

interface PlayerStatsPayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_color: string;
  away_color: string;
  players: PlayerStat[];
  unavailable?: boolean;
}

interface BroadcastChannel {
  name: string;
  type: string;   // "tv" | "streaming" | "radio"
}

interface BroadcastCountry {
  country_code: string;
  country_name: string;
  channels: BroadcastChannel[];
}

interface BroadcastsPayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_short: string;
  away_short: string;
  home_color: string;
  away_color: string;
  kickoff_label: string;
  channels: Array<BroadcastChannel & { country_code: string; country_name: string }>;
  by_country: Record<string, BroadcastCountry>;
  unavailable?: boolean;
}

interface PredictionMarketProb {
  home: number;
  draw: number;
  away: number;
  over_25?: number | null;
  btts_yes?: number | null;
}

interface PredictionModelProb {
  home: number;
  draw: number;
  away: number;
  over_25?: number | null;
  btts_yes?: number | null;
  xg_home?: number | null;
  xg_away?: number | null;
  confidence?: number | null;
  version?: string;
}

interface PredictionPayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_short?: string;
  away_short?: string;
  home_color?: string;
  away_color?: string;
  kickoff_label?: string;
  model: PredictionModelProb | null;
  market: PredictionMarketProb | null;
  prediction_available: boolean;
  odds_available: boolean;
  unavailable?: boolean;
  reason?: string;
}

interface OddsMarket {
  home?: number;
  draw?: number;
  away?: number;
  over?: number;
  under?: number;
  yes?: number;
  no?: number;
  "1X"?: number;
  "12"?: number;
  "X2"?: number;
}

interface OddsBoardPayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_short: string;
  away_short: string;
  home_color: string;
  away_color: string;
  markets: {
    "1x2"?: OddsMarket;
    double_chance?: OddsMarket;
    totals?: Record<string, OddsMarket>;
    btts?: OddsMarket;
  };
  last_update?: string;
  unavailable?: boolean;
}

interface StatRow {
  key: string;
  label: string;
  format: "percent" | "decimal" | "int";
  home: number;
  away: number;
  higher_is_better: boolean | null;
}

interface MatchStatsPayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_short: string;
  away_short: string;
  home_color: string;
  away_color: string;
  stats: StatRow[];
  unavailable?: boolean;
}

interface XGRaceSample {
  minute: number;
  home: number;
  away: number;
  estimated: boolean;
}

interface XGRacePayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_short: string;
  away_short: string;
  home_color: string;
  away_color: string;
  samples: XGRaceSample[];
  home_xg_final: number | null;
  away_xg_final: number | null;
  unavailable?: boolean;
}

interface AveragePosition {
  player_id: string;
  name: string;
  pos: string;   // "GK" | "D" | "M" | "F"
  x: number;     // 0..100 — 0 is own goal line
  y: number;     // 0..100 — 0 is top touchline
  n: number;     // touches (sample size)
}

interface AveragePositionsPayload {
  competition: string;
  home_name: string;
  away_name: string;
  home_short: string;
  away_short: string;
  home_color: string;
  away_color: string;
  home_positions: AveragePosition[];
  away_positions: AveragePosition[];
  unavailable?: boolean;
}

/* ── state helper used by the overlay page ─────────────────────────────── */

const keyOf = (c: Partial<EditorialCard>) => c.id ?? c.card_type ?? "card";

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
  head_to_head: "bottom", prediction: "main", custom: "bottom",
};

const isZone = (z: unknown): z is Zone => ZONES.includes(z as Zone);

export interface TickerItem { text: string; tag?: string }
export interface TickerPayload {
  kind: "ticker";
  label?: string;
  items: Array<string | TickerItem>;
  source?: "fixtures" | "manual" | "news";
  competition?: string;
}
type CardLike = Pick<EditorialCard, "card_type" | "payload">;
export const isTickerCard = (card: CardLike) =>
  card.card_type === "custom" && (card.payload as { kind?: unknown } | null)?.kind === "ticker";

export function zoneOf(card: CardLike): Zone {
  if (isTickerCard(card)) return "ticker";
  const z = (card.payload as { zone?: unknown } | null)?.zone;
  return isZone(z) && z !== "ticker" ? z : (DEFAULT_ZONE[card.card_type] ?? "main");
}

const W = 1728;
const H = 972;
const TOP = 196;
const GAP = 24;
const SIDE_W = 440;
const STRIP_H = 204;
const TICKER_H = 76;
const FLOOR = 40;

export function lowerThirdLift(cards: EditorialCard[]): number | undefined {
  const shown = cards.filter((c) => c.visible);
  const ticker = shown.some((c) => zoneOf(c) === "ticker");
  const strip = shown.some((c) => zoneOf(c) === "bottom");
  if (!ticker && !strip) return undefined;
  return (ticker ? TICKER_H + GAP : 0) + (strip ? STRIP_H + GAP : 0) + 12;
}

const ORDER: Size[] = ["xl", "lg", "md", "sm", "xs"];
const H_NEED: Record<Size, number> = { xl: 620, lg: 550, md: 475, sm: 345, xs: 0 };
const W_NEED: Record<Size, number> = { xl: 800, lg: 640, md: 480, sm: 340, xs: 0 };

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

/** Keeps a league's neon accent readable when the cards are in light tone. */
const toneTheme = (th: LeagueTheme, tone: "dark" | "light"): LeagueTheme =>
  tone === "light" ? { ...th, accent: accentOn(th, "light") } : th;

/* ── layer ─────────────────────────────────────────────────────────────── */

export function EditorialLayer({
  cards, home, away, competition, guides = false,
}: {
  cards: EditorialCard[];
  home?: OverlayTeam;
  away?: OverlayTeam;
  competition?: string;
  guides?: boolean;
}) {
  const { tone } = useOverlayEnv();
  const { t } = useI18n();
  const shown = cards.filter((c) => c.visible);
  const inZone = (z: Zone, max: number) => shown.filter((c) => zoneOf(c) === z).slice(-max);

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

  let order = 0;
  const view = (card: EditorialCard, size: Size, tileW: number) => (
    <CardView
      key={keyOf(card)} card={card} size={size} index={order++} narrow={tileW < 520}
      theme={toneTheme(themeFor(competitionOf(card, league)), tone)} home={home} away={away}
    />
  );

  const n = main.length;
  const [mc, mr] = n <= 1 ? [1, 1] : n === 2 ? (mainW >= 1000 ? [2, 1] : [1, 2]) : n === 3 ? (mainW >= 1200 ? [3, 1] : [2, 2]) : [2, 2];
  const gridW = n === 1 ? Math.min(mainW, 1240) : mainW;
  const mainTileW = (gridW - GAP * (mc - 1)) / mc;
  const mainTileH = (availH - GAP * (mr - 1)) / mr;
  const mainSize = fit("xl", mainTileW, mainTileH, factorFor(main));

  const columnSize = (items: EditorialCard[]) =>
    fit("md", Infinity, (availH - GAP * (items.length - 1)) / Math.max(1, items.length), factorFor(items));

  const stripTileW = (W - GAP * (bottom.length - 1)) / Math.max(1, bottom.length);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {guides && <ZoneGuides label={(z) => t(`zone.${z}` as const)} />}

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
          theme={toneTheme(themeFor(competitionOf(ticker, league)), tone)}
          index={order++}
        />
      )}
    </div>
  );
}

function ZoneGuides({ label }: { label: (z: Zone) => string }) {
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
      {box(label("left"), 0, TOP, SIDE_W, availH)}
      {box(label("main"), SIDE_W + GAP, TOP, W - 2 * (SIDE_W + GAP), availH)}
      {box(label("right"), W - SIDE_W, TOP, SIDE_W, availH)}
      {box(label("bottom"), 0, stripTop, W, STRIP_H)}
      {box(label("ticker"), 0, H - TICKER_H, W, TICKER_H)}
    </>
  );
}

const TICKER_LABELS: Record<string, "ov.liveNow" | "ov.nextMatches" | "gfx.news" | "gfx.info" | "gfx.breaking"> = {
  "Live now": "ov.liveNow", "Next matches": "ov.nextMatches", News: "gfx.news", Info: "gfx.info", Breaking: "gfx.breaking",
};
/** Ticker labels are stored in English (the studio matches on them); show them in the overlay language. */
const tickerLabel = (label: string | undefined, t: ReturnType<typeof useI18n>["t"]) =>
  !label ? t("card.next") : TICKER_LABELS[label] ? t(TICKER_LABELS[label]) : label;

function TickerBar({ payload, theme, index }: { payload: TickerPayload; theme: LeagueTheme; index: number }) {
  const { t } = useI18n();
  const items: TickerItem[] = (payload.items ?? [])
    .map((i) => (typeof i === "string" ? { text: i } : i))
    .filter((i): i is TickerItem => !!i?.text);
  if (items.length === 0) return null;

  const chars = items.reduce((total, i) => total + i.text.length + (i.tag?.length ?? 0) + 6, 0);
  const rowW = Math.max(1500, chars * 17);
  const duration = Math.round(rowW / 110);
  const mask = "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)";

  const row = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center" style={{ minWidth: rowW }}>
      {items.map((it, i) => (
        <span key={i} className="flex shrink-0 items-center">
          {it.tag && (
            <span
              className="bc-slant mr-3 px-3 py-0.5 font-extrabold uppercase"
              style={{ fontSize: 22, letterSpacing: "0.08em", background: theme.accent, color: "#0a101c" }}
            >
              {it.tag}
            </span>
          )}
          <span className="font-bold text-white" style={{ fontSize: 34 }}>{it.text}</span>
          <span className="mx-8 inline-block font-black" style={{ fontSize: 30, color: theme.accent, letterSpacing: "-0.15em" }}>»»</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="ov-card-in bc-drop absolute"
      style={{ left: 0, top: H - TICKER_H, width: W, height: TICKER_H, filter: "drop-shadow(0 12px 22px rgb(0 0 0 / 0.5))", ["--ov-delay" as string]: `${index * 120}ms` } as CSSProperties}
    >
      <div className="relative flex h-full overflow-hidden" style={{ background: "var(--ov-surface-solid)", borderTop: `4px solid ${theme.accent}` }}>
        {/* slanted label tab */}
        <div
          className="bc-slant relative -ml-5 flex shrink-0 items-center"
          style={{ paddingLeft: 44, paddingRight: 44, background: `linear-gradient(100deg, ${theme.primary}, ${theme.secondary})`, borderRight: `8px solid ${theme.accent}` }}
        >
          <span className="flex items-center gap-4">
            {theme.id !== "default" && <LeagueBadge theme={theme} size={44} />}
            <span className="font-extrabold uppercase text-[#fff]" style={{ fontSize: 28, letterSpacing: "0.14em" }}>
              {tickerLabel(payload.label, t)}
            </span>
          </span>
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ WebkitMaskImage: mask, maskImage: mask }}>
          <div className="ov-marquee flex h-full w-max items-center whitespace-nowrap" style={{ animationDuration: `${duration}s` }}>
            {row(false)}
            {row(true)}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardView({
  card, size, index, narrow, theme, home, away,
}: CommonProps & { card: EditorialCard }) {
  const { t } = useI18n();
  const p = card.payload;
  const common = { size, index, narrow, theme, home, away };

  const renderCard = () => {
    const cardType = card.card_type as string;

    switch (cardType) {
      case "fixture_intro": return <IntroCard payload={p as unknown as FixtureIntroPayload} {...common} />;
      case "lineups":       return <LineupsCard payload={p as unknown as LineupsPayload} {...common} />;
      case "standings":     return <StandingsCard payload={p as unknown as StandingsPayload} {...common} />;
      case "form":          return <FormCard payload={p as unknown as FormPayload | LegacyFormPayload} {...common} />;
      case "head_to_head":  return <H2HCard payload={p as unknown as H2HPayload} {...common} />;
      case "top_scorers":   return <ScorersCard payload={p as unknown as TopScorersPayload} {...common} metric="goals" />;
      case "top_assists":   return <ScorersCard payload={p as unknown as TopAssistsPayload} {...common} metric="assists" />;
      case "match_summary": return <SummaryCard payload={p as unknown as SummaryPayload} {...common} />;
      case "countdown":     return <CountdownCard payload={p as unknown as CountdownPayload} {...common} />;
      case "prediction":    return <PredictionCard payload={p as unknown as PredictionPayload} {...common} />;
      case "shot_map":      return <ShotMapCard payload={p as unknown as ShotMapPayload} {...common} />;
      case "odds_board":    return <OddsBoardCard payload={p as unknown as OddsBoardPayload} {...common} />;
      case "momentum":      return <MomentumCard payload={p as unknown as MomentumPayload} {...common} />;
      case "best_xi":       return <BestXICard payload={p as unknown as BestXIPayload} {...common} />;
      case "xg_race":       return <XGRaceCard payload={p as unknown as XGRacePayload} {...common} />;
      case "average_positions": return <AveragePositionsCard payload={p as unknown as AveragePositionsPayload} {...common} />;
      case "match_stats":   return <MatchStatsCard payload={p as unknown as MatchStatsPayload} {...common} />;
      case "player_stats":  return <PlayerStatsCard payload={p as unknown as PlayerStatsPayload} {...common} />;
      case "broadcasts":    return <BroadcastsCard payload={p as unknown as BroadcastsPayload} {...common} />;
      case "match_preview": return <MatchPreviewCard payload={p as unknown as MatchPreviewPayload} {...common} />;
      default:              return <CustomCard title={card.title} payload={p} {...common} />;
    }
  };

  return (
    <CardErrorBoundary
      label={card.card_type}
      fallback={
        <Frame theme={theme} type={card.card_type} size={size} index={index}>
          <div className="flex h-full items-center justify-center text-center text-white/50" style={{ fontSize: 20 }}>
            {t("card.unavailable")}
          </div>
        </Frame>
      }
    >
      {renderCard()}
    </CardErrorBoundary>
  );
}

interface CommonProps { size: Size; index: number; narrow?: boolean; theme: LeagueTheme; home?: OverlayTeam; away?: OverlayTeam }

/* ── shared pieces ─────────────────────────────────────────────────────── */

/** Card titles that older cards pass as English literals; shown in the overlay language. */
const TITLE_KEYS: Record<string, MsgKey> = {
  "Standings": "card.standings", "Preview": "card.preview", "Match preview": "card.matchPreview",
  "Match forecast": "card.prediction", "Momentum": "card.momentum", "Team of the Season": "card.bestXI",
  "Player ratings": "card.playerRatings", "Where to watch": "card.broadcasts", "xG race": "card.xgRace",
  "Match stats": "card.matchStats", "Betting odds": "card.odds", "Average positions": "card.avgPositions",
  "Top assists": "card.assists", "Top scorers": "card.scorers",
};

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
  const { t } = useI18n();
  const title = TITLE_KEYS[type] ? t(TITLE_KEYS[type]) : type;
  return (
    <BroadcastPanel
      type={title}
      subtitle={subtitle}
      theme={theme}
      scale={{ pad: m.pad, label: m.label, small: m.small, gap: m.gap }}
      index={index}
      glow={glow}
    >
      {children}
    </BroadcastPanel>
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
  const { t } = useI18n();
  return (
    <Frame
      theme={theme} type={t("card.matchPreview")} subtitle={payload.competition} size={size} index={index} glow={[payload.home.color, payload.away.color]}
    >
      <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
        <div className="flex w-full items-center justify-around">
          <TeamColumn team={payload.home} m={m} />
          <span
            className="rounded-full border border-white/15 bg-white/5 font-black text-white/60"
            style={{ fontSize: m.body, padding: `${m.gap * 0.3}px ${m.gap}px`, letterSpacing: "0.1em" }}
          >
            {t("card.vsShort")}
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
  const { lang } = useI18n();
  return (
    <div className="flex min-w-0 flex-col items-center" style={{ gap: m.gap * 0.5 }}>
      <TeamCrest name={team.name} color={team.color} crestUrl={crestOf(team)} size={m.crest} />
      <div className="max-w-full truncate font-extrabold uppercase text-white" style={{ fontSize: m.body, letterSpacing: "0.04em" }}>
        {localTeamName(team.name, lang)}
      </div>
    </div>
  );
}

function SummaryCard({ theme, payload, size, index }: CommonProps & { payload: SummaryPayload }) {
  const m = METRICS[size];
  const { t } = useI18n();
  const isHome = (t: string) =>
    t.toLowerCase().includes(payload.home.name.toLowerCase()) ||
    payload.home.name.toLowerCase().includes(t.toLowerCase());
  const homeGoals = payload.goals.filter((g) => isHome(g.team)).slice(0, m.rows.goals);
  const awayGoals = payload.goals.filter((g) => !isHome(g.team)).slice(0, m.rows.goals);

  return (
    <Frame
      theme={theme} type={t("card.fullTime")} subtitle={payload.competition} size={size} index={index} glow={[payload.home.color, payload.away.color]}
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
  const { t, lang } = useI18n();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = now === null ? 0 : Math.max(0, new Date(payload.kickoff).getTime() - now);
  const parts: [string, number][] = [
    [t("card.hours"), Math.floor(diff / 3600000)],
    [t("card.minutes"), Math.floor((diff % 3600000) / 60000)],
    [t("card.seconds"), Math.floor((diff % 60000) / 1000)],
  ];
  const kickedOff = now !== null && diff === 0;

  return (
    <Frame theme={theme} type={t("card.kickoffIn")} subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
        <div className="font-bold text-white" style={{ fontSize: m.body * 1.1 }}>
          {localTeamName(payload.home_name, lang)} <span className="text-white/40">{t("common.vs")}</span> {localTeamName(payload.away_name, lang)}
        </div>
        {kickedOff ? (
          <div className="font-black uppercase" style={{ fontSize: m.big * 0.6, color: theme.accent }}>{t("card.kickoff")}</div>
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
  const { t, lang } = useI18n();
  const sides = [
    { data: payload.home, name: home ? localTeamName(home.name, lang) : t("card.home"), color: home?.color ?? "#34d399" },
    { data: payload.away, name: away ? localTeamName(away.name, lang) : t("card.away"), color: away?.color ?? "#38bdf8" },
  ];
  const showPos = (size === "xl" || size === "lg") && !narrow;
  const surnameOnly = size === "sm" || !!narrow;
  const surname = (n: string) => n.split(" ").slice(-1)[0];
  const isPredicted = payload.lineup_status === "predicted";

  if (size === "xs") {
    return (
      <Frame theme={theme} type={isPredicted ? t("card.lineupsPredicted") : t("card.lineups")} size={size} index={index}>
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
    <Frame
      theme={theme}
      type={isPredicted ? t("card.lineupsPredicted") : t("card.lineups")}
      size={size}
      index={index}
    >
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

const ZONE_COLORS: Record<string, string> = {
  cl: "#34d399",      // Champions League
  elq: "#38bdf8",     // Europa qualifiers
  promo: "#a78bfa",   // Promotion
  playoff: "#fbbf24", // Playoffs
  rel: "#f87171",     // Relegation
};

function StandingsCard({ theme, payload, size, index, home, away }: CommonProps & { payload: StandingsPayload }) {
  const m = METRICS[size];
  const { t, lang } = useI18n();
  const rows = payload.rows.slice(0, m.rows.standings);
  
  // Choose columns based on size
  const showExtras = size === "xl" || size === "lg" || size === "md";
  const cols = showExtras
    ? `${m.row * 0.9}px minmax(0,1fr) ${m.row * 1.1}px ${m.row * 1.2}px ${m.row * 1.3}px ${m.row * 1.5}px`
    : `${m.row * 0.9}px minmax(0,1fr) ${m.row * 1.3}px ${m.row * 1.5}px`;

  return (
    <Frame theme={theme} type="Standings" subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full flex-col">
        <div
          className="grid items-center border-b border-white/10 pb-2 font-semibold uppercase text-white/45"
          style={{ gridTemplateColumns: cols, fontSize: m.small * 0.9, letterSpacing: "0.15em" }}
        >
          <span>#</span>
          <span>{t("card.team")}</span>
          <span className="text-right">{t("card.played")}</span>
          {showExtras && <span className="text-right">{t("card.gd")}</span>}
          {showExtras && <span className="text-right">{t("card.wdl")}</span>}
          <span className="text-right">{t("card.points")}</span>
        </div>
        <ul className="min-h-0 flex-1 overflow-hidden">
          {rows.map((r) => {
            const mine = matchesTeam(r.team, home) || matchesTeam(r.team, away);
            const gd = r.goal_difference ?? ((r.goals_for ?? 0) - (r.goals_against ?? 0));
            const wdl = `${r.won ?? 0}-${r.drawn ?? 0}-${r.lost ?? 0}`;
            
            // Determine row color based on the zone key
            const zoneKey = r.zone?.key;
            const accentColor = zoneKey ? ZONE_COLORS[zoneKey] : undefined;
            // Style the row: subtle accent for zone + highlight for our teams
            const rowStyle: React.CSSProperties = {
              gridTemplateColumns: cols,
              height: m.row,
              fontSize: m.body * 0.85,
              background: mine ? alpha(theme.accent, 0.18) : undefined,
              // Add a subtle left border if the team is in a zone
              borderLeft: accentColor ? `3px solid ${accentColor}` : "3px solid transparent",
            };

            return (
              <li
                key={r.position}
                className={`grid items-center border-b border-white/5 ${mine ? "rounded-lg" : ""}`}
                style={rowStyle}
              >
                <span className="font-bold tabular-nums text-white/60 pl-1">{r.position}</span>
                <span className={`truncate ${mine ? "font-extrabold text-white" : "font-medium text-white/90"}`}>
                  {localTeamName(r.team, lang)}
                </span>
                <span className="text-right tabular-nums text-white/70">{r.played}</span>
                {showExtras && (
                  <span
                    className="text-right tabular-nums"
                    style={{ color: gd > 0 ? "#34d399" : gd < 0 ? "#f87171" : "#a1a1aa" }}
                  >
                    {gd > 0 ? `+${gd}` : gd}
                  </span>
                )}
                {showExtras && <span className="text-right tabular-nums text-white/70">{wdl}</span>}
                <span className="text-right font-extrabold tabular-nums text-white pr-1">{r.points}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Frame>
  );
}

function MatchPreviewCard({ theme, payload, size, index }: CommonProps & { payload: MatchPreviewPayload }) {
  const m = METRICS[size];
  const { t } = useI18n();

  if (payload.unavailable && !payload.preview && !payload.venue) {
    return (
      <Frame theme={theme} type="Preview" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            {t("card.noPreview")}
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            {t("card.noPreviewBody")}
          </div>
        </div>
      </Frame>
    );
  }

  // Header metadata row: venue · city · weather · temp
  const metaBits: string[] = [];
  if (payload.venue) {
    metaBits.push(payload.city ? `${payload.venue}, ${payload.city}` : payload.venue);
  }
  if (payload.weather) {
    metaBits.push(
      payload.temperature_c != null
        ? `${payload.weather} · ${payload.temperature_c}°C`
        : payload.weather,
    );
  }
  if (payload.referee) {
    metaBits.push(t("card.referee", { name: payload.referee }));
  }
  if (payload.attendance != null) {
    metaBits.push(t("card.attendance", { n: payload.attendance.toLocaleString() }));
  }

  // Truncate preview to fit at each size
  const previewText = payload.preview ?? "";
  const maxChars =
    size === "xs" ? 120 :
    size === "sm" ? 200 :
    size === "md" ? 320 :
    size === "lg" ? 450 :
    600;
  const truncated = previewText.length > maxChars
    ? previewText.slice(0, maxChars - 1).trimEnd() + "…"
    : previewText;

  return (
    <Frame
      theme={theme}
      type="Match preview"
      subtitle={payload.competition}
      size={size}
      index={index}
      glow={[payload.home_color, payload.away_color]}
    >
      <div className="flex h-full flex-col" style={{ gap: m.gap * 0.8 }}>
        {/* Team names */}
        <div
          className="flex items-center justify-between font-extrabold uppercase"
          style={{ fontSize: m.body * 0.9, letterSpacing: "0.02em" }}
        >
          <span className="truncate" style={{ color: payload.home_color }}>
            {payload.home_name}
          </span>
          <span className="shrink-0 text-white/40" style={{ fontSize: m.body * 0.7 }}>vs</span>
          <span className="truncate text-right" style={{ color: payload.away_color }}>
            {payload.away_name}
          </span>
        </div>

        {/* AI preview paragraph */}
        {truncated && (
          <p
            className="flex-1 overflow-hidden text-white/85"
            style={{
              fontSize: size === "xs" ? m.small : m.body * 0.7,
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: size === "xs" ? 2 : size === "sm" ? 3 : 5,
              WebkitBoxOrient: "vertical",
            }}
          >
            {truncated}
          </p>
        )}

        {/* Fun fact (accent strip) */}
        {payload.fun_fact && size !== "xs" && size !== "sm" && (
          <div
            className="rounded-lg px-3 py-2 text-white/75"
            style={{
              fontSize: m.small,
              background: alpha(theme.accent, 0.14),
              borderLeft: `3px solid ${theme.accent}`,
            }}
          >
            <span className="font-bold uppercase tracking-wider" style={{ color: theme.accent }}>
              Did you know ·{" "}
            </span>
            {payload.fun_fact}
          </div>
        )}

        {/* Footer metadata: venue · weather · referee */}
        {metaBits.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-white/55"
            style={{ fontSize: m.small * 0.85 }}
          >
            {metaBits.map((bit, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-white/25">·</span>}
                {bit}
              </span>
            ))}
          </div>
        )}
      </div>
    </Frame>
  );
}

const OUTCOME: Record<"W" | "D" | "L", string> = {
  W: "linear-gradient(160deg,#34d399,#059669)",
  D: "linear-gradient(160deg,#a1a1aa,#52525b)",
  L: "linear-gradient(160deg,#f87171,#b91c1c)",
};

function FormCard({ theme, payload, size, index, home, away }: CommonProps & { payload: FormPayload | LegacyFormPayload }) {
  const m = METRICS[size];
  const { t, lang } = useI18n();
  const tile = m.crest * 0.8;

  const isLegacy = !!("team" in payload) && !("home" in payload);

  if (isLegacy) {
    return (
      <Frame theme={theme} type={t("card.form")} size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white" style={{ fontSize: m.body }}>
            {localTeamName((payload as LegacyFormPayload).team, lang)}
          </div>
          <p className="text-white/50" style={{ fontSize: m.small }}>
            {t("card.legacyForm")}
          </p>
        </div>
      </Frame>
    );
  }

  const p = payload as FormPayload;
  const homeData: FormSide = p.home ?? { team: home?.name ?? t("card.home"), results: [] };
  const awayData: FormSide = p.away ?? { team: away?.name ?? t("card.away"), results: [] };

  const sides: Array<{ side: "home" | "away"; data: FormSide; accentColor: string }> = [
    { side: "home", data: homeData, accentColor: home?.color ?? "#34d399" },
    { side: "away", data: awayData, accentColor: away?.color ?? "#38bdf8" },
  ];

  if (size === "xs") {
    return (
      <Frame theme={theme} type={t("card.form")} size={size} index={index}>
        <div className="grid h-full grid-cols-2" style={{ columnGap: m.pad }}>
          {sides.map(({ side, data, accentColor }) => (
            <div key={side} className="flex min-w-0 items-center gap-3">
              <Dot color={accentColor} size={m.small * 0.9} />
              <span className="truncate font-extrabold uppercase text-white" style={{ fontSize: m.body * 0.9 }}>
                {localTeamName(data.team, lang)}
              </span>
              <span className="ml-auto flex shrink-0 gap-1">
                {data.results.slice(0, 5).map((r, i) => (
                  <span
                    key={i}
                    className="flex items-center justify-center rounded-md font-black text-[#fff]"
                    style={{
                      width: m.small * 1.3,
                      height: m.small * 1.3,
                      fontSize: m.small * 0.85,
                      background: OUTCOME[r.outcome],
                    }}
                  >
                    {r.outcome}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  return (
    <Frame theme={theme} type={t("card.form")} size={size} index={index}>
      <div className="flex h-full flex-col justify-around" style={{ gap: m.gap }}>
        {sides.map(({ side, data, accentColor }) => (
          <div key={side} className="flex items-center" style={{ gap: m.gap }}>
            <div className="flex min-w-0 items-center gap-3" style={{ minWidth: m.crest * 1.1 }}>
              <Dot color={accentColor} size={m.small * 0.9} />
              <span
                className="truncate font-extrabold uppercase text-white"
                style={{ fontSize: m.body * 0.95, letterSpacing: "0.02em" }}
              >
                {localTeamName(data.team, lang)}
              </span>
            </div>

            <div className="flex flex-1 items-center" style={{ gap: m.gap * 0.6 }}>
              {data.results.length === 0 ? (
                <span className="text-white/40" style={{ fontSize: m.small }}>{t("card.noRecent")}</span>
              ) : (
                data.results.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex flex-col items-center" style={{ gap: m.gap * 0.25 }}>
                    <div
                      className="flex items-center justify-center rounded-2xl font-black text-[#fff] shadow-lg"
                      style={{ width: tile, height: tile, fontSize: tile * 0.5, background: OUTCOME[r.outcome] }}
                    >
                      {r.outcome}
                    </div>
                    {size !== "sm" && (
                      <>
                        <div className="max-w-[9ch] truncate text-white/70" style={{ fontSize: m.small * 0.85 }}>
                          {r.opponent}
                        </div>
                        <div className="font-bold tabular-nums text-white/85" style={{ fontSize: m.small * 0.9 }}>
                          {r.score}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// Define ProbBar OUTSIDE the component
function ProbBar({
  label,
  probs,
  accentBar,
  theme,
  m,
}: {
  label: string;
  probs: { home: number; draw: number; away: number };
  accentBar?: string;
  theme: LeagueTheme;
  m: Metrics;
}) {
  const t = probs.home + probs.draw + probs.away || 1;
  const hp = (probs.home / t) * 100;
  const dp = (probs.draw / t) * 100;
  const ap = (probs.away / t) * 100;
  const pct = (v: number) => Math.round(v * 100);

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center justify-between text-white/55 uppercase"
        style={{ fontSize: m.small * 0.8, letterSpacing: "0.1em" }}
      >
        <span>{label}</span>
      </div>
      <div className="flex h-10 overflow-hidden rounded-lg bg-white/10">
        <div
          className="flex items-center justify-center font-bold text-white"
          style={{ width: `${hp}%`, background: accentBar || themeGradient(theme) }}
        >
          {pct(probs.home)}%
        </div>
        <div
          className="flex items-center justify-center font-bold text-white/85"
          style={{ width: `${dp}%`, background: "rgba(161,161,170,0.7)" }}
        >
          {pct(probs.draw)}%
        </div>
        <div
          className="flex items-center justify-center font-bold text-white"
          style={{ width: `${ap}%`, background: alpha(theme.accent, 0.85) }}
        >
          {pct(probs.away)}%
        </div>
      </div>
    </div>
  );
}

// Now the main card
function PredictionCard({ theme, payload, size, index }: CommonProps & { payload: PredictionPayload }) {
  const m = METRICS[size];
  const { t, lang } = useI18n();

  if (payload.unavailable || (!payload.model && !payload.market)) {
    return (
      <Frame theme={theme} type="Match forecast" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center text-white/60" style={{ gap: m.gap }}>
          <div style={{ fontSize: m.body }}>{t("card.noPrediction")}</div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            {payload.reason || t("card.availableLater")}
          </div>
        </div>
      </Frame>
    );
  }

  const pct = (v: number) => Math.round(v * 100);
  const hasBoth = !!(payload.model && payload.market);

  return (
    <Frame
      theme={theme}
      type="Match forecast"
      subtitle={payload.competition}
      size={size}
      index={index}
    >
      <div className="flex h-full flex-col" style={{ gap: m.gap }}>
        {/* Header: team names + kickoff */}
        <div
          className="flex items-center justify-between border-b border-white/10 pb-2 font-extrabold uppercase"
          style={{ fontSize: m.body * 0.85 }}
        >
          <span className="truncate max-w-[35%]" style={{ color: payload.home_color || "#fff" }}>
            {localTeamName(payload.home_name, lang)}
          </span>
          <span className="shrink-0 text-center text-white/45" style={{ fontSize: m.body * 0.65 }}>
            {payload.kickoff_label || "vs"}
          </span>
          <span className="truncate max-w-[35%] text-right" style={{ color: payload.away_color || "#fff" }}>
            {localTeamName(payload.away_name, lang)}
          </span>
        </div>

        {/* Market bar (if available) */}
        {payload.market && (
          <ProbBar
            label="Market · consensus odds"
            probs={payload.market}
            accentBar={`linear-gradient(90deg, ${theme.secondary}, ${theme.primary})`}
            theme={theme}
            m={m}
          />
        )}

        {/* Model bar (if available) */}
        {payload.model && (
          <ProbBar
            label={`Model · ${payload.model.version ?? "v1"}${payload.model.confidence != null ? ` · ${(payload.model.confidence * 100).toFixed(0)}% conf` : ""}`}
            probs={payload.model}
            theme={theme}
            m={m}
          />
        )}

        {/* Labels under the bars */}
        <div className="flex items-center justify-between text-white/55" style={{ fontSize: m.small * 0.9 }}>
          <span>{t("card.home")}</span>
          <span>{t("card.draw")}</span>
          <span>{t("card.away")}</span>
        </div>

        {/* Secondary markets: O/U 2.5 + BTTS */}
        {(payload.model || payload.market) && size !== "xs" && (
          <div className="grid grid-cols-2 gap-x-6 border-t border-white/10 pt-2" style={{ fontSize: m.small }}>
            {(payload.model?.over_25 != null || payload.market?.over_25 != null) && (
              <div>
                <div className="text-white/45 uppercase" style={{ letterSpacing: "0.15em", fontSize: m.small * 0.8 }}>
                  {t("card.goals25")}
                </div>
                <div className="mt-0.5 flex gap-3 text-white/85">
                  {payload.market?.over_25 != null && (
                    <span>
                      Mkt · <span className="font-bold tabular-nums">{pct(payload.market.over_25)}%</span>
                    </span>
                  )}
                  {payload.model?.over_25 != null && (
                    <span>
                      Model · <span className="font-bold tabular-nums">{pct(payload.model.over_25)}%</span>
                    </span>
                  )}
                </div>
              </div>
            )}
            {(payload.model?.btts_yes != null || payload.market?.btts_yes != null) && (
              <div>
                <div className="text-white/45 uppercase" style={{ letterSpacing: "0.15em", fontSize: m.small * 0.8 }}>
                  {t("card.btts")}
                </div>
                <div className="mt-0.5 flex gap-3 text-white/85">
                  {payload.market?.btts_yes != null && (
                    <span>
                      Mkt · <span className="font-bold tabular-nums">{pct(payload.market.btts_yes)}%</span>
                    </span>
                  )}
                  {payload.model?.btts_yes != null && (
                    <span>
                      Model · <span className="font-bold tabular-nums">{pct(payload.model.btts_yes)}%</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* xG line — only when the model provides it */}
        {payload.model?.xg_home != null && payload.model?.xg_away != null && size !== "xs" && (
          <div className="text-white/55" style={{ fontSize: m.small * 0.85 }}>
            <span className="text-white/40 uppercase tracking-wider" style={{ fontSize: m.small * 0.75 }}>
              Expected goals ·{" "}
            </span>
            <span className="font-bold text-white tabular-nums">
              {payload.model.xg_home.toFixed(2)} — {payload.model.xg_away.toFixed(2)}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between text-white/35" style={{ fontSize: m.small * 0.8 }}>
          <span>
            {hasBoth ? "Market vs model" : payload.market ? "Market only" : "Model only"}
          </span>
          <span className="italic">Estimates, not guarantees</span>
        </div>
      </div>
    </Frame>
  );
}

const SHOT_COLOR: Record<string, string> = {
  goal: "#34d399",     // green
  save: "#38bdf8",     // sky blue — on target, saved
  miss: "#94a3b8",     // slate — off target
  block: "#71717a",    // grey — blocked
  post: "#fbbf24",     // amber — hit the woodwork
};

const SHOT_RADIUS: Record<string, number> = {
  goal: 1.8,
  save: 1.3,
  miss: 1.1,
  block: 1.1,
  post: 1.3,
};

function ShotMapCard({ theme, payload, size, index, home, away }: CommonProps & { payload: ShotMapPayload }) {
  const m = METRICS[size];
  const { t, lang } = useI18n();

  if (payload.unavailable || payload.shots.length === 0) {
    return (
      <Frame theme={theme} type={t("card.shotMap")} size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            {t("card.noShots")}
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            {t("card.noShotsBody")}
          </div>
        </div>
      </Frame>
    );
  }

  // Filter by team when displaying; split the card vertically into two halves
  // (home shooting right, away shooting left) — the classic "attacking direction"
  // convention, both teams attacking the goal on the opposite side.
  const homeShots = payload.shots.filter((s) => s.is_home);
  const awayShots = payload.shots.filter((s) => !s.is_home);

  const homeXG = payload.home_xg != null ? payload.home_xg.toFixed(2) : "—";
  const awayXG = payload.away_xg != null ? payload.away_xg.toFixed(2) : "—";

  // League-theme-aware header with xG on each side
  return (
    <Frame
      theme={theme}
      type={t("card.shotMap")}
      subtitle={payload.competition}
      size={size}
      index={index}
    >
      <div className="flex h-full flex-col" style={{ gap: m.gap * 0.7 }}>
        {/* Header: team names + xG */}
        <div className="flex items-center justify-between font-extrabold uppercase" style={{ fontSize: m.body * 0.85 }}>
          <span className="truncate" style={{ color: payload.home_color }}>{localTeamName(payload.home_name, lang)}</span>
          <span className="text-white/40">xG</span>
          <span className="truncate text-right" style={{ color: payload.away_color }}>{localTeamName(payload.away_name, lang)}</span>
        </div>
        <div className="flex items-center justify-between tabular-nums font-black text-white" style={{ fontSize: m.body * 1.15 }}>
          <span>{homeXG}</span>
          <span className="text-white/30">—</span>
          <span>{awayXG}</span>
        </div>

        {/* Pitch */}
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <svg
            viewBox="0 0 100 64"
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
            aria-label="Shot map"
          >
            {/* Pitch background */}
            <rect x="0" y="0" width="100" height="64" fill="var(--ov-pitch)" rx="1" />

            {/* Halfway line */}
            <line x1="50" y1="0" x2="50" y2="64" stroke="white" strokeOpacity="0.2" strokeWidth="0.2" />

            {/* Center circle */}
            <circle cx="50" cy="32" r="7" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.2" />

            {/* Left penalty area (away shooting toward here) */}
            <rect x="0" y="12" width="14" height="40" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.2" />
            <rect x="0" y="22" width="6" height="20" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.2" />
            <circle cx="10" cy="32" r="0.5" fill="white" fillOpacity="0.4" />

            {/* Right penalty area (home shooting toward here) */}
            <rect x="86" y="12" width="14" height="40" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.2" />
            <rect x="94" y="22" width="6" height="20" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.2" />
            <circle cx="90" cy="32" r="0.5" fill="white" fillOpacity="0.4" />

            {/* Home shots (attacking right) — home's shots come from Bzzoiro's
                coordinate space (0..100 from the shooter's own attacking half).
                We flip the x so they appear in the right half. */}
            {homeShots.map((s, i) => (
              <circle
                key={`h-${i}`}
                cx={50 + s.x / 2}
                cy={s.y * 0.64}
                r={SHOT_RADIUS[s.type] ?? 1.2}
                fill={SHOT_COLOR[s.type] ?? "#94a3b8"}
                fillOpacity={s.type === "goal" ? 0.95 : 0.65}
                stroke={s.type === "goal" ? "#fff" : "none"}
                strokeWidth={s.type === "goal" ? 0.3 : 0}
              >
                <title>
                  {s.player ?? "?"} · {s.minute ?? "?"}&#39; · {s.type}
                  {s.xg != null ? ` · xG ${s.xg.toFixed(2)}` : ""}
                </title>
              </circle>
            ))}

            {/* Away shots (attacking left) */}
            {awayShots.map((s, i) => (
              <circle
                key={`a-${i}`}
                cx={50 - s.x / 2}
                cy={s.y * 0.64}
                r={SHOT_RADIUS[s.type] ?? 1.2}
                fill={SHOT_COLOR[s.type] ?? "#94a3b8"}
                fillOpacity={s.type === "goal" ? 0.95 : 0.65}
                stroke={s.type === "goal" ? "#fff" : "none"}
                strokeWidth={s.type === "goal" ? 0.3 : 0}
              >
                <title>
                  {s.player ?? "?"} · {s.minute ?? "?"}&#39; · {s.type}
                  {s.xg != null ? ` · xG ${s.xg.toFixed(2)}` : ""}
                </title>
              </circle>
            ))}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-white/60" style={{ fontSize: m.small * 0.8 }}>
          {(["goal", "save", "miss", "block", "post"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-full"
                style={{
                  width: m.small * 0.7,
                  height: m.small * 0.7,
                  background: SHOT_COLOR[k],
                  opacity: k === "goal" ? 0.95 : 0.65,
                }}
              />
              <span className="uppercase tracking-wider">{t(`card.shot.${k}` as const)}</span>
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function MomentumCard({ theme, payload, size, index }: CommonProps & { payload: MomentumPayload }) {
  const m = METRICS[size];

  if (payload.unavailable || payload.samples.length < 2) {
    return (
      <Frame theme={theme} type="Momentum" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            No momentum data
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            Not available for this match.
          </div>
        </div>
      </Frame>
    );
  }

  const samples = payload.samples;
  const maxMinute = Math.max(90, ...samples.map((s) => s.minute));
  // Compress the raw samples into a fixed-width bar chart. One bar per
  // (maxMinute / bars) minute chunk, averaged.
  const bars = size === "xs" ? 20 : size === "sm" ? 30 : 45;
  const bucketSize = maxMinute / bars;

  const buckets: Array<{ value: number; minute: number }> = [];
  for (let i = 0; i < bars; i++) {
    const startMinute = i * bucketSize;
    const endMinute = startMinute + bucketSize;
    const inBucket: typeof samples = samples.filter((s) => s.minute >= startMinute && s.minute < endMinute);
    if (inBucket.length === 0) {
      buckets.push({ value: 0, minute: Math.round(startMinute) });
    } else {
      const avg = inBucket.reduce<number>((sum, s) => sum + s.value, 0) / inBucket.length;
      buckets.push({ value: avg, minute: Math.round(startMinute) });
    }
  }

  // SVG dimensions: width 100 units, height 40 units, mid-line at 20
  const W = 100;
  const H = 40;
  const mid = H / 2;
  const barW = W / bars - 0.4;
  const maxBarHeight = mid - 2;

  return (
    <Frame theme={theme} type="Momentum" subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full flex-col" style={{ gap: m.gap * 0.7 }}>
        {/* Header: short names + color dots */}
        <div className="flex items-center justify-between font-extrabold uppercase" style={{ fontSize: m.body * 0.85 }}>
          <span className="flex items-center gap-2">
            <span
              className="inline-block rounded-full"
              style={{ width: m.small * 0.8, height: m.small * 0.8, background: payload.home_color }}
            />
            <span style={{ color: payload.home_color }}>{payload.home_short}</span>
          </span>
          <span className="text-white/40" style={{ fontSize: m.small }}>Pressure</span>
          <span className="flex items-center gap-2">
            <span style={{ color: payload.away_color }}>{payload.away_short}</span>
            <span
              className="inline-block rounded-full"
              style={{ width: m.small * 0.8, height: m.small * 0.8, background: payload.away_color }}
            />
          </span>
        </div>

        {/* Chart */}
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
            {/* Center line — "balanced pressure" */}
            <line x1="0" y1={mid} x2={W} y2={mid} stroke="white" strokeOpacity="0.15" strokeWidth="0.2" />

            {buckets.map((b, i) => {
              const x = i * (W / bars) + 0.2;
              const h = Math.abs(b.value) * maxBarHeight;
              // Home pressure goes up (above mid), away goes down
              const y = b.value >= 0 ? mid - h : mid;
              const color = b.value >= 0 ? payload.home_color : payload.away_color;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={barW}
                  height={h || 0.3}
                  fill={color}
                  fillOpacity={0.85}
                >
                  <title>
                    {b.minute}&apos;
                    {b.value >= 0
                      ? ` · ${payload.home_short} +${b.value.toFixed(2)}`
                      : ` · ${payload.away_short} ${b.value.toFixed(2)}`}
                  </title>
                </rect>
              );
            })}
          </svg>

          {/* Minute scale */}
          <div className="mt-1 flex justify-between text-white/40" style={{ fontSize: m.small * 0.85 }}>
            <span>0&apos;</span>
            <span>HT</span>
            <span>{maxMinute}&apos;</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-white/55" style={{ fontSize: m.small * 0.85 }}>
          <span>↑ home pressing</span>
          <span>↓ away pressing</span>
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
    else {
      const home = mt.home_team ?? mt.home ?? "";
      const away = mt.away_team ?? mt.away ?? "";
      const w = a > b ? home : away;
      if (w) wins[w] = (wins[w] ?? 0) + 1;
    }
  }
  return { wins, draws };
}

function H2HCard({ theme, payload, size, index, home, away }: CommonProps & { payload: H2HPayload }) {
  const m = METRICS[size];
  const { t, lang } = useI18n();
  const { wins, draws } = tally(payload.meetings);
  const names = Object.keys(wins);
  const showBar = names.length <= 2 && names.length + draws > 0;
  const colorFor = (n: string, fallback: string) =>
    (matchesTeam(n, home) ? home?.color : matchesTeam(n, away) ? away?.color : undefined) ?? fallback;
  const segs = [
    { label: names[0], value: wins[names[0]] ?? 0, color: colorFor(names[0] ?? "", "#34d399") },
    { label: t("card.draws"), value: draws, color: "#71717a" },
    { label: names[1], value: wins[names[1]] ?? 0, color: colorFor(names[1] ?? "", "#38bdf8") },
  ].filter((s) => s.value > 0 && s.label);

  return (
    <Frame theme={theme} type={t("card.h2h")} size={size} index={index}>
      <div className="flex h-full flex-col" style={{ gap: m.gap * 0.7 }}>
        {showBar && size !== "sm" && (
          <div>
            <div className="flex h-4 overflow-hidden rounded-full bg-white/10">
              {segs.map((s, i) => <div key={i} style={{ flex: s.value, background: s.color }} />)}
            </div>
            <div className="mt-2 flex justify-between font-semibold text-white/85" style={{ fontSize: m.small }}>
              {segs.map((s, i) => <span key={i}>{localTeamName(s.label, lang)} · <span className="tabular-nums">{s.value}</span></span>)}
            </div>
          </div>
        )}
        <ul className="min-h-0 flex-1 overflow-hidden">
          {payload.meetings.slice(0, m.rows.h2h).map((mt, i) => {
            const homeName = mt.home_team ?? mt.home ?? "";
            const awayName = mt.away_team ?? mt.away ?? "";
            return (
              <li key={i} className="grid items-center border-b border-white/5" style={{ gridTemplateColumns: `${m.small * 5}px minmax(0,1fr) auto`, height: m.row, gap: m.gap * 0.6, fontSize: m.body * 0.8 }}>
                <span className="tabular-nums text-white/45" style={{ fontSize: m.small * 0.9 }}>{mt.date}</span>
                <span className="truncate text-white/90">{localTeamName(homeName, lang)} <span className="text-white/35">—</span> {localTeamName(awayName, lang)}</span>
                <span className="font-extrabold tabular-nums text-white">{mt.score}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Frame>
  );
}

function ScorersCard({
  theme, payload, size, index, metric = "goals",
}: CommonProps & { payload: TopScorersPayload | TopAssistsPayload; metric?: "goals" | "assists" }) {
  const m = METRICS[size];
  const players = payload.players.slice(0, m.rows.scorers);
  const values = players.map((p) =>
    "assists" in p ? p.assists : (p as TopScorersPayload["players"][0]).goals,
  );
  const max = Math.max(1, ...values);

  return (
    <Frame
      theme={theme}
      type={metric === "assists" ? "Top assists" : "Top scorers"}
      subtitle={payload.competition}
      size={size}
      index={index}
    >
      <ul className="flex h-full flex-col justify-start overflow-hidden">
        {players.map((p, i) => {
          const value = "assists" in p ? p.assists : (p as TopScorersPayload["players"][0]).goals;
          return (
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
                    {p.name}{" "}
                    <span className="font-medium text-white/45" style={{ fontSize: m.small * 0.9 }}>
                      {p.team}
                    </span>
                  </span>
                  <span className="font-black tabular-nums text-white" style={{ fontSize: m.body * 1.1 }}>
                    {value}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(value / max) * 100}%`,
                      background: `linear-gradient(90deg, ${theme.secondary}, ${theme.accent})`,
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

function BestXICard({ theme, payload, size, index }: CommonProps & { payload: BestXIPayload }) {
  const m = METRICS[size];

  if (payload.unavailable || payload.players.length === 0) {
    return (
      <Frame theme={theme} type="Team of the Season" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            No best XI available
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            Bzzoiro hasn't rated this league's eleven for the season yet.
          </div>
        </div>
      </Frame>
    );
  }

  // Pitch viewBox: 100 wide × 140 tall — vertical pitch, attack toward the top.
  // Players' x/y come as 0..100. The pitch is drawn with the goal at the top
  // (y=0) and the halfway line at the bottom (y=140), so we invert y.
  const W = 100;
  const H = 140;

  // Group by their position — if we have "GK", "DF", "MF", "FW" tags,
  // render them in bands. If not, just place them by raw coordinates.
  const hasRoleTags = payload.players.some((p) => /GK|DF|MF|FW/i.test(p.position));

  return (
    <Frame
      theme={theme}
      type="Team of the Season"
      subtitle={`${payload.competition} · ${payload.formation}`}
      size={size}
      index={index}
    >
      <div className="flex h-full gap-3">
        {/* Left: pitch with player dots */}
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
          >
            {/* Pitch */}
            <rect x="0" y="0" width={W} height={H} fill="#0d2818" rx="1" />

            {/* Halfway line */}
            <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="white" strokeOpacity="0.2" strokeWidth="0.3" />

            {/* Center circle */}
            <circle cx={W / 2} cy={H / 2} r={W * 0.14} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.3" />

            {/* Goal box (top — attacking half) */}
            <rect x={W * 0.2} y="0" width={W * 0.6} height={H * 0.11} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.3" />
            <rect x={W * 0.35} y="0" width={W * 0.3} height={H * 0.045} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.3" />

            {/* Goal box (bottom — defensive half) */}
            <rect x={W * 0.2} y={H - H * 0.11} width={W * 0.6} height={H * 0.11} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.3" />
            <rect x={W * 0.35} y={H - H * 0.045} width={W * 0.3} height={H * 0.045} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.3" />

            {/* Players */}
            {payload.players.map((p, i) => {
              // If Bzzoiro provides x/y with attack toward y=0, invert for display.
              // Common Bzzoiro convention: x = across the pitch (0..100 left-right),
              // y = depth (0 = opponent goal, 100 = own goal). We render from own
              // goal at bottom to opponent goal at top.
              const cx = p.x;
              const cy = H - (p.y / 100) * H;

              return (
                <g key={i}>
                  {/* Jersey dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={W * 0.06}
                    fill={theme.primary}
                    stroke={theme.accent}
                    strokeWidth="0.4"
                  />
                  {/* Rating bubble (top-right) */}
                  {p.rating != null && size !== "xs" && size !== "sm" && (
                    <>
                      <circle
                        cx={cx + W * 0.055}
                        cy={cy - W * 0.055}
                        r={W * 0.038}
                        fill={theme.accent}
                      />
                      <text
                        x={cx + W * 0.055}
                        y={cy - W * 0.055}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={W * 0.045}
                        fontWeight="900"
                        fill="#0a101c"
                      >
                        {typeof p.rating === "number" ? p.rating.toFixed(1) : String(p.rating)}
                      </text>
                    </>
                  )}
                  {/* Player name */}
                  <text
                    x={cx}
                    y={cy + W * 0.16}
                    textAnchor="middle"
                    fontSize={W * 0.055}
                    fontWeight="700"
                    fill="white"
                  >
                    {p.name.split(" ").slice(-1)[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right: roster list (only on larger sizes) */}
        {(size === "xl" || size === "lg") && (
          <div className="flex w-[38%] flex-col gap-1 overflow-hidden" style={{ fontSize: m.small * 0.9 }}>
            {payload.players.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 border-b border-white/5 py-1"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{p.name}</div>
                  <div className="truncate text-white/50" style={{ fontSize: m.small * 0.8 }}>
                    {p.team} · {p.position}
                  </div>
                </div>
                {p.rating != null && (
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 font-black tabular-nums"
                    style={{
                      background: theme.accent,
                      color: "#0a101c",
                      fontSize: m.small * 0.85,
                    }}
                  >
                    {typeof p.rating === "number" ? p.rating.toFixed(1) : p.rating}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>
  );
}

function PlayerStatsCard({ theme, payload, size, index }: CommonProps & { payload: PlayerStatsPayload }) {
  const m = METRICS[size];

  if (payload.unavailable || payload.players.length === 0) {
    return (
      <Frame theme={theme} type="Player ratings" size={size} index={index}>
        <div className="flex h-full items-center justify-center text-white/50" style={{ fontSize: m.body }}>
          No player stats available
        </div>
      </Frame>
    );
  }

  const ratingColor = (rating: number | string | null): string => {
    if (rating == null) return "#71717a";
    const n = typeof rating === "number" ? rating : parseFloat(rating);
    if (Number.isNaN(n)) return "#71717a";
    if (n >= 8.0) return "#34d399";
    if (n >= 7.0) return "#38bdf8";
    if (n >= 6.0) return "#fbbf24";
    return "#f87171";
  };

  // Split players into two columns
  const homePlayers = payload.players.filter(p => p.team === "home");
  const awayPlayers = payload.players.filter(p => p.team === "away");

  // Dynamic row height: fit up to 11 players comfortably
  const maxRows = Math.max(homePlayers.length, awayPlayers.length, 1);
  const rowHeight = Math.min(m.row, 420 / maxRows);

  const renderColumn = (players: typeof payload.players, teamColor: string, teamName: string) => (
    <div className="flex flex-1 flex-col min-w-0">
      <div className="mb-1 flex items-center gap-1.5 border-b border-white/10 pb-1 font-extrabold uppercase" style={{ fontSize: m.small * 0.9 }}>
        <span className="inline-block rounded-full" style={{ width: m.small * 0.6, height: m.small * 0.6, background: teamColor }} />
        <span className="truncate" style={{ color: teamColor }}>{teamName}</span>
      </div>
      
      <ul className="flex-1">
        {players.map((p, i) => {
          const rating = p.rating != null ? (typeof p.rating === "number" ? p.rating : parseFloat(p.rating)) : null;
          return (
            <li key={p.player_id ?? i} className="flex items-center gap-1.5 border-b border-white/5 py-0.5" style={{ height: rowHeight }}>
              <span
                className="flex shrink-0 items-center justify-center rounded font-black tabular-nums text-black"
                style={{
                  width: rowHeight * 0.9,
                  height: rowHeight * 0.9,
                  fontSize: rowHeight * 0.5,
                  background: ratingColor(p.rating),
                }}
              >
                {rating != null && !Number.isNaN(rating) ? rating.toFixed(1) : "—"}
              </span>
              <div className="min-w-0 flex-1 truncate font-bold text-white" style={{ fontSize: m.body * 0.7 }}>
                {p.name}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Frame theme={theme} type="Player ratings" subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full gap-4 overflow-hidden">
        {renderColumn(homePlayers, payload.home_color, (payload as { home_short?: string }).home_short ?? "Home")}
        <div className="w-px bg-white/10 shrink-0" />
        {renderColumn(awayPlayers, payload.away_color, (payload as { away_short?: string }).away_short ?? "Away")}
      </div>
    </Frame>
  );
}

const PLATFORM_ICON: Record<string, string> = {
  tv: "📺",
  streaming: "💻",
  radio: "📻",
};

function BroadcastsCard({ theme, payload, size, index }: CommonProps & { payload: BroadcastsPayload }) {
  const m = METRICS[size];

  if (payload.unavailable || Object.keys(payload.by_country).length === 0) {
    return (
      <Frame theme={theme} type="Where to watch" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            No broadcast info
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            TV listings aren&apos;t available for this fixture yet.
          </div>
        </div>
      </Frame>
    );
  }

  // 1. Prioritize Major Markets + Alphabetical for the rest
  const PRIORITY_COUNTRIES = ["GB", "US", "FR", "DE", "ES", "IT", "NL", "PT", "BR", "AR", "MX", "AU"];
  
  const allCountries = Object.values(payload.by_country).sort((a, b) => {
    const aIdx = PRIORITY_COUNTRIES.indexOf(a.country_code);
    const bIdx = PRIORITY_COUNTRIES.indexOf(b.country_code);
    
    // If both are in the priority list, sort by their order in the list
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    // Priority countries always come first
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    // Otherwise sort alphabetically by country name
    return (a.country_name || "").localeCompare(b.country_name || "");
  });

  // 2. Show more countries since the layout is compact
  const maxCountries =
    size === "xs" ? 2 :
    size === "sm" ? 4 :
    size === "md" ? 6 :
    8;

  const countries = allCountries.slice(0, maxCountries);
  const remaining = allCountries.length - countries.length;

  return (
    <Frame
      theme={theme}
      type="Where to watch"
      subtitle={payload.competition}
      size={size}
      index={index}
      glow={[payload.home_color, payload.away_color]}
    >
      <div className="flex h-full flex-col">
        {/* Match header — use full names instead of shorts */}
        <div
          className="mb-2 flex items-center justify-between border-b border-white/10 pb-2 font-extrabold"
          style={{ fontSize: m.body * 0.75 }}
        >
          <span className="truncate max-w-[35%]" style={{ color: payload.home_color }}>
            {payload.home_name}
          </span>
          <span className="text-white/50 text-center shrink-0 px-2" style={{ fontSize: m.small * 0.9 }}>
            {payload.kickoff_label || "TBD"}
          </span>
          <span className="truncate max-w-[35%] text-right" style={{ color: payload.away_color }}>
            {payload.away_name}
          </span>
        </div>

        {/* Country groups - Compact grid layout */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1 overflow-hidden content-start">
          {countries.map((country) => (
            <div key={country.country_code} className="flex flex-col min-w-0">
              <div
                className="mb-0.5 flex items-center gap-1.5 font-bold uppercase tracking-wider"
                style={{ fontSize: m.small * 0.8, color: theme.accent }}
              >
                <span>{country.country_code}</span>
                <span className="text-white/50 font-medium normal-case truncate">
                  {country.country_name}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {country.channels.slice(0, 2).map((ch, i) => (
                  <span
                    key={i}
                    className="rounded px-1.5 py-0.5 font-medium text-white truncate max-w-full"
                    style={{
                      fontSize: m.small * 0.75,
                      background: alpha(theme.accent, 0.15),
                    }}
                  >
                    {ch.name}
                  </span>
                ))}
                {country.channels.length > 2 && (
                  <span
                    className="rounded px-1.5 py-0.5 text-white/40"
                    style={{ fontSize: m.small * 0.75 }}
                  >
                    +{country.channels.length - 2}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: total count */}
        {remaining > 0 && (
          <div
            className="mt-2 border-t border-white/10 pt-1 text-right text-white/40"
            style={{ fontSize: m.small * 0.8 }}
          >
            +{remaining} more countries
          </div>
        )}
      </div>
    </Frame>
  );
}

function OddBox({ 
  label, value, m, theme, accent 
}: { 
  label: string; value?: number; m: Metrics; theme: LeagueTheme; accent?: boolean 
}) {
  if (value == null) return null;
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center rounded bg-white/5 py-1.5"
      style={{ border: accent ? `1px solid ${theme.accent}` : "1px solid transparent" }}
    >
      <span className="text-white/50 uppercase" style={{ fontSize: m.small * 0.75 }}>{label}</span>
      <span className="font-bold tabular-nums text-white" style={{ fontSize: m.body * 0.9 }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function XGRaceCard({ theme, payload, size, index }: CommonProps & { payload: XGRacePayload }) {
  const m = METRICS[size];

  if (payload.unavailable || payload.samples.length < 2) {
    return (
      <Frame theme={theme} type="xG race" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            No xG data
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            xG curve isn&apos;t available for this match yet.
          </div>
        </div>
      </Frame>
    );
  }

  const samples = payload.samples;
  const maxMinute = Math.max(90, ...samples.map((s) => s.minute));
  const maxXG = Math.max(
    1,
    ...samples.map((s) => Math.max(s.home, s.away)),
    payload.home_xg_final ?? 0,
    payload.away_xg_final ?? 0,
  );

  // SVG dimensions
  const W = 100;
  const H = 40;
  const padL = 2;
  const padR = 2;
  const padT = 2;
  const padB = 2;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xOf = (minute: number) => padL + (minute / maxMinute) * plotW;
  const yOf = (xg: number) => padT + plotH - (xg / maxXG) * plotH;

  // Build SVG polyline paths
  const buildPath = (side: "home" | "away") => {
    // Start at 0 xG at minute 0 so the line begins at the bottom-left
    const points = [{ minute: 0, xg: 0 }, ...samples.map((s) => ({ minute: s.minute, xg: s[side] }))];
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.minute).toFixed(2)},${yOf(p.xg).toFixed(2)}`)
      .join(" ");
  };

  // Check if any sample is estimated (for the disclaimer badge)
  const hasEstimated = samples.some((s) => s.estimated);

  // Gridlines at 25%, 50%, 75% of max xG
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <Frame theme={theme} type="xG race" subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full flex-col" style={{ gap: m.gap * 0.6 }}>
        {/* Header with final xG values */}
        <div className="flex items-center justify-between font-extrabold uppercase" style={{ fontSize: m.body * 0.85 }}>
          <span className="flex items-center gap-2">
            <span
              className="inline-block rounded-full"
              style={{ width: m.small * 0.7, height: m.small * 0.7, background: payload.home_color }}
            />
            <span style={{ color: payload.home_color }}>{payload.home_short}</span>
            {payload.home_xg_final != null && (
              <span className="text-white/80 tabular-nums">
                {payload.home_xg_final.toFixed(2)}
              </span>
            )}
          </span>
          <span className="text-white/40" style={{ fontSize: m.small * 0.85 }}>
            xG
          </span>
          <span className="flex items-center gap-2">
            {payload.away_xg_final != null && (
              <span className="text-white/80 tabular-nums">
                {payload.away_xg_final.toFixed(2)}
              </span>
            )}
            <span style={{ color: payload.away_color }}>{payload.away_short}</span>
            <span
              className="inline-block rounded-full"
              style={{ width: m.small * 0.7, height: m.small * 0.7, background: payload.away_color }}
            />
          </span>
        </div>

        {/* The chart */}
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
            {/* Horizontal gridlines */}
            {gridLevels.map((level) => (
              <line
                key={level}
                x1={padL}
                y1={yOf(maxXG * level)}
                x2={W - padR}
                y2={yOf(maxXG * level)}
                stroke="white"
                strokeOpacity={level === 1 ? 0.2 : 0.08}
                strokeWidth="0.15"
                strokeDasharray={level === 1 ? "0" : "0.5 0.5"}
              />
            ))}

            {/* Half-time marker */}
            <line
              x1={xOf(45)}
              y1={padT}
              x2={xOf(45)}
              y2={H - padB}
              stroke="white"
              strokeOpacity="0.15"
              strokeWidth="0.2"
              strokeDasharray="0.4 0.4"
            />

            {/* Home xG curve */}
            <path
              d={buildPath("home")}
              fill="none"
              stroke={payload.home_color}
              strokeWidth="0.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Away xG curve */}
            <path
              d={buildPath("away")}
              fill="none"
              stroke={payload.away_color}
              strokeWidth="0.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* End-of-line dots */}
            {samples.length > 0 && (
              <>
                <circle
                  cx={xOf(samples[samples.length - 1].minute)}
                  cy={yOf(samples[samples.length - 1].home)}
                  r="0.7"
                  fill={payload.home_color}
                />
                <circle
                  cx={xOf(samples[samples.length - 1].minute)}
                  cy={yOf(samples[samples.length - 1].away)}
                  r="0.7"
                  fill={payload.away_color}
                />
              </>
            )}
          </svg>

          {/* Minute axis labels */}
          <div
            className="mt-1 flex justify-between text-white/40"
            style={{ fontSize: m.small * 0.8 }}
          >
            <span>0&apos;</span>
            <span>45&apos;</span>
            <span>{maxMinute}&apos;</span>
          </div>
        </div>

        {/* Footer with estimated flag if applicable */}
        <div className="flex items-center justify-between text-white/35" style={{ fontSize: m.small * 0.75 }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: payload.home_color }} />
            {payload.home_short}
            <span className="inline-block h-0.5 w-4 ml-2" style={{ background: payload.away_color }} />
            {payload.away_short}
          </span>
          {hasEstimated && <span className="italic">Includes estimated xG</span>}
        </div>
      </div>
    </Frame>
  );
}

function MatchStatsCard({ theme, payload, size, index }: CommonProps & { payload: MatchStatsPayload }) {
  const m = METRICS[size];

  if (payload.unavailable || payload.stats.length === 0) {
    return (
      <Frame theme={theme} type="Match stats" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            No stats
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            Match statistics aren&apos;t available yet.
          </div>
        </div>
      </Frame>
    );
  }

  const formatValue = (v: number, fmt: StatRow["format"]): string => {
    if (fmt === "percent") return `${Math.round(v)}%`;
    if (fmt === "decimal") return v.toFixed(2);
    return String(Math.round(v));
  };

  // How many rows to show depending on card size
  const maxRows =
    size === "xs" ? 3 :
    size === "sm" ? 4 :
    size === "md" ? 6 :
    8;

  const visible = payload.stats.slice(0, maxRows);

  return (
    <Frame theme={theme} type="Match stats" subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full flex-col" style={{ gap: m.gap * 0.7 }}>
        {/* Team header */}
        <div
          className="flex items-center justify-between border-b border-white/10 pb-2 font-extrabold uppercase"
          style={{ fontSize: m.body * 0.85 }}
        >
          <span className="truncate max-w-[40%]" style={{ color: payload.home_color }}>
            {payload.home_short}
          </span>
          <span className="shrink-0 text-white/40" style={{ fontSize: m.body * 0.6 }}>
            {formatMatchPhase(undefined)}
          </span>
          <span className="truncate max-w-[40%] text-right" style={{ color: payload.away_color }}>
            {payload.away_short}
          </span>
        </div>

        {/* Stat rows */}
        <div className="flex min-h-0 flex-1 flex-col justify-start overflow-hidden" style={{ gap: m.gap * 0.5 }}>
          {visible.map((row) => {
            const total = row.home + row.away || 1;
            const homePct = (row.home / total) * 100;
            const awayPct = 100 - homePct;

            // Colour: green if the higher value belongs to a "good" stat
            const homeWins = row.higher_is_better === true && row.home > row.away;
            const awayWins = row.higher_is_better === true && row.away > row.home;
            const homeColor = homeWins ? "#34d399" : "#ffffff";
            const awayColor = awayWins ? "#34d399" : "#ffffff";

            return (
              <div key={row.key} className="flex flex-col" style={{ gap: 2 }}>
                {/* Values + label */}
                <div
                  className="flex items-baseline justify-between"
                  style={{ fontSize: m.body * 0.8 }}
                >
                  <span
                    className="font-black tabular-nums"
                    style={{ color: homeColor, fontSize: m.body * 0.95 }}
                  >
                    {formatValue(row.home, row.format)}
                  </span>
                  <span
                    className="font-semibold uppercase text-white/55"
                    style={{ fontSize: m.small * 0.85, letterSpacing: "0.1em" }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="font-black tabular-nums"
                    style={{ color: awayColor, fontSize: m.body * 0.95 }}
                  >
                    {formatValue(row.away, row.format)}
                  </span>
                </div>

                {/* Comparison bar */}
                <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    style={{
                      width: `${homePct}%`,
                      background: payload.home_color,
                      opacity: homeWins ? 0.95 : 0.7,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      background: payload.away_color,
                      opacity: awayWins ? 0.95 : 0.7,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-auto flex justify-between text-white/30" style={{ fontSize: m.small * 0.75 }}>
          <span>Stats via Bzzoiro</span>
          <span>{payload.stats.length} metrics</span>
        </div>
      </div>
    </Frame>
  );
}

// Helper — returns a text label for the current phase (nice to have)
function formatMatchPhase(_phase: string | undefined): string {
  return "Match stats";
}

function OddsBoardCard({ theme, payload, size, index }: CommonProps & { payload: OddsBoardPayload }) {
  const m = METRICS[size];

  if (payload.unavailable) {
    return (
      <Frame theme={theme} type="Betting odds" size={size} index={index}>
        <div className="flex h-full items-center justify-center text-white/50" style={{ fontSize: m.body }}>
          No odds available
        </div>
      </Frame>
    );
  }

  const { markets } = payload;

  return (
    <Frame theme={theme} type="Betting odds" subtitle={payload.competition} size={size} index={index}>
      <div className="flex h-full flex-col gap-3">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-extrabold uppercase" style={{ fontSize: m.body * 0.75 }}>
          <span style={{ color: payload.home_color }}>{payload.home_short}</span>
          <span className="text-white/40">Consensus</span>
          <span style={{ color: payload.away_color }}>{payload.away_short}</span>
        </div>

        {/* 1X2 */}
        {markets["1x2"] && (
          <div className="flex gap-2">
            <OddBox label="Home" value={markets["1x2"].home} m={m} theme={theme} />
            <OddBox label="Draw" value={markets["1x2"].draw} m={m} theme={theme} />
            <OddBox label="Away" value={markets["1x2"].away} m={m} theme={theme} />
          </div>
        )}

        {/* Double Chance & BTTS */}
        <div className="flex gap-4">
          {markets.double_chance && (
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-white/40 uppercase" style={{ fontSize: m.small * 0.75 }}>Double Chance</span>
              <div className="flex gap-1">
                <OddBox label="1X" value={markets.double_chance["1X"]} m={m} theme={theme} />
                <OddBox label="12" value={markets.double_chance["12"]} m={m} theme={theme} />
                <OddBox label="X2" value={markets.double_chance["X2"]} m={m} theme={theme} />
              </div>
            </div>
          )}
          
          {markets.btts && (
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-white/40 uppercase" style={{ fontSize: m.small * 0.75 }}>BTTS</span>
              <div className="flex gap-1">
                <OddBox label="Yes" value={markets.btts.yes} m={m} theme={theme} />
                <OddBox label="No" value={markets.btts.no} m={m} theme={theme} />
              </div>
            </div>
          )}
        </div>

        {/* Totals */}
        {markets.totals && (
          <div className="flex flex-col gap-1">
             <span className="text-white/40 uppercase" style={{ fontSize: m.small * 0.75 }}>Total Goals (Over / Under)</span>
             <div className="flex flex-wrap gap-2">
               {Object.entries(markets.totals).map(([line, mkt]) => (
                 <div key={line} className="flex flex-1 items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1">
                   <span className="font-bold text-white/80" style={{ fontSize: m.small }}>{line}</span>
                   <span className="ml-auto tabular-nums text-emerald-400" style={{ fontSize: m.small }}>{mkt.over?.toFixed(2)}</span>
                   <span className="text-white/30" style={{ fontSize: m.small }}>/</span>
                   <span className="tabular-nums text-rose-400" style={{ fontSize: m.small }}>{mkt.under?.toFixed(2)}</span>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex justify-between text-white/30" style={{ fontSize: m.small * 0.75 }}>
          <span>Decimal odds</span>
          <span>Pre-match only</span>
        </div>
      </div>
    </Frame>
  );
}

function AveragePositionsCard({ theme, payload, size, index }: CommonProps & { payload: AveragePositionsPayload }) {
  const m = METRICS[size];

  if (payload.unavailable || (payload.home_positions.length === 0 && payload.away_positions.length === 0)) {
    return (
      <Frame theme={theme} type="Average positions" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            No position data
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            Bzzoiro hasn&apos;t published per-player positions for this match yet.
          </div>
        </div>
      </Frame>
    );
  }

  // --- Player dot rendering ---
  // We show a full pitch (horizontal). Home team on left half (attacking right),
  // away team on right half (attacking left).
  //
  // Bzzoiro's x/y are 0..100 in the SHOOTING team's attacking direction:
  //   x=0 is own goal, x=100 is opponent goal
  //   y=0 is one touchline, y=100 is the other
  // So home team's x=50 is halfway, x=90 is deep in the opponent's half.
  // For display, home team goes on the left half of our 0..100 pitch:
  //   display_x = x * 0.5  (0..50)
  // Away team mirrors on the right half:
  //   display_x = 100 - x * 0.5  (50..100)

  const W = 100;
  const H = 64;

  // Convert a position to display coordinates
  const homePos = (p: AveragePosition) => ({
    x: p.x * 0.5,
    y: p.y * 0.64,  // scale to SVG height (0..64)
  });

  const awayPos = (p: AveragePosition) => ({
    x: 100 - p.x * 0.5,
    y: p.y * 0.64,
  });

  // Dot radius scales with involvement (n touches)
  const maxN = Math.max(
    1,
    ...payload.home_positions.map((p) => p.n),
    ...payload.away_positions.map((p) => p.n),
  );
  const radius = (n: number) => {
    const minR = 1.2;
    const maxR = 2.6;
    const t = maxN > 0 ? n / maxN : 0;
    return minR + (maxR - minR) * t;
  };

  return (
    <Frame
      theme={theme}
      type="Average positions"
      subtitle={payload.competition}
      size={size}
      index={index}
    >
      <div className="flex h-full flex-col" style={{ gap: m.gap * 0.6 }}>
        {/* Team header */}
        <div
          className="flex items-center justify-between font-extrabold uppercase"
          style={{ fontSize: m.body * 0.85 }}
        >
          <span className="flex items-center gap-2">
            <span
              className="inline-block rounded-full"
              style={{ width: m.small * 0.7, height: m.small * 0.7, background: payload.home_color }}
            />
            <span style={{ color: payload.home_color }}>{payload.home_short}</span>
          </span>
          <span className="text-white/45" style={{ fontSize: m.small * 0.85 }}>
            Avg. touch positions
          </span>
          <span className="flex items-center gap-2">
            <span style={{ color: payload.away_color }}>{payload.away_short}</span>
            <span
              className="inline-block rounded-full"
              style={{ width: m.small * 0.7, height: m.small * 0.7, background: payload.away_color }}
            />
          </span>
        </div>

        {/* Pitch */}
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
            {/* Pitch background */}
            <rect x="0" y="0" width={W} height={H} fill="var(--ov-pitch)" rx="0.5" />

            {/* Markings */}
            <line x1={W / 2} y1="0" x2={W / 2} y2={H} stroke="white" strokeOpacity="0.2" strokeWidth="0.15" />
            <circle cx={W / 2} cy={H / 2} r={H * 0.12} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.15" />
            <rect x="0" y={H * 0.2} width={W * 0.13} height={H * 0.6} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.15" />
            <rect x={W - W * 0.13} y={H * 0.2} width={W * 0.13} height={H * 0.6} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.15" />

            {/* Home team players */}
            {payload.home_positions.map((p, i) => {
              const pos = homePos(p);
              const r = radius(p.n);
              return (
                <g key={`h-${i}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={payload.home_color}
                    fillOpacity={0.85}
                    stroke="white"
                    strokeWidth="0.15"
                    strokeOpacity={0.6}
                  >
                    <title>{p.name} · {p.n} touches</title>
                  </circle>
                  {size !== "xs" && size !== "sm" && (
                    <text
                      x={pos.x}
                      y={pos.y - r - 0.8}
                      textAnchor="middle"
                      fontSize="1.5"
                      fontWeight="700"
                      fill="white"
                      fillOpacity={0.85}
                    >
                      {p.name.split(" ").slice(-1)[0]}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Away team players */}
            {payload.away_positions.map((p, i) => {
              const pos = awayPos(p);
              const r = radius(p.n);
              return (
                <g key={`a-${i}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={payload.away_color}
                    fillOpacity={0.85}
                    stroke="white"
                    strokeWidth="0.15"
                    strokeOpacity={0.6}
                  >
                    <title>{p.name} · {p.n} touches</title>
                  </circle>
                  {size !== "xs" && size !== "sm" && (
                    <text
                      x={pos.x}
                      y={pos.y - r - 0.8}
                      textAnchor="middle"
                      fontSize="1.5"
                      fontWeight="700"
                      fill="white"
                      fillOpacity={0.85}
                    >
                      {p.name.split(" ").slice(-1)[0]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-white/35" style={{ fontSize: m.small * 0.8 }}>
          <span>Dot size = involvement</span>
          <span>n = touches sampled</span>
        </div>
      </div>
    </Frame>
  );
}

function CustomCard({ theme, title, payload, size, index }: CommonProps & { title: string; payload: Record<string, unknown> }) {
  const m = METRICS[size];
  const { t } = useI18n();
  const entries = Object.entries(payload ?? {})
    .filter(([k]) => k !== "zone")
    .slice(0, size === "xs" ? 4 : size === "sm" ? 5 : 8);
  return (
    <Frame theme={theme} type={title || t("card.info")} size={size} index={index}>
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