"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSocket } from "@/lib/hooks/use-socket";
import { api, OverlayState, EditorialCard, Incident } from "@/lib/api/client";
import { OverlayCanvas } from "@/components/overlay/canvas";
import { ScoreboardScene } from "@/components/overlay/scenes/scoreboard";
import { LowerThirdScene } from "@/components/overlay/scenes/lower-third";
import { applyEditorialUpdate, captionReserve, lowerThirdLift } from "@/components/overlay/scenes/editorial-state";

// Full-screen views and the card layer are separate chunks: the OBS source starts with just the score bug.
const TimelineScene = dynamic(() => import("@/components/overlay/scenes/timeline").then((m) => m.TimelineScene), { ssr: false });
const StatsScene = dynamic(() => import("@/components/overlay/scenes/stats").then((m) => m.StatsScene), { ssr: false });
const TacticalScene = dynamic(() => import("@/components/overlay/scenes/tactical").then((m) => m.TacticalScene), { ssr: false });
const PlayerScene = dynamic(() => import("@/components/overlay/scenes/player").then((m) => m.PlayerScene), { ssr: false });
const EditorialLayer = dynamic(() => import("@/components/overlay/scenes/editorial").then((m) => m.EditorialLayer), { ssr: false });
import { I18nProvider, useT, type Lang } from "@/lib/i18n";
import type { Accent, OverlayTone } from "@/lib/prefs";
import { STAGES, parseFormat, type FormatId } from "@/lib/overlay/stage";
import type { CardAnim } from "@/components/overlay/env";
import type { MatchSnapshot, MatchEvent, DataFreshness } from "@/lib/types/types";

export type OverlaySceneKey =
  | "scoreboard" | "timeline" | "stats" | "tactical" | "player" | "lower-third";

const VALID_SCENES: readonly OverlaySceneKey[] = [
  "scoreboard", "timeline", "stats", "tactical", "player", "lower-third",
];

function normalizeScene(s: string | null): OverlaySceneKey {
  if (s && (VALID_SCENES as readonly string[]).includes(s)) return s as OverlaySceneKey;
  return "scoreboard";
}

/**
 * OBS / preview entry point.
 * URL options:  ?token=…  [&lang=am|en]  [&tone=dark|light]  [&lite=1]  [&scene=…]  [&preview=1]
 */
/** NS = not started, 1H/2H/ET/PEN = in play, HT = half-time, FT = full time. */
function matchStatus(period: string | undefined, minute: number | undefined, session: string, explicit?: string): MatchSnapshot["status"] {
  const p = (period ?? "").toUpperCase();
  if (p === "FT" || p === "AET" || p === "PEN_FT") return "ft";
  if (p === "HT") return "ht";
  if (["1H", "2H", "ET", "ET1", "ET2", "PEN", "BT"].includes(p)) return "live";
  if (p === "NS" || p === "") {
    // No period yet. Only trust a running clock; a stopped session with no data means "over".
    if (explicit === "live") return "live";
    if (explicit === "ft") return "ft";
    if ((minute ?? 0) > 0) return "live";
    return explicit === "scheduled" || session !== "stopped" ? "scheduled" : "ft";
  }
  return "live";
}

export function OverlayContent() {
  const [lang, setLang] = useState<Lang | undefined>(undefined);
  useEffect(() => {
    const l = new URLSearchParams(window.location.search).get("lang");
    if (l === "am" || l === "en") setLang(l);
  }, []);
  return (
    <I18nProvider lang={lang}>
      <OverlayStage />
    </I18nProvider>
  );
}

function OverlayStage() {
  const t = useT();
  const [params, setParams] = useState<{
    scene: string | null;
    token: string | null;
    isPreview: boolean;
    tone: OverlayTone;
    lite: boolean;
    accent: Accent;
    format: FormatId;
    anim: CardAnim;
    compact: boolean;
    /** Follow the studio's scene changes. On when the URL has no `scene=` (one OBS source does everything). */
    follow: boolean;
  }>({ scene: null, token: null, isPreview: false, tone: "dark", lite: false, accent: "pitch", format: "landscape", anim: "slide", compact: false, follow: true });

  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<OverlayState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sceneOverride, setSceneOverride] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const compactMode = params.compact;
  // Every card currently on air. Several can be visible at once; the layer arranges them.
  const [editorialCards, setEditorialCards] = useState<EditorialCard[]>([]);
  const fetchedRef = useRef(false);
  const followRef = useRef(true);
  followRef.current = params.follow;
  const syncRef = useRef(false); // does the backend send scene / cards in overlay state?

  // Take the parts of the server state that the websocket only delivers as events
  // (current scene, cards on air). Used on load and as a periodic safety net.
  const applyExtras = (d: OverlayState) => {
    if (Array.isArray(d.editorial_cards)) setEditorialCards(d.editorial_cards.filter((c) => c.visible));
    if (followRef.current && d.scene_id) setSceneOverride(d.scene_id);
  };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      scene: sp.get("scene"),
      token: sp.get("token"),
      isPreview: sp.get("preview") === "1",
      tone: sp.get("tone") === "light" ? "light" : "dark",
      lite: sp.get("lite") === "1",
      format: parseFormat(sp.get("format")),
      anim: (["pop", "fade", "rise"].includes(sp.get("anim") ?? "") ? sp.get("anim") : "slide") as CardAnim,
      accent: (["royal", "gold", "crimson"].includes(sp.get("accent") ?? "") ? sp.get("accent") : "pitch") as Accent,
      compact: sp.get("compact") === "1",
      // `?scene=x` alone pins a source to that scene (legacy, one OBS source per scene).
      follow: !sp.get("scene") || sp.get("follow") === "1" || sp.get("preview") === "1",
    });
    setHydrated(true);
    console.log("[overlay] hydrated, params read from URL");
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!params.token) {
      console.warn("[overlay] no token in URL");
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    console.log("[overlay] fetching state with token", params.token.slice(0, 8) + "…");

    let cancelled = false;
    api.overlayState(params.token)
      .then((d) => {
        if (cancelled) return;
        console.log("[overlay] got data:", d.match_id, "score:", d.snapshot?.score);
        setData(d);
        setFetchError(null);
        syncRef.current = d.editorial_cards !== undefined || d.scene_id !== undefined;
        applyExtras(d);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[overlay] fetch failed:", e);
        setFetchError(e instanceof Error ? e.message : "Overlay unavailable");
      });
    return () => { cancelled = true; };
  }, [hydrated, params.token]);

  // Fetch incidents once when the match is known; after that the WebSocket match.update keeps them fresh
  // (no polling: it was a steady stream of requests for an overlay that rarely changes).
  useEffect(() => {
    if (!data?.match_id || incidents.length > 0) return;
    let cancelled = false;
    api.incidents(data.match_id)
      .then((r) => { if (!cancelled) setIncidents(r.incidents); })
      .catch(() => { /* ignore, wait for WS */ });
    return () => { cancelled = true; };
  }, [data?.match_id, incidents.length]);

  // Safety net: OBS reloads sources and websockets drop. Re-sync scene + cards every 5s
  // (only if the backend includes them in the overlay state).
  useEffect(() => {
    if (!data || !params.token) return;
    const token = params.token;
    const id = setInterval(() => {
      if (!syncRef.current) return;
      api.overlayState(token).then(applyExtras).catch(() => { /* keep showing what we have */ });
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, params.token]);

  // Match socket — score / events / snapshot
  const matchWsPath = data?.match_id ? `/ws/v1/matches/${data.match_id}` : null;
  useSocket<any>(matchWsPath, (msg) => {
    if (msg.type === "match.update") {
      setWsConnected(true);
      setData((prev) =>
        prev
          ? {
              ...prev,
              match_id: msg.data.match_id ?? prev.match_id,
              home: msg.data.home ?? prev.home,
              away: msg.data.away ?? prev.away,
              snapshot: msg.data.snapshot ?? prev.snapshot,
              events: msg.data.events ?? prev.events,
            }
          : prev,
      );
    }
  });

  // Session socket — session state, commentary, editorial
  const sessionWsPath = data?.session_id ? `/ws/v1/show-sessions/${data.session_id}` : null;
  useSocket<any>(sessionWsPath, (msg) => {
    if (msg.type === "session.update" && msg.data.state) {
      setData((prev) => (prev ? { ...prev, state: msg.data.state } : prev));
    }
    if (msg.type === "commentary.update") {
      const item = msg.data;
      if (item.status === "queued" || item.status === "playing") {
        setData((prev) =>
          prev
            ? {
                ...prev,
                active_commentary: {
                  id: item.id,
                  text: item.text,
                  priority: item.priority,
                  expires_at: item.expires_at,
                },
              }
            : prev,
        );
      } else if (["played", "skipped", "cancelled"].includes(item.status)) {
        setData((prev) =>
          prev && prev.active_commentary?.id === item.id
            ? { ...prev, active_commentary: null }
            : prev,
        );
      }
    }
    if (msg.type === "scene.command" && followRef.current && typeof msg.data?.scene_id === "string") {
      setSceneOverride(msg.data.scene_id);
    }
    if (msg.type === "editorial.update") {
      setEditorialCards((prev) => applyEditorialUpdate(prev, msg.data));
    }
  });

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "scene.change" && typeof e.data.scene === "string") {
        setSceneOverride(e.data.scene);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const sceneKey = normalizeScene(sceneOverride ?? params.scene);

  if (!hydrated) {
    return (
      <OverlayCanvas preview={false} tone={params.tone} lite={params.lite} accent={params.accent} format={params.format} anim={params.anim}>
        <div className="flex h-full items-center justify-center text-[36px] text-white/40">{t("ov.connecting")}</div>
      </OverlayCanvas>
    );
  }

  if (!data && !fetchError) {
    return (
      <OverlayCanvas preview={params.isPreview} tone={params.tone} lite={params.lite} accent={params.accent} format={params.format} anim={params.anim}>
        <div className="flex h-full items-center justify-center text-[36px] text-white/40">
          {t("ov.connecting")} {params.token ? t("ov.tokenOk") : t("ov.noToken")}
        </div>
      </OverlayCanvas>
    );
  }

  if (!data && fetchError) {
    return (
      <OverlayCanvas preview={params.isPreview} tone={params.tone} lite={params.lite} accent={params.accent} format={params.format} anim={params.anim}>
        <div className="flex h-full items-center justify-center text-[32px] text-red-400/80">
          {t("ov.unavailable", { error: fetchError ?? "" })}
        </div>
      </OverlayCanvas>
    );
  }

  const live = data!;
  const freshness = computeFreshness(live, wsConnected);

  const snapshot: MatchSnapshot = {
    matchId: live.match_id,
    competition: live.competition ?? "",
    home: {
      id: live.home.id,
      name: live.home.name,
      shortName: live.home.shortName,
      color: live.home.color,
      crestUrl: live.home.crestUrl ?? undefined,
    },
    away: {
      id: live.away.id,
      name: live.away.name,
      shortName: live.away.shortName,
      color: live.away.color,
      crestUrl: live.away.crestUrl ?? undefined,
    },
    score: live.snapshot?.score ?? { home: 0, away: 0 },
    period: live.snapshot?.period ?? "NS",
    minute: live.snapshot?.minute ?? 0,
    // Match status comes from the MATCH (period), never from the show session: a show can be "live"
    // (on air) long before kick-off.
    status: matchStatus(live.snapshot?.period, live.snapshot?.minute, live.state, live.match_status),
    kickoff: live.kickoff,
    stats: live.snapshot?.stats ?? {},
    providerUpdatedAt: live.snapshot?.providerUpdatedAt ?? new Date().toISOString(),
    receivedAt: live.snapshot?.receivedAt ?? new Date().toISOString(),
    freshness,
  };

  const events: MatchEvent[] = live.events.map((e) => ({
    eventId: e.eventId,
    matchId: live.match_id,
    type: e.type as MatchEvent["type"],
    teamId: e.teamId,
    playerId: null,
    playerName: e.playerName,
    minute: e.minute,
    status: e.status as MatchEvent["status"],
    sourceUpdatedAt: live.snapshot?.providerUpdatedAt ?? new Date().toISOString(),
    receivedAt: live.snapshot?.receivedAt ?? new Date().toISOString(),
  }));

  return (
    <OverlayCanvas preview={params.isPreview} tone={params.tone} lite={params.lite} accent={params.accent} format={params.format} anim={params.anim}>
      {/* One broadcast: the score bug is ALWAYS on. Full-screen graphics (timeline, tactical, player)
          sit below it, cards sit in the editorial layer, and live commentary is the lower third. */}
      <ScoreboardScene snapshot={snapshot} />
      {sceneKey === "timeline" && (
        <TimelineScene
          incidents={incidents}
          competition={snapshot.competition}
          home={{
            id: live.home.id,
            name: live.home.name,
            shortName: live.home.shortName,
            color: live.home.color,
          }}
          away={{
            id: live.away.id,
            name: live.away.name,
            shortName: live.away.shortName,
            color: live.away.color,
          }}
        />
      )}
      {sceneKey === "stats" && <StatsScene snapshot={snapshot} />}
      {sceneKey === "tactical" && (
        <TacticalScene
          snapshot={snapshot}
          lineups={live.lineups}
          showNames={!compactMode}
          showNumbers={!compactMode}
        />
      )}
      {sceneKey === "player" && <PlayerScene events={events} snapshot={snapshot} />}
      <LowerThirdScene
        text={live.active_commentary?.text}
        lift={lowerThirdLift(editorialCards, STAGES[params.format])}
      />
      <EditorialLayer
        cards={editorialCards}
        competition={live.competition}
        reserveBottom={captionReserve(STAGES[params.format], !!live.active_commentary?.text)}
        home={{ name: live.home.name, color: live.home.color, crestUrl: live.home.crestUrl }}
        away={{ name: live.away.name, color: live.away.color, crestUrl: live.away.crestUrl }}
      />
    </OverlayCanvas>
  );
}

function computeFreshness(live: OverlayState, wsConnected: boolean): DataFreshness {
  if (!wsConnected) return "disconnected";
  if (!live.snapshot) return "stale";
  const ageMs = Date.now() - new Date(live.snapshot.providerUpdatedAt).getTime();
  return ageMs > 30_000 ? "stale" : "fresh";
}