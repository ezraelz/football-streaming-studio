"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { EditorialCard, MomentumPayload, PredictionPayload } from "@/lib/api/client";
import { TeamCrest } from "@/components/overlay/crest";
import { LeagueBadge } from "@/components/overlay/league-badge";
import { useOverlayEnv } from "@/components/overlay/env";
import { useI18n } from "@/lib/i18n";
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
      className="ov-card-in absolute flex overflow-hidden border border-white/10 backdrop-blur-xl"
      style={{ left: 0, top: H - TICKER_H, width: W, height: TICKER_H, borderRadius: 20, background: "var(--ov-surface)", boxShadow: "var(--ov-shadow)", ["--ov-delay" as string]: `${index * 140}ms` } as CSSProperties}
    >
      <div
        className="relative flex shrink-0 items-center gap-4 pl-6 pr-8"
        style={{ background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` }}
      >
        {theme.id !== "default" && <LeagueBadge theme={theme} size={44} />}
        <span className="font-black uppercase text-[#fff]" style={{ fontSize: 24, letterSpacing: "0.14em" }}>
          {tickerLabel(payload.label, t)}
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
      case "shot_map": return <ShotMapCard payload={p as unknown as ShotMapPayload} {...common} />;
      case "momentum": return <MomentumCard payload={p as unknown as MomentumPayload} {...common} />;
      case "best_xi": return <BestXICard payload={p as unknown as BestXIPayload} {...common} />;
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
  const { tone } = useOverlayEnv();
  const { lang } = useI18n();
  return (
    <section
      className="ov-card-in relative flex min-h-0 flex-col overflow-hidden border border-white/10 backdrop-blur-xl"
      style={{
        borderRadius: m.pad, background: "var(--ov-surface)", boxShadow: "var(--ov-shadow)",
        ["--ov-delay" as string]: `${index * 140}ms`,
      } as CSSProperties}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${alpha(theme.primary, tone === "dark" ? 0.6 : 0.14)} 0%, transparent 58%)` }}
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
            <span className="truncate font-medium text-white/65" style={{ fontSize: m.small }}>{competitionLabel(subtitle, lang)}</span>
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
          <span>Team</span>
          <span className="text-right">P</span>
          {showExtras && <span className="text-right">GD</span>}
          {showExtras && <span className="text-right">W-D-L</span>}
          <span className="text-right">Pts</span>
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
                  {r.team}
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

  if (payload.unavailable && !payload.preview && !payload.venue) {
    return (
      <Frame theme={theme} type="Preview" size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: m.gap }}>
          <div className="font-extrabold uppercase text-white/60" style={{ fontSize: m.body }}>
            No preview available
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            Match preview data isn&apos;t available for this fixture yet.
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
    metaBits.push(`Referee: ${payload.referee}`);
  }
  if (payload.attendance != null) {
    metaBits.push(`${payload.attendance.toLocaleString()} attendance`);
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

function PredictionCard({ theme, payload, size, index }: CommonProps & { payload: PredictionPayload }) {
  const m = METRICS[size];
  const { t, lang } = useI18n();
  const market = payload.markets?.["1x2"];

  if (!market) {
    return (
      <Frame theme={theme} type={t("card.prediction")} size={size} index={index}>
        <div className="flex h-full flex-col items-center justify-center text-center text-white/60" style={{ gap: m.gap }}>
          <div style={{ fontSize: m.body }}>
            {t("card.noPrediction")}
          </div>
          <div className="text-white/40" style={{ fontSize: m.small }}>
            {payload.reason || t("card.availableLater")}
          </div>
        </div>
      </Frame>
    );
  }

  const { home, draw, away } = market;
  const total = home + draw + away || 1;
  const pct = (v: number) => Math.round((v / total) * 100);

  return (
    <Frame
      theme={theme}
      type={t("card.prediction")}
      subtitle={payload.competition}
      size={size}
      index={index}
    >
      <div className="flex h-full flex-col" style={{ gap: m.gap }}>
        {/* Header row: team names */}
        <div className="flex items-center justify-between font-extrabold uppercase text-white" style={{ fontSize: m.body * 0.85, letterSpacing: "0.05em" }}>
          <span className="truncate">{localTeamName(payload.home_name, lang)}</span>
          <span className="text-white/40">{t("common.vs")}</span>
          <span className="truncate text-right">{localTeamName(payload.away_name, lang)}</span>
        </div>

        {/* Probability bar */}
        <div className="flex h-14 overflow-hidden rounded-2xl bg-white/10" style={{ fontSize: m.body }}>
          <div
            className="flex items-center justify-center font-black text-[#fff]"
            style={{ width: `${pct(home)}%`, background: themeGradient(theme) }}
          >
            {pct(home)}%
          </div>
          <div
            className="flex items-center justify-center font-black text-[#fff]/85"
            style={{ width: `${pct(draw)}%`, background: "rgba(161,161,170,0.7)" }}
          >
            {pct(draw)}%
          </div>
          <div
            className="flex items-center justify-center font-black text-[#fff]"
            style={{ width: `${pct(away)}%`, background: alpha(theme.accent, 0.85) }}
          >
            {pct(away)}%
          </div>
        </div>

        {/* Labels under the bar */}
        <div className="flex justify-between font-semibold text-white/70" style={{ fontSize: m.small }}>
          <span>{t("card.home")}</span>
          <span>{t("card.draw")}</span>
          <span>{t("card.away")}</span>
        </div>

        {/* Secondary markets: O/U 2.5 + BTTS */}
        {(payload.markets.over_under_25 || payload.markets.btts) && size !== "sm" && size !== "xs" && (
          <div className="grid grid-cols-2 gap-x-8 border-t border-white/10 pt-3" style={{ fontSize: m.small }}>
            {payload.markets.over_under_25 && (
              <div>
                <div className="text-white/45 uppercase" style={{ letterSpacing: "0.15em", fontSize: m.small * 0.85 }}>{t("card.goals25")}</div>
                <div className="mt-1 flex justify-between text-white/85">
                  <span>{t("card.over")} · <span className="tabular-nums font-bold">{pct(payload.markets.over_under_25.over ?? 0)}%</span></span>
                  <span>{t("card.under")} · <span className="tabular-nums font-bold">{pct(payload.markets.over_under_25.under ?? 0)}%</span></span>
                </div>
              </div>
            )}
            {payload.markets.btts && (
              <div>
                <div className="text-white/45 uppercase" style={{ letterSpacing: "0.15em", fontSize: m.small * 0.85 }}>{t("card.btts")}</div>
                <div className="mt-1 flex justify-between text-white/85">
                  <span>{t("card.yes")} · <span className="tabular-nums font-bold">{pct(payload.markets.btts.yes ?? 0)}%</span></span>
                  <span>{t("card.no")} · <span className="tabular-nums font-bold">{pct(payload.markets.btts.no ?? 0)}%</span></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer: model version + "estimates only" */}
        <div className="mt-auto flex items-center justify-between text-white/40" style={{ fontSize: m.small * 0.85 }}>
          <span>
            {payload.model_version === "poisson-v1"
              ? "Statistical model"
              : payload.model_version === "market-consensus"
              ? "Market consensus"
              : payload.model_version ?? "Model probabilities"}
          </span>
          <span className="italic">{t("card.estimates")}</span>
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