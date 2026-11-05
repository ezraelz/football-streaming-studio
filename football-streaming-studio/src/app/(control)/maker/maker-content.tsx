"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown, ArrowUp, Circle, Film, Loader2, Maximize2, Play, Plus, Search, Sparkles, Square, Trash2, Volume2, VolumeX, Wand2,
} from "lucide-react";
import { api, type EditorialCard, type Fixture } from "@/lib/api/client";
import type { MatchSnapshot } from "@/lib/types/types";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/feedback";
import { Button, focusRing } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { FormatSwitch } from "@/components/control/preview-pane";
import { MakerStage } from "@/components/maker/maker-stage";
import { TeamCrest } from "@/components/overlay/crest";
import { formatPref } from "@/lib/prefs";
import { useI18n, useT, type MsgKey } from "@/lib/i18n";
import { useFormat } from "@/lib/i18n/use-format";
import { STAGES } from "@/lib/overlay/stage";
import { localTeamName } from "@/lib/branding/clubs";
import { competitionLabel } from "@/lib/branding/leagues";
import { cn } from "@/lib/utility/utils";
import { TEMPLATES, buildScript, type Segment, type ShowKind } from "@/lib/maker/script";
import { estimateMs, listVoices, pickVoice, voicesFor, type VoiceLang } from "@/lib/maker/voice";
import { useMakerPlayer, type AnimMode } from "@/lib/maker/use-player";

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;

type Phase = "choose" | "working" | "edit";

export function MakerContent() {
  const t = useT();
  const { lang: uiLang } = useI18n();
  const fmt = useFormat();
  const sp = useSearchParams();

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ShowKind>(sp.get("kind") === "post" ? "post" : "pre");
  const [fixtureId, setFixtureId] = useState<string | null>(sp.get("match"));
  const [lang, setLang] = useState<VoiceLang>(uiLang);
  const [rate, setRate] = useState(1);
  const [mute, setMute] = useState(false);
  const [animMode, setAnimMode] = useState<AnimMode>("auto");
  const format = formatPref.useValue();

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");

  const [phase, setPhase] = useState<Phase>("choose");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<EditorialCard[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const sessionRef = useRef<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const player = useMakerPlayer();
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const [download, setDownload] = useState<string | null>(null);

  // data ------------------------------------------------------------------------------
  useEffect(() => {
    const now = new Date();
    api.fixtures({ from: day(addDays(now, -4)), to: day(addDays(now, 14)) })
      .then(setFixtures)
      .catch((e) => setError(e instanceof Error ? e.message : t("matches.err.load")));
    void listVoices().then(setVoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voiceList = useMemo(() => voicesFor(voices, lang), [voices, lang]);
  const voice = useMemo(
    () => voiceList.find((v) => v.name === voiceName) ?? pickVoice(voices, lang),
    [voiceList, voiceName, voices, lang],
  );

  const q = search.trim().toLowerCase();
  const list = useMemo(() => {
    const want = (f: Fixture) => (kind === "post" ? f.status === "ft" : f.status !== "ft");
    return fixtures
      .filter((f) => want(f) && (!q || [f.home.name, f.away.name, f.competition].some((x) => x?.toLowerCase().includes(q))))
      .sort((a, b) => (kind === "post" ? +new Date(b.kickoff) - +new Date(a.kickoff) : +new Date(a.kickoff) - +new Date(b.kickoff)))
      .slice(0, 60);
  }, [fixtures, kind, q]);

  const fixture = fixtures.find((f) => f.id === fixtureId) ?? null;

  // leave no stray sessions behind ----------------------------------------------------------
  const cleanup = useCallback(() => {
    const id = sessionRef.current;
    sessionRef.current = null;
    if (id) void api.transition(id, "stopped").catch(() => {});
  }, []);
  useEffect(() => () => { cleanup(); player.stop(); recorder.current?.state === "recording" && recorder.current.stop(); }, [cleanup, player]);

  // generate --------------------------------------------------------------------------------
  const generate = async () => {
    if (!fixture) return;
    setError(null); setPhase("working"); setDownload(null);
    try {
      setProgress(t("maker.p.session"));
      const profiles = await api.listProfiles();
      if (!profiles[0]) throw new Error(t("matches.err.noProfile"));
      cleanup();
      const session = await api.createSession(profiles[0].id, fixture.id);
      sessionRef.current = session.id;

      setProgress(t("maker.p.cards"));
      await Promise.allSettled(TEMPLATES[kind].map((type) => api.seedEditorialCard(session.id, type)));
      const made = await api.listEditorialCards(session.id);
      if (made.length === 0) throw new Error(t("maker.err.noCards"));

      setProgress(t("maker.p.script"));
      let snap: MatchSnapshot;
      try { snap = await api.match(fixture.id); } catch { snap = fallbackSnapshot(fixture, kind); }
      snap = { ...snap, kickoff: snap.kickoff ?? fixture.kickoff, status: kind === "post" ? "ft" : "scheduled", period: kind === "post" ? "FT" : "NS", minute: 0 };

      const names = { home: localTeamName(fixture.home.name, lang), away: localTeamName(fixture.away.name, lang), competition: competitionLabel(fixture.competition, lang) ?? fixture.competition };
      setCards(made);
      setSnapshot(snap);
      setSegments(buildScript(kind, lang, made, names));
      setPhase("edit");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("maker.err.generic"));
      setPhase("choose");
    }
  };

  // script editing ----------------------------------------------------------------------------
  const setSeg = (i: number, patch: Partial<Segment>) => setSegments((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const moveSeg = (i: number, d: -1 | 1) => setSegments((s) => {
    const j = i + d; if (j < 0 || j >= s.length) return s;
    const n = s.slice(); [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const total = useMemo(() => segments.reduce((n, s) => n + (estimateMs(s.text, lang, rate) + 700), 0), [segments, lang, rate]);

  const opts = () => ({ segments, cards, lang, voice, rate, mute, animMode });
  const doPlay = (from = 0) => { setDownload(null); void player.play(opts(), from); };

  // fullscreen + recording ------------------------------------------------------------------------
  const goFullscreen = () => void stageRef.current?.requestFullscreen?.().catch(() => {});

  const startRecording = async () => {
    setError(null);
    try {
      const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia: (o?: unknown) => Promise<MediaStream> };
      const stream = await md.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: "include" });
      // Crop the capture to just the picture (Chrome "Region Capture"), so there is no studio UI in the video.
      const CropTarget = (window as unknown as { CropTarget?: { fromElement: (el: Element) => Promise<unknown> } }).CropTarget;
      const track = stream.getVideoTracks()[0] as MediaStreamTrack & { cropTo?: (t: unknown) => Promise<void> };
      if (CropTarget && track.cropTo && stageRef.current) {
        try { await track.cropTo(await CropTarget.fromElement(stageRef.current)); } catch { /* record the whole tab */ }
      }
      const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        setDownload(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));
        setRecording(false);
      };
      track.onended = () => rec.state === "recording" && rec.stop();
      recorder.current = rec;
      rec.start(500);
      setRecording(true);
      doPlay(0);
    } catch {
      setError(t("maker.err.record"));
      setRecording(false);
    }
  };
  const stopRecording = () => { player.stop(); recorder.current?.state === "recording" && recorder.current.stop(); };

  // finish recording automatically when playback ends
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !player.playing && recorder.current?.state === "recording") setTimeout(() => recorder.current?.state === "recording" && recorder.current.stop(), 900);
    wasPlaying.current = player.playing;
  }, [player.playing]);

  const stage = STAGES[format];
  const tall = stage.canvasH >= stage.canvasW;
  const shortsOk = total <= 60_000;

  // ── render ─────────────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <PageHeader title={t("maker.title")} description={t("maker.description")} icon="trophy" />
      {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {phase !== "edit" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* 1 — pick the match */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4" aria-labelledby="mk-1">
            <h2 id="mk-1" className="mb-3 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-zinc-100">
              <Step n={1} /> {t("maker.pick")}
            </h2>
            <div role="tablist" aria-label={t("maker.kind")} className="mb-3 inline-flex rounded-lg bg-zinc-950/60 p-0.5">
              {(["pre", "post"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setFixtureId(null); }}
                  className={cn("rounded-md px-4 py-1.5 text-sm font-semibold transition-colors", focusRing, kind === k ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-100")}>
                  {t(k === "pre" ? "maker.pre" : "maker.post")}
                </button>
              ))}
            </div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("matches.search")} aria-label={t("matches.search")} className={cn(inputClass, "pl-9")} />
            </div>
            <ul className="max-h-[52vh] divide-y divide-zinc-800 overflow-y-auto rounded-xl border border-zinc-800">
              {list.length === 0 && <li className="p-6 text-center text-sm text-zinc-400">{t(kind === "post" ? "maker.noFinished" : "matches.empty.none")}</li>}
              {list.map((f) => (
                <li key={f.id}>
                  <button onClick={() => setFixtureId(f.id)} aria-pressed={fixtureId === f.id}
                    className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors", focusRing, fixtureId === f.id ? "bg-emerald-600/15" : "hover:bg-zinc-800/50")}>
                    <TeamCrest name={f.home.name} color={f.home.color} crestUrl={f.home.crestUrl} size={28} flat />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-50">{f.home.name} <span className="font-normal text-zinc-500">{t("common.vs")}</span> {f.away.name}</span>
                    <TeamCrest name={f.away.name} color={f.away.color} crestUrl={f.away.crestUrl} size={28} flat />
                    <span className="hidden w-40 shrink-0 text-right text-xs text-zinc-400 sm:block">
                      <span className="block truncate">{competitionLabel(f.competition, uiLang)}</span>
                      <span>{fmt.day(f.kickoff, false)} · {fmt.time(f.kickoff)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* 2 — options */}
          <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4" aria-labelledby="mk-2">
            <h2 id="mk-2" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-zinc-100"><Step n={2} /> {t("maker.setup")}</h2>

            <Labeled label={t("format.label")}><FormatSwitch value={format} onChange={formatPref.set} /></Labeled>
            <Labeled label={t("maker.language")}>
              <div role="radiogroup" className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
                {(["en", "am"] as const).map((l) => (
                  <button key={l} role="radio" aria-checked={lang === l} onClick={() => { setLang(l); setVoiceName(""); }}
                    className={cn("rounded-md px-3 py-1 text-xs font-semibold", focusRing, lang === l ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-100")}>
                    {l === "en" ? "English" : "አማርኛ"}
                  </button>
                ))}
              </div>
            </Labeled>
            <Labeled label={t("maker.voice")}>
              {voiceList.length > 0 ? (
                <select value={voice?.name ?? ""} onChange={(e) => setVoiceName(e.target.value)} className={inputClass}>
                  {voiceList.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              ) : (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{t(lang === "am" ? "maker.noVoiceAm" : "maker.noVoice")}</p>
              )}
            </Labeled>
            <Labeled label={`${t("maker.speed")} · ${rate.toFixed(2)}×`}>
              <input type="range" min={0.7} max={1.4} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-emerald-500" aria-label={t("maker.speed")} />
            </Labeled>
            <Labeled label={t("maker.anim")}>
              <select value={animMode} onChange={(e) => setAnimMode(e.target.value as AnimMode)} className={inputClass}>
                {(["auto", "slide", "pop", "rise", "fade"] as const).map((a) => <option key={a} value={a}>{t(`maker.anim.${a}` as MsgKey)}</option>)}
              </select>
            </Labeled>

            <Button variant="primary" size="lg" onClick={generate} disabled={!fixture || phase === "working"} className="mt-auto">
              {phase === "working" ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {progress}</> : <><Wand2 className="h-5 w-5" aria-hidden /> {t("maker.generate")}</>}
            </Button>
            {!fixture && <p className="text-xs text-zinc-400">{t("maker.pickFirst")}</p>}
          </section>
        </div>
      )}

      {phase === "edit" && snapshot && (
        <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          {/* stage */}
          <section className="flex flex-col gap-3" aria-label={t("maker.stage")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FormatSwitch value={format} onChange={formatPref.set} />
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", shortsOk ? "bg-emerald-600/20 text-emerald-300" : "bg-amber-500/20 text-amber-300")}>
                ≈ {clock(total)} · {t(shortsOk ? "maker.fitsShorts" : "maker.tooLong")}
              </span>
            </div>
            <div className="mx-auto overflow-hidden rounded-2xl border border-zinc-700 bg-black shadow-xl shadow-black/40" style={{ width: tall ? "min(calc(66vh * 9 / 16), 100%)" : "min(100%, 820px)" }}>
              <MakerStage
                stageRef={stageRef} format={format} cards={cards} currentCardId={player.cardId} caption={player.caption}
                snapshot={snapshot} leaving={player.leaving} anim={player.anim} lang={lang}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {!player.playing ? (
                <Button variant="primary" size="lg" onClick={() => doPlay(0)} disabled={segments.length === 0}><Play className="h-5 w-5" aria-hidden /> {t("maker.play")}</Button>
              ) : (
                <Button size="lg" onClick={recording ? stopRecording : player.stop}><Square className="h-5 w-5" aria-hidden /> {t("maker.stop")}</Button>
              )}
              <Button size="lg" onClick={() => setMute((m) => !m)} aria-pressed={mute} title={t("maker.mute")}>
                {mute ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
              </Button>
              <Button size="lg" onClick={goFullscreen}><Maximize2 className="h-5 w-5" aria-hidden /> {t("maker.fullscreen")}</Button>
              {!recording ? (
                <Button size="lg" onClick={startRecording} disabled={player.playing || segments.length === 0}><Circle className="h-5 w-5 fill-red-500 text-red-500" aria-hidden /> {t("maker.record")}</Button>
              ) : (
                <span className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" aria-hidden /> REC</span>
              )}
            </div>

            {download && (
              <a href={download} download={`preview-${fixture?.home.shortName ?? "match"}-${format}.webm`} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600/15 px-4 py-3 font-semibold text-emerald-300 hover:bg-emerald-600/25">
                <Film className="h-5 w-5" aria-hidden /> {t("maker.download")}
              </a>
            )}
            <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-zinc-400">{t("maker.audioNote")}</p>
          </section>

          {/* script */}
          <section className="min-w-0" aria-labelledby="mk-script">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="mk-script" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-zinc-100"><Sparkles className="h-5 w-5 text-emerald-500" aria-hidden /> {t("maker.script")}</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setSegments((s) => [...s, { id: `seg-${Date.now()}`, cardId: null, text: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden /> {t("maker.addLine")}</Button>
                <Button size="sm" onClick={() => { player.stop(); cleanup(); setPhase("choose"); }}>{t("maker.startOver")}</Button>
              </div>
            </div>
            <p className="mb-3 text-xs text-zinc-400">{t("maker.scriptHint")}</p>
            <ol className="flex flex-col gap-2">
              {segments.map((s, i) => (
                <li key={s.id} className={cn("rounded-xl border p-3 transition-colors", player.idx === i ? "border-emerald-500 bg-emerald-600/10" : "border-zinc-800 bg-zinc-900/40")}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 font-display text-sm font-bold text-zinc-200">{i + 1}</span>
                    <select value={s.cardId ?? ""} onChange={(e) => setSeg(i, { cardId: e.target.value || null })} aria-label={t("maker.graphic")} className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100">
                      <option value="">{t("maker.noGraphic")}</option>
                      {cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    <span className="text-xs tabular-nums text-zinc-500">{clock(estimateMs(s.text, lang, rate))}</span>
                    <Button size="sm" onClick={() => doPlay(i)} aria-label={t("maker.playFrom")}><Play className="h-3.5 w-3.5" aria-hidden /></Button>
                    <Button size="sm" onClick={() => moveSeg(i, -1)} disabled={i === 0} aria-label="↑"><ArrowUp className="h-3.5 w-3.5" aria-hidden /></Button>
                    <Button size="sm" onClick={() => moveSeg(i, 1)} disabled={i === segments.length - 1} aria-label="↓"><ArrowDown className="h-3.5 w-3.5" aria-hidden /></Button>
                    <Button size="sm" variant="danger" onClick={() => setSegments((x) => x.filter((_, k) => k !== i))} aria-label={t("maker.removeLine")}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  </div>
                  <textarea value={s.text} onChange={(e) => setSeg(i, { text: e.target.value })} rows={Math.min(5, Math.max(2, Math.ceil(s.text.length / 70)))} lang={lang}
                    className={cn(inputClass, "resize-y leading-relaxed")} aria-label={t("maker.line", { n: i + 1 })} />
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 font-display text-base font-bold text-white" aria-hidden>{n}</span>;
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</div>
      {children}
    </div>
  );
}

function fallbackSnapshot(f: Fixture, kind: ShowKind): MatchSnapshot {
  return {
    matchId: f.id, competition: f.competition, home: { ...f.home, crestUrl: f.home.crestUrl ?? undefined }, away: { ...f.away, crestUrl: f.away.crestUrl ?? undefined }, score: { home: 0, away: 0 },
    period: kind === "post" ? "FT" : "NS", minute: 0, status: kind === "post" ? "ft" : "scheduled", kickoff: f.kickoff,
    stats: {}, providerUpdatedAt: new Date().toISOString(), receivedAt: new Date().toISOString(), freshness: "fresh",
  };
}
