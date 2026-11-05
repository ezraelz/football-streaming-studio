"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BarChart3, ChevronLeft, ChevronRight, Clock, Crosshair, EyeOff, Flag, Layers, LineChart, ListOrdered,
  Map as MapIcon, Newspaper, Percent, Play, Plus, Shield, Star, Swords, Target, Timer, Trash2, TrendingUp, Trophy, Tv, UserRound,
  Users, ClipboardList, HandHelping, History, type LucideIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useSocket } from "@/lib/hooks/use-socket";
import { rundownItems, effectiveZone, useRundown, type BuiltInKey } from "@/lib/stores/rundown-store";
import { useShowStore } from "@/lib/stores/show-store";
import { formatPref } from "@/lib/prefs";
import { ZONES, type Zone } from "@/lib/overlay/zones";
import type { EditorialCard } from "@/lib/api/client";
import { Button, focusRing } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { cn } from "@/lib/utility/utils";
import { useT, type MsgKey } from "@/lib/i18n";
import { EditorialPanel } from "./editorial-panel";

const ICONS: Record<string, LucideIcon> = {
  fixture_intro: Flag, match_preview: Newspaper, countdown: Timer, lineups: Users, standings: ListOrdered,
  form: TrendingUp, head_to_head: Swords, prediction: Target, odds_board: Percent, broadcasts: Tv,
  match_stats: BarChart3, shot_map: Crosshair, momentum: Activity, xg_race: LineChart, average_positions: MapIcon,
  match_summary: ClipboardList, player_stats: Star, top_scorers: Trophy, top_assists: HandHelping, best_xi: Shield,
};

const BUILT_INS: { key: BuiltInKey; label: MsgKey; icon: LucideIcon }[] = [
  { key: "timeline", label: "scene.timeline", icon: History },
  { key: "tactical", label: "scene.tactical", icon: Crosshair },
  { key: "player", label: "scene.player", icon: UserRound },
];

const isTyping = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  return !!n && (/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName) || n.isContentEditable);
};

/**
 * One list, one click. Every graphic for the show is a tile: click it (or press its number) to put it on
 * air; the card it replaces comes off automatically. NEXT / PREV walk the list, and the keyboard works
 * without touching the mouse, so you can talk and switch at the same time.
 */
export function Rundown() {
  const t = useT();
  const params = useParams<{ sessionId: string }>();
  const { cards, cue, loading, error, autoOn, autoSec, loop } = useRundown();
  const { load, refresh, take, hide, clear, next, prev, takeAt, takeBuiltIn, remove, move, setAuto, setError } = useRundown.getState();
  const activeScene = useShowStore((s) => s.activeScene);
  const [adding, setAdding] = useState(false);

  useEffect(() => { void load(params.sessionId); }, [load, params.sessionId]);
  useSocket<EditorialCard>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type === "editorial.update") void refresh();
  });

  const items = useMemo(() => rundownItems(cards), [cards]);
  const tickers = useMemo(() => cards.filter((c) => !items.includes(c)), [cards, items]);
  const onAir = items.filter((c) => c.visible);
  const builtInOn = BUILT_INS.find((b) => b.key === activeScene);

  // ── keyboard: ← → move, Space/Enter take, 1–9 direct, Esc clear ─────────────────────
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const st = useRundown.getState();
      if (e.key === "ArrowRight" || e.key === "n" || e.key === "N") { e.preventDefault(); void st.next(); }
      else if (e.key === "ArrowLeft" || e.key === "p" || e.key === "P") { e.preventDefault(); void st.prev(); }
      else if (e.key === "Escape" || e.key === "c" || e.key === "C") { void st.clear(); }
      else if (/^[1-9]$/.test(e.key)) { e.preventDefault(); void st.takeAt(Number(e.key) - 1); }
      else if (e.key === " " || e.key === "Enter") {
        const target = itemsRef.current[st.cue] ?? itemsRef.current[0];
        if (target && e.target === document.body) { e.preventDefault(); void st.take(target.id); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── auto-advance ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoOn) return;
    const id = setInterval(() => {
      const st = useRundown.getState();
      const list = rundownItems(st.cards);
      const at = list.findIndex((c) => c.visible);
      if (!st.loop && at === list.length - 1) { st.setAuto({ autoOn: false }); return; }
      void st.next();
    }, Math.max(2, autoSec) * 1000);
    return () => clearInterval(id);
  }, [autoOn, autoSec]);

  const narrowFormat = formatPref.useValue() !== "landscape";

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* On air now */}
      <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", onAir.length || builtInOn ? "border-red-500/60 bg-red-500/10" : "border-zinc-800 bg-zinc-900/40")}>
        <span className={cn("h-3 w-3 shrink-0 rounded-full", onAir.length || builtInOn ? "animate-pulse bg-red-500 motion-reduce:animate-none" : "bg-zinc-600")} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-display text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{t("run.onAir")}</div>
          <div className="truncate text-base font-semibold text-zinc-50">
            {onAir.length || builtInOn
              ? [...onAir.map((c) => c.title), builtInOn ? t(builtInOn.label) : null].filter(Boolean).join("  ·  ")
              : t("run.nothing")}
          </div>
        </div>
      </div>

      {/* Transport */}
      <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
        <Button size="lg" onClick={() => void prev()} disabled={items.length === 0} aria-label={t("run.prev")} title="←">
          <ChevronLeft className="h-5 w-5" aria-hidden /> {t("run.prev")}
        </Button>
        <Button variant="primary" size="lg" onClick={() => void next()} disabled={items.length === 0} aria-label={t("run.next")} title="→">
          {t("run.next")} <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
        <Button size="lg" onClick={() => void clear()} aria-label={t("run.clear")} title="Esc">
          <EyeOff className="h-5 w-5" aria-hidden /> {t("run.clear")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-300">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={autoOn} onChange={(e) => setAuto({ autoOn: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
          <Play className="h-3.5 w-3.5" aria-hidden /> {t("run.auto")}
        </label>
        <label className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          <input
            type="number" min={2} max={120} value={autoSec}
            onChange={(e) => setAuto({ autoSec: Number(e.target.value) || 8 })}
            aria-label={t("run.every")}
            className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-center tabular-nums text-zinc-100"
          />
          {t("run.seconds")}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={loop} onChange={(e) => setAuto({ loop: e.target.checked })} className="h-4 w-4 accent-emerald-500" /> {t("run.loop")}
        </label>
      </div>

      {/* The deck */}
      {loading ? (
        <p className="text-sm text-zinc-400">{t("gfx.loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center">
          <Layers className="mx-auto mb-2 h-6 w-6 text-zinc-500" aria-hidden />
          <p className="font-semibold text-zinc-100">{t("gfx.emptyTitle")}</p>
          <p className="mt-1 text-sm text-zinc-400">{t("run.emptyBody")}</p>
        </div>
      ) : (
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={t("run.deck")}>
          {items.map((c, i) => (
            <Tile
              key={c.id}
              card={c}
              index={i}
              cued={cue === i && !c.visible}
              narrowFormat={narrowFormat}
              onTake={() => void take(c.id)}
              onRemove={() => void remove(c.id)}
              onMove={(z) => void move(c.id, z)}
              onHide={() => void hide(c.id)}
            />
          ))}
        </ol>
      )}

      {/* Full-screen views — same list concept, shown when you want to dwell on one */}
      <div>
        <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-zinc-400">{t("run.liveViews")}</h3>
        <div className="flex flex-wrap gap-2">
          {BUILT_INS.map(({ key, label, icon: Icon }) => {
            const on = activeScene === key;
            return (
              <Button key={key} size="sm" variant={on ? "danger" : "secondary"} aria-pressed={on} onClick={() => void takeBuiltIn(key)} title={t("desk.fullscreenHint")}>
                <Icon className="h-3.5 w-3.5" aria-hidden /> {t(label)}
              </Button>
            );
          })}
          {tickers.map((c) => (
            <Button key={c.id} size="sm" variant={c.visible ? "danger" : "secondary"} aria-pressed={c.visible} onClick={() => void (c.visible ? hide(c.id) : take(c.id))}>
              {t("gfx.tickerBadge")}: {c.title}
            </Button>
          ))}
        </div>
      </div>

      <p className="rounded-lg bg-zinc-900/50 px-3 py-2 text-xs leading-relaxed text-zinc-400">{t("run.keys")}</p>

      {/* Add graphics */}
      <div className="rounded-xl border border-zinc-800">
        <button
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className={cn("flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left font-semibold text-zinc-100", focusRing)}
        >
          <span className="flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-500" aria-hidden /> {t("run.add")}</span>
          <ChevronRight className={cn("h-4 w-4 transition-transform", adding && "rotate-90")} aria-hidden />
        </button>
        {adding && (
          <div className="border-t border-zinc-800 p-4">
            <EditorialPanel addOnly />
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({
  card, index, cued, narrowFormat, onTake, onRemove, onMove, onHide,
}: {
  card: EditorialCard; index: number; cued: boolean; narrowFormat: boolean;
  onTake: () => void; onRemove: () => void; onMove: (z: Zone | "auto") => void; onHide: () => void;
}) {
  const t = useT();
  const Icon = ICONS[card.card_type as string] ?? Layers;
  const live = card.visible;
  const zone = effectiveZone(card);
  const typeLabel = `gfx.type.${card.card_type}` as MsgKey;
  const [menu, setMenu] = useState(false);

  return (
    <li
      className={cn(
        "group relative flex min-w-0 items-stretch overflow-hidden rounded-xl border transition-colors",
        live ? "border-red-500 bg-red-500/10 ring-1 ring-red-500/50" : cued ? "border-emerald-500 bg-emerald-600/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600",
      )}
    >
      <button onClick={onTake} aria-pressed={live} className={cn("flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left", focusRing)} title={live ? t("run.takeOff") : t("run.take")}>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold", live ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-300")}>
          {index < 9 ? index + 1 : <Icon className="h-4 w-4" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-50">{card.title}</span>
          <span className="flex items-center gap-1.5 truncate text-xs text-zinc-400">
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{t(typeLabel)}</span>
            {!narrowFormat && zone !== "main" && <span className="rounded bg-zinc-800 px-1 text-[10px] uppercase text-zinc-300">{t(`zone.${zone}` as MsgKey)}</span>}
          </span>
        </span>
        {live && <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{t("gfx.onAir")}</span>}
      </button>

      <div className="flex shrink-0 flex-col justify-center border-l border-zinc-800/80">
        <button onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label={t("run.options")} className={cn("px-2 py-1 text-zinc-500 hover:text-zinc-100", focusRing)}>⋯</button>
      </div>

      {menu && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-zinc-700 bg-zinc-900 p-2 shadow-lg">
          {!narrowFormat && (
            <select
              aria-label={t("gfx.position", { title: card.title })}
              value={(card.payload as { zone?: string } | null)?.zone ?? "auto"}
              onChange={(e) => onMove(e.target.value as Zone | "auto")}
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
            >
              <option value="auto">{t("run.zoneAuto")}</option>
              {ZONES.filter((z) => z !== "ticker").map((z) => <option key={z} value={z}>{t(`zone.${z}` as MsgKey)}</option>)}
            </select>
          )}
          {live && <Button size="sm" onClick={onHide}>{t("gfx.hide")}</Button>}
          <Button size="sm" variant="danger" onClick={onRemove} aria-label={t("gfx.delete", { title: card.title })}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
          <Button size="sm" onClick={() => setMenu(false)}>OK</Button>
        </div>
      )}
    </li>
  );
}
