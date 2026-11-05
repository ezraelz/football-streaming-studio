import type { EditorialCard } from "@/lib/api/client";

/**
 * Where a graphic sits on screen, and the little helpers the studio needs to reason about it.
 * Kept separate from the (large) overlay renderer so the studio does not have to load it.
 */
export type Zone = "main" | "left" | "right" | "bottom" | "ticker";
export const ZONES: Zone[] = ["main", "left", "right", "bottom", "ticker"];
export const ZONE_LABEL: Record<Zone, string> = {
  main: "Main screen", left: "Left corner", right: "Right corner", bottom: "Bottom strip", ticker: "Ticker bar",
};

// One card at a time in the big main area is what works on every format (YouTube, TikTok, Shorts).
// Corners and the bottom strip are still available, but only when you choose them for a card.
const DEFAULT_ZONE: Record<string, Zone> = { custom: "main" };

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

