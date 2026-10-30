"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type EditorialCard } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";
import { useMatchAvailability } from "@/lib/hooks/use-match-availability";
import { EyeOff, Plus, Radio, Trash2 } from "lucide-react";
import { cn } from "@/lib/utility/utils";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/panel";
import {
  ZONES, isTickerCard, zoneOf,
  type TickerItem, type Zone,
} from "@/components/overlay/scenes/editorial";
import { buildNextMatchItems } from "@/lib/overlay/ticker";
import { buildLiveScoreItems } from "@/lib/overlay/live-ticker";
import { inputClass } from "@/components/ui/form";
import { useT, type MsgKey } from "@/lib/i18n";
import { useFormat } from "@/lib/i18n/use-format";

type CardType =
  | "fixture_intro" | "countdown" | "match_summary" | "lineups" | "prediction"
  | "standings" | "top_scorers" | "top_assists" | "head_to_head" | "form"
  | "shot_map" | "momentum" | "best_xi" | "match_preview" | "custom";

type AvailabilityFlag =
  | "stats" | "lineups" | "incidents" | "shotmap" | "xg"
  | "momentum" | "average_positions" | "player_stats"
  | "prediction" | "broadcasts" | "odds";

const REQUIRES: Record<CardType, AvailabilityFlag[]> = {
  fixture_intro: [],
  countdown:     [],
  match_summary: ["incidents"],
  lineups:       ["lineups"],
  standings:     [],
  top_scorers:   [],
  top_assists:   [],
  best_xi:       [],
  head_to_head:  [],
  prediction:    ["prediction"],
  form:          [],
  shot_map:      ["shotmap"],
  momentum:      ["momentum"],
  match_preview: [],
  custom:        [],
};

// Fallback labels + hints — used when the i18n bundle doesn't yet have
// `gfx.type.<key>` / `gfx.type.<key>.hint` entries.
const CARD_META: Record<CardType, { label: string; hint: string }> = {
  fixture_intro: { label: "Fixture intro",  hint: "Kickoff, venue, teams" },
  countdown:     { label: "Countdown",      hint: "Time to kickoff" },
  match_summary: { label: "Match summary",  hint: "Score + goals" },
  lineups:       { label: "Line-ups",       hint: "Starting XI + bench" },
  standings:     { label: "Standings",      hint: "League table" },
  top_scorers:   { label: "Top scorers",    hint: "League scorer chart" },
  top_assists:   { label: "Top assists", hint: "League assist leaders" },
  head_to_head:  { label: "Head-to-head",   hint: "Past meetings" },
  form:          { label: "Recent form",    hint: "Last 5, both teams" },
  prediction:    { label: "Prediction",     hint: "Model probabilities" },
  shot_map:      { label: "Shot map",       hint: "Every shot with xG" },
  best_xi: { label: "Best XI", hint: "Team of the season" },
  momentum:      { label: "Momentum",       hint: "Pressure chart over 90'" },
  custom:        { label: "Custom",         hint: "Custom payload" },
  match_preview: { label: "Match preview", hint: "AI narrative + venue + weather" },
};

// Order of buttons in the "Add card" grid
const CARD_ORDER: CardType[] = [
  "match_preview", "fixture_intro", "countdown", "match_summary", "lineups",
  "standings", "top_scorers", "top_assists", "best_xi", "head_to_head",
  "form", "prediction", "shot_map", "momentum",
];

export function EditorialPanel() {
  const t = useT();
  const fmt = useFormat();
  const params = useParams<{ sessionId: string }>();
  const [cards, setCards] = useState<EditorialCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [tickerText, setTickerText] = useState("");
  const [tickerLabel, setTickerLabel] = useState("News");
  const [error, setError] = useState<string | null>(null);
  const { data: availability, loading: availabilityLoading } = useMatchAvailability(params.sessionId);

  const refresh = useCallback(async () => {
    try {
      setCards(await api.listEditorialCards(params.sessionId));
    } catch {
      setError(t("gfx.err.load"));
    } finally {
      setLoading(false);
    }
  }, [params.sessionId, t]);

  useEffect(() => { void refresh(); }, [refresh]);

  useSocket<EditorialCard>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type === "editorial.update") void refresh();
  });

  const isAvailable = (cardType: CardType): boolean => {
    const required = REQUIRES[cardType] ?? [];
    if (required.length === 0) return true;
    if (!availability?.available) return true;
    return required.every((flag) => availability.available[flag] === true);
  };

  const reason = (cardType: CardType): string | null => {
    const required = REQUIRES[cardType] ?? [];
    if (!availability?.available) return null;
    const missing = required.filter((flag) => availability.available[flag] !== true);
    if (missing.length === 0) return null;
    return t("gfx.noData", { list: missing.join(", ") });
  };

  const guard = async (key: string, fn: () => Promise<unknown>, failure: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? `${failure} ${e.message}` : failure);
    } finally {
      setBusy(null);
    }
  };

  const create = (type: string) =>
    guard(type, async () => {
      await api.seedEditorialCard(params.sessionId, type);
      setAdding(false);
    }, t("gfx.err.create"));

  const show = (id: string) =>
    guard(id, () => api.broadcastEditorialCard(params.sessionId, id), t("gfx.err.show"));

  const hide = (id: string) =>
    guard(id, () => api.updateEditorialCard(params.sessionId, id, { visible: false }), t("gfx.err.hide"));

  const move = (c: EditorialCard, value: Zone | "auto") => {
    const { zone: _old, ...rest } = c.payload as Record<string, unknown>;
    return guard(
      c.id,
      () => api.updateEditorialCard(params.sessionId, c.id, {
        payload: value === "auto" ? rest : { ...rest, zone: value },
      }),
      t("gfx.err.move"),
    );
  };

  const publishTicker = (
    key: string,
    labelText: string,
    items: TickerItem[],
    source: "fixtures" | "manual" | "news",
  ) =>
    guard(key, async () => {
      if (items.length === 0) throw new Error(t("gfx.err.nothing"));
      for (const old of cards.filter((c) => isTickerCard(c) && c.visible)) {
        await api.updateEditorialCard(params.sessionId, old.id, { visible: false });
      }
      const payload = { kind: "ticker", label: labelText, items, source };
      let card: EditorialCard;
      try {
        card = await api.createEditorialCard(params.sessionId, {
          card_type: "custom", title: labelText, payload,
        });
      } catch {
        card = await api.seedEditorialCard(params.sessionId, "custom");
        await api.updateEditorialCard(params.sessionId, card.id, { title: labelText, payload });
      }
      await api.broadcastEditorialCard(params.sessionId, card.id);
    }, t("gfx.err.ticker"));

  const showNextMatches = () =>
    guard("ticker-next", async () => {
      const fixtures = await api.fixtures();
      const items = buildNextMatchItems(fixtures, { format: fmt });
      if (items.length === 0) throw new Error(t("gfx.err.noUpcoming"));
      await publishTicker("ticker-next", "Next matches", items, "fixtures");
    }, t("gfx.err.tickerNext"));

  const showLiveScores = () =>
    guard("ticker-live", async () => {
      const data = await api.liveScores(params.sessionId);
      const items = buildLiveScoreItems(data.matches);
      if (items.length === 0) {
        throw new Error(t("gfx.err.noLive"));
      }
      await publishTicker("ticker-live", "Live now", items, "fixtures");
    }, t("gfx.err.tickerLive"));

  const showMessage = async () => {
    const text = tickerText.trim();
    if (!text) return;
    await publishTicker(
      "ticker-msg",
      tickerLabel,
      [{ text }],
      tickerLabel === "News" ? "news" : "manual",
    );
    setTickerText("");
  };

  const hideAll = () =>
    guard("hide", () => api.hideAllEditorial(params.sessionId), t("gfx.err.hideAll"));

  const remove = (id: string) =>
    guard(id, () => api.deleteEditorialCard(params.sessionId, id), t("gfx.err.delete"));

  // Auto-refresh the live-scores ticker every 30s while it's on air.
  // Stops itself if the ticker is hidden/deleted so we don't spin forever.
  useEffect(() => {
    const live = cards.find(
      (c) => isTickerCard(c) && c.visible && (c.payload as { label?: string }).label === "Live now"
    );
    if (!live) return;

    const id = setInterval(async () => {
      try {
        const data = await api.liveScores(params.sessionId);
        const items = buildLiveScoreItems(data.matches);
        if (items.length === 0) {
          await api.updateEditorialCard(params.sessionId, live.id, { visible: false });
          return;
        }
        const payload = { ...live.payload, items };
        await api.updateEditorialCard(params.sessionId, live.id, { payload });
        await api.broadcastEditorialCard(params.sessionId, live.id);
      } catch {
        // Network blips shouldn't spam the panel
      }
    }, 30_000);

    return () => clearInterval(id);
  }, [cards, params.sessionId]);

  const typeLabel = (ct: string): string => {
    const meta = CARD_META[ct as CardType];
    const tKey = `gfx.type.${ct}` as MsgKey;
    const translated = t(tKey);
    // `t()` often returns the key itself when missing; fall back to meta label
    if (translated && translated !== tKey) return translated;
    return meta?.label ?? ct.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  };

  const typeHint = (ct: CardType): string => {
    const tKey = `gfx.type.${ct}.hint` as MsgKey;
    const translated = t(tKey);
    if (translated && translated !== tKey) return translated;
    return CARD_META[ct]?.hint ?? "";
  };

  const onAir = cards.filter((c) => c.visible).length;
  const hasAvailability = !!availability?.available;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Top action bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Plus className="h-4 w-4" aria-hidden /> {t("gfx.add")}
        </Button>
        <Button size="sm" onClick={hideAll} disabled={busy === "hide" || onAir === 0}>
          <EyeOff className="h-4 w-4" aria-hidden /> {t("gfx.hideAll")}
          {onAir > 0 && ` (${t("gfx.onAirCount", { n: onAir })})`}
        </Button>
        {availabilityLoading && (
          <span className="text-[11px] text-zinc-500">{t("gfx.checking")}</span>
        )}
        {availability?.lineup_status && (
          <Badge tone={availability.lineup_status === "confirmed" ? "live" : undefined}>
            {t("gfx.lineupStatus", { status: availability.lineup_status })}
          </Badge>
        )}
      </div>

      {/* ── Add card grid ────────────────────────────────────────────── */}
      {adding && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
          <SectionLabel>{t("gfx.create")}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {CARD_ORDER.map((type) => {
              const label = typeLabel(type);
              const hint = typeHint(type);
              const ok = isAvailable(type);
              const why = reason(type);
              return (
                <Button
                  key={type}
                  size="sm"
                  onClick={() => create(type)}
                  disabled={busy === type || !ok}
                  loading={busy === type}
                  title={!ok ? (why ?? t("gfx.unavailable")) : hint}
                >
                  {label}
                </Button>
              );
            })}
          </div>
          {hasAvailability && (
            <div className="mt-2 rounded border border-zinc-800 bg-zinc-900/50 p-2 text-[10px] text-zinc-500">
              <div>
                available:{" "}
                {Object.entries(availability!.available)
                  .filter(([, v]) => v)
                  .map(([k]) => k)
                  .join(", ") || "—"}
              </div>
              {availability!.stat_keys && availability!.stat_keys.length > 0 && (
                <div className="mt-1 truncate">stats: {availability!.stat_keys.join(", ")}</div>
              )}
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-400">{t("gfx.offAir")}</p>
        </div>
      )}

      <p className="text-xs text-zinc-400">{t("gfx.zonesHelp")}</p>

      {/* ── Ticker bar controls ──────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
        <SectionLabel>{t("gfx.ticker")}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={showNextMatches} loading={busy === "ticker-next"} disabled={busy !== null}>
            {t("gfx.tickerNext")}
          </Button>
          <Button size="sm" onClick={showLiveScores} loading={busy === "ticker-live"} disabled={busy !== null}>
            {t("gfx.tickerLive")}
          </Button>
        </div>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => { e.preventDefault(); void showMessage(); }}
        >
          <select
            aria-label={t("gfx.tickerLabel")}
            value={tickerLabel}
            onChange={(e) => setTickerLabel(e.target.value)}
            className={`${inputClass} w-auto py-1.5 text-sm`}
          >
            <option value="News">{t("gfx.news")}</option>
            <option value="Info">{t("gfx.info")}</option>
            <option value="Breaking">{t("gfx.breaking")}</option>
          </select>
          <input
            aria-label={t("gfx.tickerMsg")}
            value={tickerText}
            onChange={(e) => setTickerText(e.target.value)}
            placeholder={t("gfx.tickerPlaceholder")}
            className={`${inputClass} min-w-40 flex-1 py-1.5`}
          />
          <Button type="submit" size="sm" disabled={!tickerText.trim() || busy !== null} loading={busy === "ticker-msg"}>
            {t("gfx.show")}
          </Button>
        </form>
      </div>

      {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* ── Existing cards list ──────────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-zinc-400">{t("gfx.loading")}</p>
      ) : cards.length === 0 ? (
        <EmptyState title={t("gfx.emptyTitle")} description={t("gfx.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {cards.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                c.visible
                  ? "border-red-500/60 bg-red-500/10"
                  : "border-zinc-800 bg-zinc-950/50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{c.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge>{isTickerCard(c) ? t("gfx.tickerBadge") : typeLabel(c.card_type)}</Badge>
                  {c.visible && <Badge tone="live">{t("gfx.onAir")}</Badge>}
                </div>
                {!isTickerCard(c) && (
                  <select
                    aria-label={t("gfx.position", { title: c.title })}
                    value={(c.payload as { zone?: string }).zone ?? "auto"}
                    onChange={(e) => move(c, e.target.value as Zone | "auto")}
                    disabled={busy === c.id}
                    className={`${inputClass} mt-2 w-auto py-1 text-xs`}
                  >
                    <option value="auto">
                      {t("gfx.auto", {
                        zone: t(
                          `zone.${zoneOf({
                            card_type: c.card_type,
                            payload: { ...c.payload, zone: undefined },
                          })}` as MsgKey,
                        ),
                      })}
                    </option>
                    {ZONES.filter((z) => z !== "ticker").map((z) => (
                      <option key={z} value={z}>
                        {t(`zone.${z}` as MsgKey)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {c.visible ? (
                <Button size="sm" onClick={() => hide(c.id)} disabled={busy === c.id} loading={busy === c.id}>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden /> {t("gfx.hide")}
                </Button>
              ) : (
                <Button size="sm" onClick={() => show(c.id)} disabled={busy === c.id} loading={busy === c.id}>
                  <Radio className="h-3.5 w-3.5" aria-hidden /> {t("gfx.show")}
                </Button>
              )}
              <ConfirmButton
                variant="ghost"
                size="icon"
                confirmLabel={t("gfx.deleteQ")}
                ariaLabel={t("gfx.delete", { title: c.title })}
                icon={<Trash2 className="h-4 w-4" aria-hidden />}
                onConfirm={() => remove(c.id)}
                className="text-zinc-400 hover:text-red-300"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}