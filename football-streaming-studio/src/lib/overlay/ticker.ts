import type { Fixture } from "@/lib/api/client";
import type { TickerItem } from "@/components/overlay/scenes/editorial";
import { themeFor, DEFAULT_THEME } from "@/lib/branding/leagues";

/**
 * Turn upcoming fixtures into ticker items ("Sat 17:30 · Arsenal v Chelsea", tagged with the league).
 * Future news feeds can reuse the ticker bar: build `TickerItem[]` however you like and publish it.
 */
export function buildNextMatchItems(
  fixtures: Fixture[],
  { limit = 8, excludeMatchId, format }: { limit?: number; excludeMatchId?: string; format?: { time: (iso: string) => string; day: (iso: string, long?: boolean) => string } } = {},
): TickerItem[] {
  const now = Date.now();
  const today = new Date().toDateString();

  return fixtures
    .filter((f) => f.status === "scheduled" && new Date(f.kickoff).getTime() > now && f.id !== excludeMatchId)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
    .slice(0, limit)
    .map((f) => {
      const d = new Date(f.kickoff);
      const time = format ? format.time(f.kickoff) : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const day = format ? format.day(f.kickoff, false) : d.toDateString() === today ? "Today" : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
      const theme = themeFor(f.competition);
      return {
        text: `${day} ${time} · ${f.home.name} v ${f.away.name}`,
        tag: theme.id === DEFAULT_THEME.id ? undefined : theme.short,
      };
    });
}
