"use client";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/lib/hooks/use-socket";
import { api, OverlayState } from "@/lib/api/client";
import { OverlayCanvas } from "@/components/overlay/canvas";
import { ScoreboardScene } from "@/components/overlay/scenes/scoreboard";
import { TimelineScene } from "@/components/overlay/scenes/timeline";
import { StatsScene } from "@/components/overlay/scenes/stats";
import { TacticalScene } from "@/components/overlay/scenes/tactical";
import { PlayerScene } from "@/components/overlay/scenes/player";
import { LowerThirdScene } from "@/components/overlay/scenes/lower-third";
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

export function OverlayContent() {
  // Start with null on BOTH server and client — no hydration mismatch
  const [params, setParams] = useState<{
    scene: string | null;
    token: string | null;
    isPreview: boolean;
  }>({ scene: null, token: null, isPreview: false });

  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<OverlayState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sceneOverride, setSceneOverride] = useState<string | null>(null);

  const fetchedRef = useRef(false);

  // After mount, read the actual URL
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      scene: sp.get("scene"),
      token: sp.get("token"),
      isPreview: sp.get("preview") === "1",
    });
    setHydrated(true);
    console.log("[overlay] hydrated, params read from URL");
  }, []);

  // Fetch overlay state once params are hydrated
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
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[overlay] fetch failed:", e);
        setFetchError(e instanceof Error ? e.message : "Overlay unavailable");
      });
    return () => { cancelled = true; };
  }, [hydrated, params.token]);

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

  // Before hydration: identical text on server and client. No branching.
  if (!hydrated) {
    return (
      <OverlayCanvas preview={false}>
        <div className="flex h-full items-center justify-center text-white/40">
          Connecting…
        </div>
      </OverlayCanvas>
    );
  }

  // After hydration: show the token state
  if (!data && !fetchError) {
    return (
      <OverlayCanvas preview={params.isPreview}>
        <div className="flex h-full items-center justify-center text-white/40">
          Connecting… {params.token ? "(token ok)" : "(no token in URL)"}
        </div>
      </OverlayCanvas>
    );
  }

  if (!data && fetchError) {
    return (
      <OverlayCanvas preview={params.isPreview}>
        <div className="flex h-full items-center justify-center text-sm text-red-400/80">
          Overlay unavailable: {fetchError}
        </div>
      </OverlayCanvas>
    );
  }

  const live = data!;
  const freshness = computeFreshness(live, wsConnected);

  const snapshot: MatchSnapshot = {
    matchId: live.match_id,
    competition: "",
    home: {
      id: live.home.id,
      name: live.home.name,
      shortName: live.home.shortName,
      color: live.home.color,
    },
    away: {
      id: live.away.id,
      name: live.away.name,
      shortName: live.away.shortName,
      color: live.away.color,
    },
    score: live.snapshot?.score ?? { home: 0, away: 0 },
    period: live.snapshot?.period ?? "NS",
    minute: live.snapshot?.minute ?? 0,
    status:
      live.state === "live" || live.state === "paused"
        ? "live"
        : live.state === "stopped"
          ? "ft"
          : "scheduled",
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
    <OverlayCanvas preview={params.isPreview}>
      {sceneKey === "scoreboard" && <ScoreboardScene snapshot={snapshot} />}
      {sceneKey === "timeline" && <TimelineScene events={events} />}
      {sceneKey === "stats" && <StatsScene snapshot={snapshot} />}
      {sceneKey === "tactical" && <TacticalScene snapshot={snapshot} />}
      {sceneKey === "player" && <PlayerScene events={events} />}
      {sceneKey === "lower-third" && (
        <LowerThirdScene text={live.active_commentary?.text} />
      )}
    </OverlayCanvas>
  );
}

function computeFreshness(live: OverlayState, wsConnected: boolean): DataFreshness {
  if (!wsConnected) return "disconnected";
  if (!live.snapshot) return "stale";
  const ageMs = Date.now() - new Date(live.snapshot.providerUpdatedAt).getTime();
  return ageMs > 30_000 ? "stale" : "fresh";
}