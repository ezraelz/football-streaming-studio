"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type EditorialCard } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";
import { EyeOff, Plus, Radio, Trash2 } from "lucide-react";
import { cn } from "@/lib/utility/utils";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/panel";
import { ZONES, ZONE_LABEL, isTickerCard, zoneOf, type TickerItem, type Zone } from "@/components/overlay/scenes/editorial";
import { buildNextMatchItems } from "@/lib/overlay/ticker";
import { inputClass } from "@/components/ui/form";

const CARD_TYPES = [
  "fixture_intro", "lineups", "standings", "form",
  "head_to_head", "top_scorers", "match_summary", "countdown", "custom",
] as const;

const label = (t: string) => t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * Pre / post-match graphic cards.
 * Creating a card no longer puts it on air — you add it, check it, then press "Show".
 */
export function EditorialPanel() {
  const params = useParams<{ sessionId: string }>();
  const [cards, setCards] = useState<EditorialCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [tickerText, setTickerText] = useState("");
  const [tickerLabel, setTickerLabel] = useState("News");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCards(await api.listEditorialCards(params.sessionId));
    } catch {
      setError("Couldn't load graphics cards.");
    } finally {
      setLoading(false);
    }
  }, [params.sessionId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useSocket<EditorialCard>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type === "editorial.update") void refresh();
  });

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
    guard(type, async () => { await api.seedEditorialCard(params.sessionId, type); setAdding(false); }, "Couldn't create the card.");
  const show = (id: string) =>
    guard(id, () => api.broadcastEditorialCard(params.sessionId, id), "Couldn't show the card.");
  const hide = (id: string) =>
    guard(id, () => api.updateEditorialCard(params.sessionId, id, { visible: false }), "Couldn't hide the card.");
  const move = (c: EditorialCard, value: Zone | "auto") => {
    const { zone: _old, ...rest } = c.payload as Record<string, unknown>;
    return guard(
      c.id,
      () => api.updateEditorialCard(params.sessionId, c.id, { payload: value === "auto" ? rest : { ...rest, zone: value } }),
      "Couldn't move the card.",
    );
  };
  /** Put a scrolling message on the ticker bar (replaces any ticker already on air). */
  const publishTicker = (key: string, label: string, items: TickerItem[], source: "fixtures" | "manual" | "news") =>
    guard(key, async () => {
      if (items.length === 0) throw new Error("Nothing to show.");
      for (const old of cards.filter((c) => isTickerCard(c) && c.visible)) {
        await api.updateEditorialCard(params.sessionId, old.id, { visible: false });
      }
      const payload = { kind: "ticker", label, items, source };
      let card: EditorialCard;
      try {
        card = await api.createEditorialCard(params.sessionId, { card_type: "custom", title: label, payload });
      } catch {
        card = await api.seedEditorialCard(params.sessionId, "custom"); // fall back to seed + update
        await api.updateEditorialCard(params.sessionId, card.id, { title: label, payload });
      }
      await api.broadcastEditorialCard(params.sessionId, card.id);
    }, "Couldn't publish the ticker.");

  const showNextMatches = () =>
    guard("ticker-next", async () => {
      const fixtures = await api.fixtures();
      const items = buildNextMatchItems(fixtures);
      if (items.length === 0) throw new Error("No upcoming fixtures found.");
      await publishTicker("ticker-next", "Next matches", items, "fixtures");
    }, "Couldn't build the next-matches ticker.");

  const showMessage = async () => {
    const text = tickerText.trim();
    if (!text) return;
    await publishTicker("ticker-msg", tickerLabel, [{ text }], tickerLabel === "News" ? "news" : "manual");
    setTickerText("");
  };

  const hideAll = () =>
    guard("hide", () => api.hideAllEditorial(params.sessionId), "Couldn't hide the cards.");
  const remove = (id: string) =>
    guard(id, () => api.deleteEditorialCard(params.sessionId, id), "Couldn't delete the card.");

  const onAir = cards.filter((c) => c.visible).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Plus className="h-4 w-4" aria-hidden /> Add card
        </Button>
        <Button size="sm" onClick={hideAll} disabled={busy === "hide" || onAir === 0}>
          <EyeOff className="h-4 w-4" aria-hidden /> Hide all{onAir > 0 && ` (${onAir} on air)`}
        </Button>
      </div>

      {adding && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
          <SectionLabel>Create from match data</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {CARD_TYPES.map((t) => (
              <Button key={t} size="sm" onClick={() => create(t)} disabled={busy === t} loading={busy === t}>
                {label(t)}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400">Cards are created off-air. Press Show when you&apos;re ready.</p>
        </div>
      )}

      <p className="text-xs text-zinc-400">
        Cards appear on the <strong className="text-zinc-200">main screen</strong>, a{" "}
        <strong className="text-zinc-200">left or right corner</strong>, or the{" "}
        <strong className="text-zinc-200">bottom strip</strong> (the ticker bar runs underneath). &ldquo;Auto&rdquo; picks by card type
        (line-ups in the centre, standings and form in the left corner, top scorers in the right corner, head-to-head along the bottom).
      </p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
        <SectionLabel>Ticker bar (scrolls along the bottom)</SectionLabel>
        <Button size="sm" onClick={showNextMatches} loading={busy === "ticker-next"} disabled={busy !== null}>
          Show next matches
        </Button>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => { e.preventDefault(); void showMessage(); }}
        >
          <select
            aria-label="Ticker label"
            value={tickerLabel}
            onChange={(e) => setTickerLabel(e.target.value)}
            className={`${inputClass} w-auto py-1.5 text-sm`}
          >
            <option>News</option><option>Info</option><option>Breaking</option>
          </select>
          <input
            aria-label="Ticker message"
            value={tickerText}
            onChange={(e) => setTickerText(e.target.value)}
            placeholder="Type a message to scroll…"
            className={`${inputClass} min-w-40 flex-1 py-1.5`}
          />
          <Button type="submit" size="sm" disabled={!tickerText.trim() || busy !== null} loading={busy === "ticker-msg"}>
            Show
          </Button>
        </form>
      </div>

      {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : cards.length === 0 ? (
        <EmptyState title="No graphics yet" description="Add a line-up, standings or intro card to show before or after the match." />
      ) : (
        <ul className="flex flex-col gap-2">
          {cards.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                c.visible ? "border-red-500/60 bg-red-500/10" : "border-zinc-800 bg-zinc-950/50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{c.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge>{isTickerCard(c) ? "Ticker" : label(c.card_type)}</Badge>
                  {c.visible && <Badge tone="live">On air</Badge>}
                </div>
                {!isTickerCard(c) && (
                <select
                  aria-label={`Screen position for ${c.title}`}
                  value={(c.payload as { zone?: string }).zone ?? "auto"}
                  onChange={(e) => move(c, e.target.value as Zone | "auto")}
                  disabled={busy === c.id}
                  className={`${inputClass} mt-2 w-auto py-1 text-xs`}
                >
                  <option value="auto">Auto · {ZONE_LABEL[zoneOf({ card_type: c.card_type, payload: { ...c.payload, zone: undefined } })]}</option>
                  {ZONES.filter((z) => z !== "ticker").map((z) => <option key={z} value={z}>{ZONE_LABEL[z]}</option>)}
                </select>
                )}
              </div>
              {c.visible ? (
                <Button size="sm" onClick={() => hide(c.id)} disabled={busy === c.id} loading={busy === c.id}>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden /> Hide
                </Button>
              ) : (
                <Button size="sm" onClick={() => show(c.id)} disabled={busy === c.id} loading={busy === c.id}>
                  <Radio className="h-3.5 w-3.5" aria-hidden /> Show
                </Button>
              )}
              <ConfirmButton
                variant="ghost"
                size="icon"
                confirmLabel="Delete?"
                ariaLabel={`Delete ${c.title}`}
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
