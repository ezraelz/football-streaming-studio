import type { EditorialCard } from "@/lib/api/client";
import { STAGES, dimsFor, type Stage } from "@/lib/overlay/stage";
import { zoneOf } from "@/lib/overlay/zones";

/** Small, dependency-light helpers for the card layer (kept apart from the large renderer). */

export const keyOf = (c: Partial<EditorialCard>) => c.id ?? c.card_type ?? "card";

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

/** Lift (px) that keeps the lower third clear of the ticker / bottom strip when they are on air. */
export function lowerThirdLift(cards: EditorialCard[], stage: Stage = STAGES.landscape): number | undefined {
  const { GAP, STRIP_H, TICKER_H } = dimsFor(stage);
  const shown = cards.filter((c) => c.visible);
  const ticker = shown.some((c) => zoneOf(c) === "ticker");
  const strip = !stage.compactBug && shown.some((c) => zoneOf(c) === "bottom");
  if (!ticker && !strip) return undefined;
  return (ticker ? TICKER_H + GAP : 0) + (strip ? STRIP_H + GAP : 0) + 12;
}

/** Space to keep free at the bottom of the card area while a caption / lower third is on screen. */
export function captionReserve(stage: Stage, active: boolean): number {
  if (!active) return 0;
  return stage.compactBug ? 250 : 190;
}
