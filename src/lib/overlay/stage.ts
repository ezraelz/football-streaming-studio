/**
 * Output formats. The overlay always draws on a fixed pixel canvas and scales it to the window,
 * so each format is just a canvas size plus a "safe area" (where graphics may go).
 *
 * Portrait safe margins follow what TikTok / YouTube Shorts / Reels draw on top of video:
 * a header near the top, a caption + buttons near the bottom, and a button column on the right.
 */
export type FormatId = "landscape" | "portrait" | "square";

export interface Stage {
  id: FormatId;
  /** Full canvas, in pixels. */
  canvasW: number;
  canvasH: number;
  /** Space kept clear around the graphics (px). */
  inset: { l: number; t: number; r: number; b: number };
  /** Usable width/height inside the safe area. */
  W: number;
  H: number;
  /** Narrow stages stack everything in one column. */
  portrait: boolean;
  /** True when the score bug must use the compact two-row layout. */
  compactBug: boolean;
}

const make = (id: FormatId, canvasW: number, canvasH: number, inset: Stage["inset"], portrait: boolean, compactBug: boolean): Stage => ({
  id, canvasW, canvasH, inset, W: canvasW - inset.l - inset.r, H: canvasH - inset.t - inset.b, portrait, compactBug,
});

export const STAGES: Record<FormatId, Stage> = {
  // YouTube, OBS, TV. 5 % title-safe margin.
  landscape: make("landscape", 1920, 1080, { l: 96, t: 54, r: 96, b: 54 }, false, false),
  // TikTok / Shorts / Reels. Clear: top 150, bottom 330 (caption + UI), sides 70.
  portrait: make("portrait", 1080, 1920, { l: 70, t: 150, r: 70, b: 330 }, true, true),
  // Instagram feed, X, Facebook.
  square: make("square", 1080, 1080, { l: 54, t: 54, r: 54, b: 54 }, false, true),
};

export const FORMAT_IDS: FormatId[] = ["landscape", "portrait", "square"];

export const parseFormat = (v: string | null | undefined): FormatId =>
  v === "portrait" || v === "square" ? v : "landscape";

/** Zone geometry for the editorial layer, derived from the stage. */
export function dimsFor(stage: Stage) {
  if (stage.portrait) {
    // One column: score bug (compact) on top, one big card, ticker at the bottom.
    return { W: stage.W, H: stage.H, TOP: 300, GAP: 24, SIDE_W: 0, STRIP_H: 0, TICKER_H: 96, FLOOR: 0 };
  }
  if (stage.compactBug) {
    return { W: stage.W, H: stage.H, TOP: 290, GAP: 22, SIDE_W: 0, STRIP_H: 0, TICKER_H: 84, FLOOR: 0 };
  }
  return { W: stage.W, H: stage.H, TOP: 196, GAP: 24, SIDE_W: 440, STRIP_H: 204, TICKER_H: 76, FLOOR: 40 };
}
