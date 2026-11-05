"use client";
import { useCallback, useRef, useState } from "react";
import type { EditorialCard } from "@/lib/api/client";
import type { CardAnim } from "@/components/overlay/env";
import { estimateMs, speak, stopSpeech, type Speaking, type VoiceLang } from "./voice";
import type { Segment } from "./script";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type AnimMode = "auto" | CardAnim;

/** The "card animator": each kind of graphic enters the way that suits it. */
export function animFor(card: EditorialCard | undefined, mode: AnimMode): CardAnim {
  if (mode !== "auto") return mode;
  const t = (card?.card_type ?? "") as string;
  if (!card) return "fade";
  if (["fixture_intro", "match_preview", "match_summary", "countdown"].includes(t)) return "pop";
  if (["prediction", "match_stats", "xg_race", "shot_map", "player_stats", "momentum", "odds_board"].includes(t)) return "rise";
  return "slide";
}

export interface PlayerOpts {
  segments: Segment[];
  cards: EditorialCard[];
  lang: VoiceLang;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  mute: boolean;
  animMode: AnimMode;
}

/**
 * Runs a script: for each line, bring its graphic in, speak the line (or wait a reading-speed time when
 * there is no voice), hold, take the graphic out, move on. Stop is instant.
 */
export function useMakerPlayer() {
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [anim, setAnim] = useState<CardAnim>("slide");
  const run = useRef(0);
  const speaking = useRef<Speaking | null>(null);
  const shownCard = useRef<string | null>(null);

  const stop = useCallback(() => {
    run.current++;
    speaking.current?.cancel();
    stopSpeech();
    shownCard.current = null;
    setPlaying(false); setIdx(-1); setCardId(null); setCaption(null); setLeaving(false);
  }, []);

  const play = useCallback(async (o: PlayerOpts, from = 0) => {
    const token = ++run.current;
    const alive = () => token === run.current;
    stopSpeech();
    setPlaying(true);

    for (let i = from; i < o.segments.length; i++) {
      if (!alive()) return;
      const seg = o.segments[i];
      setIdx(i);

      if (seg.cardId !== shownCard.current) {
        if (shownCard.current) { setLeaving(true); await sleep(380); if (!alive()) return; }
        setLeaving(false);
        setAnim(animFor(o.cards.find((c) => c.id === seg.cardId), o.animMode));
        shownCard.current = seg.cardId;
        setCardId(seg.cardId);
        await sleep(120);
        if (!alive()) return;
      }
      setCaption(seg.text);

      const reading = estimateMs(seg.text, o.lang, o.rate);
      if (o.voice && !o.mute) {
        speaking.current = speak(seg.text, { voice: o.voice, lang: o.lang, rate: o.rate });
        // Never let the card vanish faster than half the reading time, even if the engine errors out.
        await Promise.all([speaking.current.done, sleep(Math.max(1800, reading * 0.5))]);
      } else {
        await sleep(reading);
      }
      if (!alive()) return;
      await sleep(260);
    }

    if (!alive()) return;
    setLeaving(true);
    await sleep(380);
    if (!alive()) return;
    shownCard.current = null;
    setCardId(null); setCaption(null); setLeaving(false); setPlaying(false); setIdx(-1);
  }, []);

  return { idx, playing, cardId, caption, leaving, anim, play, stop };
}
