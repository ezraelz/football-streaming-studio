"use client";
import type { Ref } from "react";
import { OverlayCanvas } from "@/components/overlay/canvas";
import type { CardAnim } from "@/components/overlay/env";
import { ScoreboardScene } from "@/components/overlay/scenes/scoreboard";
import { LowerThirdScene } from "@/components/overlay/scenes/lower-third";
import { EditorialLayer } from "@/components/overlay/scenes/editorial";
import { captionReserve } from "@/components/overlay/scenes/editorial-state";
import { I18nProvider, type Lang } from "@/lib/i18n";
import { STAGES, type FormatId } from "@/lib/overlay/stage";
import type { EditorialCard } from "@/lib/api/client";
import type { MatchSnapshot } from "@/lib/types/types";

/**
 * The picture the maker plays and records: the same overlay components OBS uses, drawn locally on a
 * pitch-green backdrop, in whichever format (16:9, 9:16, 1:1) the video is for.
 * `captions` are burned in at the bottom, which is how most short videos are watched (sound off).
 */
export function MakerStage({
  format, cards, currentCardId, caption, snapshot, leaving, anim, lang, stageRef,
}: {
  format: FormatId;
  cards: EditorialCard[];
  currentCardId: string | null;
  caption: string | null;
  snapshot: MatchSnapshot;
  leaving: boolean;
  anim: CardAnim;
  lang: Lang;
  stageRef?: Ref<HTMLDivElement>;
}) {
  const stage = STAGES[format];
  const shown = cards.map((c) => ({ ...c, visible: c.id === currentCardId }));
  return (
    <div
      ref={stageRef}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: `${stage.canvasW} / ${stage.canvasH}`, background: "radial-gradient(120% 90% at 50% 0%, #0f3d22 0%, #06190f 60%, #03100a 100%)" }}
    >
      <div className="pitch-stripes pointer-events-none absolute inset-0" />
      <I18nProvider lang={lang}>
        <OverlayCanvas fill={false} format={format} anim={anim} tone="dark" lite>
          <ScoreboardScene snapshot={snapshot} />
          <div className={leaving ? "ov-leaving absolute inset-0" : "absolute inset-0"}>
            <EditorialLayer cards={shown} home={snapshot.home} away={snapshot.away} competition={snapshot.competition} reserveBottom={captionReserve(stage, true)} />
          </div>
          <LowerThirdScene text={caption} label={null} lift={stage.compactBug ? 4 : undefined} />
        </OverlayCanvas>
      </I18nProvider>
    </div>
  );
}
