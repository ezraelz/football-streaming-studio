"use client";
/**
 * Voice for the preview maker, using the browser's built-in speech engine (no server needed).
 *
 * Honest limits: browsers do not let a page capture this audio into a recording, so to put the voice in a
 * video, capture the computer's audio (OBS "Desktop Audio" or your screen recorder's system audio).
 * Amharic voices exist in Microsoft Edge ("Mekdes" / "Ameha"); on browsers without one the maker still plays
 * the animation with captions on a reading-speed timer.
 */
export type VoiceLang = "en" | "am";

export function listVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener("voiceschanged", done); resolve(synth.getVoices()); };
    synth.addEventListener("voiceschanged", done);
    setTimeout(done, 1500); // some browsers never fire the event
  });
}

export const voicesFor = (voices: SpeechSynthesisVoice[], lang: VoiceLang) =>
  voices.filter((v) => v.lang.toLowerCase().startsWith(lang));

/** Best default: a "natural"/online voice first, then local ones. */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: VoiceLang): SpeechSynthesisVoice | null {
  const list = voicesFor(voices, lang);
  return list.find((v) => /natural|online/i.test(v.name)) ?? list[0] ?? null;
}

/** Rough reading time, used when no voice is available (and as a floor so a card is never gone too fast). */
export function estimateMs(text: string, lang: VoiceLang, rate = 1): number {
  const clean = text.trim();
  if (!clean) return 1200;
  // English ≈ 2.6 words/s. Amharic words are longer to say: ≈ 2.0 words/s.
  const words = clean.split(/\s+/).length;
  const perSec = (lang === "am" ? 2.0 : 2.6) * rate;
  return Math.max(1800, Math.round((words / perSec) * 1000) + 350);
}

const splitSentences = (text: string) =>
  text.replace(/\s+/g, " ").match(/[^.!?።፧]+[.!?።፧]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

export interface Speaking { done: Promise<void>; cancel: () => void }

/** Speak `text`, one sentence at a time. Resolves when finished (or cancelled). */
export function speak(text: string, opts: { voice: SpeechSynthesisVoice | null; lang: VoiceLang; rate: number }): Speaking {
  const synth = window.speechSynthesis;
  let cancelled = false;
  const sentences = splitSentences(text);

  const done = (async () => {
    for (const sentence of sentences) {
      if (cancelled) return;
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(sentence);
        if (opts.voice) u.voice = opts.voice;
        u.lang = opts.voice?.lang ?? (opts.lang === "am" ? "am-ET" : "en-GB");
        u.rate = opts.rate;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        synth.speak(u);
      });
    }
  })();

  return {
    done,
    cancel: () => { cancelled = true; synth.cancel(); },
  };
}

export const pauseSpeech = () => window.speechSynthesis?.pause();
export const resumeSpeech = () => window.speechSynthesis?.resume();
export const stopSpeech = () => window.speechSynthesis?.cancel();
