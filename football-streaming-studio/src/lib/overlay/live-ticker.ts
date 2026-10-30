import type { LiveMatch } from "@/lib/api/client";
import type { TickerItem } from "@/components/overlay/scenes/editorial";

const minuteLabel = (m: LiveMatch): string => {
  if (m.period === "HT" || m.status === "halftime") return "HT";
  if (m.period === "FT" || m.status === "finished") return "FT";
  if (m.minute == null) return "LIVE";
  return `${m.minute}'`;
};

/**
 * Turn live matches into ticker items like "MCI 2-1 LIV · 67'".
 * When a competition name is present, prefix it as a tag so the ticker
 * groups by league visually.
 */
export function buildLiveScoreItems(matches: LiveMatch[]): TickerItem[] {
  return matches
    .filter((m) => m.home_short && m.away_short)
    .map((m) => {
      const home = m.home_score ?? "–";
      const away = m.away_score ?? "–";
      return {
        tag: m.competition || undefined,
        text: `${m.home_short} ${home}–${away} ${m.away_short} · ${minuteLabel(m)}`,
      };
    });
}