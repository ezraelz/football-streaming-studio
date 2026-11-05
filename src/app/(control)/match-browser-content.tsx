"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarX2, ChevronLeft, ChevronRight, Film, Play, Search, Star } from "lucide-react";
import { api, type Fixture } from "@/lib/api/client";
import type { ShowProfile, ShowSession } from "@/lib/types/types";
import { useShowStore } from "@/lib/stores/show-store";
import { cn } from "@/lib/utility/utils";
import { Button, focusRing } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { inputClass } from "@/components/ui/form";
import { useI18n, useT, type TFn } from "@/lib/i18n";
import { useFormat } from "@/lib/i18n/use-format";
import { TeamCrest } from "@/components/overlay/crest";
import { LeagueBadge } from "@/components/overlay/league-badge";
import { competitionLabel, themeFor, DEFAULT_THEME } from "@/lib/branding/leagues";

/* ---------- config & types ---------- */

type CommentaryMode = ReturnType<typeof useShowStore.getState>["commentaryMode"];
const DEFAULT_MODE = "approval" as unknown as CommentaryMode;
const STATUS_ORDER: Record<string, number> = { live: 0, scheduled: 1, ft: 2 };

type Scope = "day" | "week" | "month";

const PIN_KEY = "studio.pinnedLeagues";
/** First visit: pin the Ethiopian league so local fixtures are always on top. */
const DEFAULT_PINS = ["ethiopian-premier-league"];

/* ---------- date helpers (all in the viewer's LOCAL calendar, never UTC) ---------- */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (v: string) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };

function boundsFor(anchor: Date, scope: Scope): { from: Date; to: Date } {
  const d = startOfDay(anchor);
  if (scope === "day") return { from: d, to: addDays(d, 1) };
  if (scope === "week") return { from: d, to: addDays(d, 7) };
  return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: addMonths(d, 1) };
}

const leagueKey = (f: Fixture) => {
  const th = themeFor(f.competition);
  return th.id !== DEFAULT_THEME.id ? th.id : f.leagueId || f.competition || "other";
};

function usePinned() {
  const [pins, setPins] = useState<string[]>(DEFAULT_PINS);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PIN_KEY);
      if (raw) setPins(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  const toggle = useCallback((key: string) => {
    setPins((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { window.localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { pins, toggle };
}

const byKickoff = (a: Fixture, b: Fixture) => {
  const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
  return s !== 0 ? s : new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
};

interface LeagueGroup { key: string; name: string; fixtures: Fixture[]; live: number }

/* ---------- main component ---------- */

export function MatchBrowserContent() {
  const t = useT();
  const { lang } = useI18n();
  const fmt = useFormat();
  const router = useRouter();
  const preferredProfile = useRef(useSearchParams().get("profile"));
  const { pins, toggle: togglePin } = usePinned();

  const [today] = useState(() => startOfDay(new Date()));
  const [anchor, setAnchor] = useState<Date>(today);
  const [scope, setScope] = useState<Scope>("day");
  const [liveOnly, setLiveOnly] = useState(false);
  const [league, setLeague] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [profiles, setProfiles] = useState<ShowProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<ShowSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const bounds = useMemo(() => (liveOnly ? boundsFor(today, "day") : boundsFor(anchor, scope)), [anchor, scope, liveOnly, today]);
  const boundsKey = `${isoDay(bounds.from)}|${isoDay(bounds.to)}`;

  // Profiles and the running session load once.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listProfiles(), api.listSessions("live,paused,degraded")])
      .then(([p, sessions]) => {
        if (cancelled) return;
        setProfiles(p);
        setProfileId(p.find((x) => x.id === preferredProfile.current)?.id ?? p[0]?.id ?? "");
        setActiveSession(sessions[0] ?? null);
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : t("matches.err.load")); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fixtures reload whenever you move to a different date range (one day either side as a margin).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.fixtures({ from: isoDay(addDays(bounds.from, -1)), to: isoDay(addDays(bounds.to, 1)) })
      .then((f) => { if (!cancelled) { setFixtures(f); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : t("matches.err.load")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  const q = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (f: Fixture) => !q || [f.home.name, f.away.name, f.competition].some((x) => x?.toLowerCase().includes(q)),
    [q],
  );

  /** Everything in the chosen range (before the league filter, so the pills show true counts). */
  const inWindow = useMemo(() => {
    return fixtures.filter((f) => {
      if (!matchesSearch(f)) return false;
      if (liveOnly) return f.status === "live";
      const k = new Date(f.kickoff);
      if (!(k >= bounds.from && k < bounds.to)) return false;
      // Longer ranges are for planning: hide results that are already over (but keep today's).
      if (scope !== "day" && f.status === "ft" && startOfDay(k) < today) return false;
      return true;
    });
  }, [fixtures, matchesSearch, liveOnly, bounds, scope, today]);

  const liveCount = useMemo(() => fixtures.filter((f) => f.status === "live").length, [fixtures]);

  const leagues = useMemo<LeagueGroup[]>(() => {
    const map = new Map<string, LeagueGroup>();
    for (const f of inWindow) {
      const key = leagueKey(f);
      const g = map.get(key) ?? { key, name: f.competition || t("matches.otherFixtures"), fixtures: [], live: 0 };
      g.fixtures.push(f);
      if (f.status === "live") g.live += 1;
      map.set(key, g);
    }
    const arr = Array.from(map.values());
    arr.forEach((g) => g.fixtures.sort(byKickoff));
    arr.sort((a, b) => {
      const pa = pins.includes(a.key) ? 0 : 1;
      const pb = pins.includes(b.key) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (!!b.live !== !!a.live) return b.live - a.live;
      return new Date(a.fixtures[0].kickoff).getTime() - new Date(b.fixtures[0].kickoff).getTime();
    });
    return arr;
  }, [inWindow, pins, t]);

  // If the chosen league has nothing in this range, fall back to "all" instead of an empty page.
  const activeLeague = league !== "all" && leagues.some((g) => g.key === league) ? league : "all";
  const shownLeagues = useMemo(() => (activeLeague === "all" ? leagues : leagues.filter((g) => g.key === activeLeague)), [leagues, activeLeague]);
  const shownCount = shownLeagues.reduce((n, g) => n + g.fixtures.length, 0);

  // ── navigation ──────────────────────────────────────────────────────────────────────────
  const step = (dir: -1 | 1) => setAnchor((a) => (scope === "day" ? addDays(a, dir) : scope === "week" ? addDays(a, 7 * dir) : addMonths(a, dir)));
  const title =
    scope === "day" ? fmt.day(anchor)
    : scope === "week" ? `${fmt.day(anchor, false)} – ${fmt.day(addDays(anchor, 6), false)}`
    : fmt.month(anchor);
  const atToday = startOfDay(anchor).getTime() === today.getTime();

  // ── session actions ───────────────────────────────────────────────────────────────────────
  const resetStore = useCallback((session: ShowSession) => {
    useShowStore.setState({ session, overlayToken: session.overlay_token, snapshot: null, events: [], suggestions: [], transcript: [] });
  }, []);

  const resume = async () => {
    if (!activeSession || resuming) return;
    setResuming(true);
    setError(null);
    try {
      let session = activeSession;
      if (session.state !== "live") session = await api.transition(session.id, "live");
      resetStore(session);
      router.push(`/studio/${session.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("matches.err.resume"));
      setResuming(false);
    }
  };

  const startShow = async (fixtureId: string) => {
    const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
    if (!profile) { setError(t("matches.err.noProfile")); return; }
    setStarting(fixtureId);
    setError(null);
    try {
      let session = await api.createSession(profile.id, fixtureId);
      session = await api.transition(session.id, "armed");
      session = await api.transition(session.id, "live");
      const cfg = (profile.commentary_config ?? {}) as unknown as { mode?: string; voice?: string; language?: string };
      resetStore(session);
      useShowStore.setState({
        commentaryMode: (cfg.mode as unknown as CommentaryMode | undefined) ?? DEFAULT_MODE,
        voice: cfg.voice ?? "en-US-Neural-A",
        language: cfg.language ?? "en",
      });
      router.push(`/studio/${session.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("matches.err.start"));
      setStarting(null);
    }
  };

  const activeFixture = activeSession ? fixtures.find((f) => f.id === activeSession.match_id) : undefined;
  const activeProfile = profiles.find((p) => p.id === profileId);
  const clearFilters = () => { setLiveOnly(false); setLeague("all"); setSearch(""); setScope("month"); setAnchor(today); };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <PageHeader
        title={t("matches.title")}
        description={t("matches.description")}
        icon="matches"
        actions={!loading && <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300">{t("matches.summary", { n: shownCount, m: shownLeagues.length })}</span>}
      />

      {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {activeSession && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-700/50 bg-emerald-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-100">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t("matches.stillRunning")}
              <Badge tone="success">{t(`state.${activeSession.state}` as const)}</Badge>
            </p>
            <p className="mt-1 truncate text-base font-semibold text-zinc-50">
              {activeFixture ? `${activeFixture.home.name} ${t("common.vs")} ${activeFixture.away.name}` : t("matches.matchId", { id: activeSession.match_id })}
            </p>
          </div>
          <Button variant="primary" size="lg" onClick={resume} loading={resuming}>
            {resuming ? t("matches.resuming") : t("matches.resume")}
            {!resuming && <ChevronRight className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      )}

      {/* ── Filters: one date bar, one row of leagues ─────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {/* date navigator */}
          <div className={cn("flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1", liveOnly && "pointer-events-none opacity-40")}>
            <button onClick={() => step(-1)} aria-label={t("matches.prev")} className={cn("rounded-lg p-2 text-zinc-300 hover:bg-zinc-800", focusRing)}><ChevronLeft className="h-5 w-5" aria-hidden /></button>
            <label className="relative flex min-w-[11rem] cursor-pointer flex-col items-center px-2 text-center" title={t("matches.pickDate")}>
              <span className="font-display text-lg font-bold leading-tight text-zinc-50">{title}</span>
              <input
                type="date"
                value={isoDay(anchor)}
                onChange={(e) => e.target.value && setAnchor(fromIso(e.target.value))}
                aria-label={t("matches.pickDate")}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <button onClick={() => step(1)} aria-label={t("matches.next")} className={cn("rounded-lg p-2 text-zinc-300 hover:bg-zinc-800", focusRing)}><ChevronRight className="h-5 w-5" aria-hidden /></button>
          </div>

          <Button size="md" onClick={() => { setAnchor(today); setLiveOnly(false); }} disabled={atToday && !liveOnly}>{t("time.today")}</Button>

          <div role="radiogroup" aria-label={t("matches.scope")} className={cn("inline-flex rounded-lg bg-zinc-900/60 p-0.5", liveOnly && "pointer-events-none opacity-40")}>
            {(["day", "week", "month"] as const).map((sc) => (
              <button key={sc} role="radio" aria-checked={scope === sc} onClick={() => setScope(sc)}
                className={cn("rounded-md px-3 py-1.5 text-sm font-semibold transition-colors", focusRing, scope === sc ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-100")}>
                {t(`matches.scope.${sc}` as const)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setLiveOnly((v) => !v)}
            aria-pressed={liveOnly}
            className={cn("ml-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors", focusRing,
              liveOnly ? "border-red-500 bg-red-600 text-white" : "border-zinc-700 text-zinc-300 hover:border-red-500/60")}
          >
            <span className={cn("h-2 w-2 rounded-full", liveOnly ? "bg-white" : "animate-pulse bg-red-500 motion-reduce:animate-none")} aria-hidden />
            {t("common.live")}
            <span className={cn("rounded px-1.5 text-xs tabular-nums", liveOnly ? "bg-black/25" : "bg-zinc-800 text-zinc-300")}>{liveCount}</span>
          </button>
        </div>

        {/* leagues */}
        <div className="flex items-center gap-2">
          <div role="group" aria-label={t("matches.leagues")} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1">
            <Pill active={activeLeague === "all"} onClick={() => setLeague("all")}>{t("matches.allLeagues")}<Count n={inWindow.length} /></Pill>
            {leagues.map((g) => {
              const th = themeFor(g.name);
              return (
                <Pill key={g.key} active={activeLeague === g.key} onClick={() => setLeague(activeLeague === g.key ? "all" : g.key)}>
                  <LeagueBadge theme={th} size={20} />
                  <span className="max-w-[9rem] truncate">{competitionLabel(g.name, lang)}</span>
                  {g.live > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" aria-label={t("common.live")} />}
                  <Count n={g.fixtures.length} />
                </Pill>
              );
            })}
          </div>
          <div className="relative hidden w-52 shrink-0 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
            <input type="search" aria-label={t("matches.search")} placeholder={t("matches.search")} value={search} onChange={(e) => setSearch(e.target.value)} className={cn(inputClass, "py-1.5 pl-9")} />
          </div>
        </div>

        {/* which profile the show will use — always visible, never a surprise */}
        {!loading && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-zinc-400">{t("matches.startingWith")}</span>
            {profiles.length === 0 ? (
              <Link href="/shows" className="font-medium text-emerald-400 hover:text-emerald-300">{t("matches.createProfile")}</Link>
            ) : profiles.length === 1 ? (
              <span className="font-medium text-zinc-100">{activeProfile?.name}</span>
            ) : (
              <select aria-label={t("matches.profileAria")} value={profileId} onChange={(e) => setProfileId(e.target.value)} className={cn(inputClass, "w-auto py-1")}>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {profiles.length > 0 && <Link href="/shows" className="text-xs text-zinc-400 hover:text-zinc-100">{t("matches.manageProfiles")}</Link>}
          </div>
        )}
      </div>

      {/* ── Fixtures ─────────────────────────────────────────────────────────────────── */}
      <main className="space-y-5" aria-busy={loading}>
        {loading ? (
          <LoadingList label={t("matches.loading")} />
        ) : shownCount === 0 ? (
          <EmptyState
            icon={<CalendarX2 className="h-7 w-7" />}
            title={search ? t("matches.empty.search", { q: search }) : liveOnly ? t("matches.empty.live") : scope === "day" ? t("matches.empty.day") : t("matches.empty.none")}
            description={t("matches.empty.tryOther")}
            action={<Button onClick={clearFilters}>{t("matches.showMonth")}</Button>}
          />
        ) : (
          shownLeagues.map((g) => (
            <section key={g.key} aria-labelledby={`lg-${g.key}`}>
              <LeagueHeader id={`lg-${g.key}`} name={g.name} lang={lang} count={g.fixtures.length} live={g.live} pinned={pins.includes(g.key)} onPin={() => togglePin(g.key)} t={t} />
              <ul className="divide-y divide-zinc-800 overflow-hidden rounded-b-xl border-x border-b border-zinc-800 bg-zinc-900/40">
                {g.fixtures.map((f) => (
                  <FixtureRow
                    key={f.id}
                    fixture={f}
                    t={t}
                    time={fmt.time(f.kickoff)}
                    day={!liveOnly && scope !== "day" ? fmt.day(f.kickoff, false) : undefined}
                    starting={starting === f.id}
                    disabled={starting !== null || profiles.length === 0}
                    onStart={() => startShow(f.id)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors", focusRing,
        active ? "border-emerald-500 bg-emerald-600 text-white" : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-50")}
    >
      {children}
    </button>
  );
}
const Count = ({ n }: { n: number }) => <span className="rounded bg-black/25 px-1.5 text-xs tabular-nums opacity-90">{n}</span>;

/* ---------- league header ---------- */

function LeagueHeader({
  id, name, lang, count, live, pinned, onPin, t,
}: { id: string; name: string; lang: "en" | "am"; count: number; live: number; pinned: boolean; onPin: () => void; t: TFn }) {
  const th = themeFor(name);
  return (
    <div
      className="flex items-center gap-3 rounded-t-xl border border-zinc-800 px-4 py-2.5"
      style={{ background: `linear-gradient(100deg, ${th.primary}, ${th.secondary})`, borderBottom: `3px solid ${th.accent}` }}
    >
      <LeagueBadge theme={th} size={34} />
      <h3 id={id} className="min-w-0 flex-1 truncate font-display text-lg font-bold uppercase tracking-wide text-white">{competitionLabel(name, lang)}</h3>
      {live > 0 && <span className="flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />{live} {t("common.live")}</span>}
      <span className="rounded bg-black/30 px-2 py-0.5 text-xs font-semibold tabular-nums text-white/90">{count === 1 ? t("matches.countOne") : t("matches.count", { n: count })}</span>
      <button onClick={onPin} aria-label={pinned ? t("matches.unpin") : t("matches.pin")} title={pinned ? t("matches.unpin") : t("matches.pin")} className={cn("rounded p-1 text-white/80 hover:text-amber-300", focusRing)}>
        <Star className="h-4 w-4" fill={pinned ? "#fbbf24" : "none"} stroke={pinned ? "#fbbf24" : "currentColor"} aria-hidden />
      </button>
    </div>
  );
}

/* ---------- pieces ---------- */

function FixtureRow({
  fixture, t, time, day, starting, disabled, onStart,
}: {
  fixture: Fixture;
  t: TFn;
  time: string;
  day?: string;
  starting: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const isLive = fixture.status === "live";
  const isFinished = fixture.status === "ft";
  const missing = Object.entries(fixture.coverage ?? {}).filter(([, ok]) => !ok).map(([k]) => k);

  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-l-2 p-4 transition-colors hover:bg-zinc-900/80 sm:grid-cols-[4.5rem_1fr_auto] sm:px-5",
        isLive ? "border-l-red-500" : "border-l-transparent",
      )}
    >
      {/* When */}
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:flex-col sm:items-start sm:gap-1">
        {isLive ? (
          <Badge tone="live" className="gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400 motion-reduce:animate-none" aria-hidden />
            {t("common.live")}
          </Badge>
        ) : isFinished ? (
          <span className="text-sm font-medium text-zinc-400">{t("matches.fullTime")}</span>
        ) : (
          <div className="flex flex-col">
            <time dateTime={fixture.kickoff} className="font-display text-xl font-bold leading-none tabular-nums text-zinc-100">
              {time}
            </time>
            {day && <span className="mt-1 text-[11px] font-medium text-zinc-400">{day}</span>}
          </div>
        )}
        {missing.length > 0 && (
          <span title={t("matches.limitedHint", { list: missing.join(", ") })}>
            <Badge tone="warn">{t("matches.limited")}</Badge>
          </span>
        )}
      </div>

      {/* Who */}
      <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
        <TeamLine team={fixture.home} />
        <span className="text-xs font-medium uppercase text-zinc-500">{t("common.vs")}</span>
        <TeamLine team={fixture.away} align="right" />
      </div>

      <div className="col-span-2 flex shrink-0 items-center justify-end gap-2 sm:col-span-1">
      <Link
        href={`/maker?match=${fixture.id}&kind=${isFinished ? "post" : "pre"}`}
        className={cn("hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 sm:flex", focusRing)}
        title={t("maker.fromRow")}
        aria-label={t("maker.fromRow")}
      >
        <Film className="h-4 w-4" aria-hidden />
      </Link>
      <Button
        variant={isFinished ? "secondary" : "primary"}
        onClick={onStart}
        disabled={disabled}
        loading={starting}
        aria-label={t("matches.startAria", { home: fixture.home.name, away: fixture.away.name })}
        className="whitespace-nowrap"
      >
        {!starting && <Play className="h-3.5 w-3.5" aria-hidden />}
        {starting ? t("matches.starting") : t("matches.startShow")}
      </Button>
      </div>
    </li>
  );
}

function TeamLine({ team, align = "left" }: { team: Fixture["home"]; align?: "left" | "right" }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${
        align === "right" ? "flex-col-reverse text-center sm:flex-row-reverse sm:text-right" : "flex-col text-center sm:flex-row sm:text-left"
      }`}
    >
      <div className="h-9 w-9 shrink-0">
        {/* provider crest → /crests/<slug>.svg → original generated crest */}
        <TeamCrest name={team.name} color={team.color || "#3f3f46"} crestUrl={team.crestUrl} size={36} flat />
      </div>
      <span className="min-w-0 truncate text-sm font-medium text-zinc-100 sm:text-base">{team.name}</span>
    </div>
  );
}

function LoadingList({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-label={label}>
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
    </div>
  );
}
