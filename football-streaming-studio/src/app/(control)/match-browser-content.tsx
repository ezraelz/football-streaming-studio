"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarX2, ChevronRight, Play, Search, Star } from "lucide-react";
import { api, type Fixture } from "@/lib/api/client";
import type { ShowProfile, ShowSession } from "@/lib/types/types";
import { useShowStore } from "@/lib/stores/show-store";
import { cn } from "@/lib/utility/utils";
import { Button, focusRing } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { inputClass } from "@/components/ui/form";
import { ResizeHandle, useResizableSize } from "@/components/ui/resizable";
import { useI18n, useT, type TFn } from "@/lib/i18n";
import { useFormat } from "@/lib/i18n/use-format";
import { TeamCrest } from "@/components/overlay/crest";
import { LeagueBadge } from "@/components/overlay/league-badge";
import { competitionLabel, themeFor, DEFAULT_THEME } from "@/lib/branding/leagues";

/* ---------- config & types ---------- */

type CommentaryMode = ReturnType<typeof useShowStore.getState>["commentaryMode"];
const DEFAULT_MODE = "approval" as unknown as CommentaryMode;
const STATUS_ORDER: Record<string, number> = { live: 0, scheduled: 1, ft: 2 };

/** What the date strip is showing. `day:YYYY-MM-DD` is a single calendar day. */
type Range = "live" | "week" | "month" | "next-month" | "all" | `day:${string}`;
type GroupBy = "league" | "day";

const PIN_KEY = "studio.pinnedLeagues";
/** First visit: pin the Ethiopian league so local fixtures are always on top. */
const DEFAULT_PINS = ["ethiopian-premier-league"];

// --- Simplified Date Helpers ---
const isoDay = (d: Date) => {
  // Use local time to build the YYYY-MM-DD string
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, n: number) => { 
  const x = new Date(d); 
  x.setDate(x.getDate() + n); 
  return x; 
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// --- Simplified Range Logic ---
function inRange(f: Fixture, range: Range, now: Date) {
  if (range === "live") return f.status === "live";
  if (range === "all") return true;

  // Convert the match kickoff (UTC) to a local YYYY-MM-DD string
  const kickoffDate = new Date(f.kickoff);
  const kickoffDayStr = isoDay(kickoffDate);

  if (range.startsWith("day:")) {
    const targetDay = range.slice(4);
    return kickoffDayStr === targetDay;
  }

  if (range === "week") {
    const from = isoDay(startOfDay(now));
    const to = isoDay(addDays(startOfDay(now), 7));
    return kickoffDayStr >= from && kickoffDayStr <= to;
  }

  if (range === "month") {
    const from = isoDay(startOfDay(now));
    const to = isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)); // Last day of this month
    return kickoffDayStr >= from && kickoffDayStr <= to;
  }

  if (range === "next-month") {
    const from = isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const to = isoDay(new Date(now.getFullYear(), now.getMonth() + 2, 0));
    return kickoffDayStr >= from && kickoffDayStr <= to;
  }

  return true;
}

const leagueKey = (f: Fixture) => {
  const th = themeFor(f.competition);
  return th.id !== DEFAULT_THEME.id ? th.id : f.leagueId || f.competition || "other";
};

function usePinned() {
  const [pins, setPins] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_PINS;
    try {
      const raw = window.localStorage.getItem(PIN_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return DEFAULT_PINS;
  });
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
  const rail = useResizableSize("matches-rail", 280, 200, 460);
  const { pins, toggle: togglePin } = usePinned();

  const [now] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [profiles, setProfiles] = useState<ShowProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<ShowSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const [range, setRange] = useState<Range>("month");
  const [league, setLeague] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("league");

  useEffect(() => {
    let cancelled = false;
    // Ask backend for a wide window to be safe.
    // We ask for yesterday up to 2 months from now.
    const from = isoDay(addDays(startOfDay(new Date()), -1));
    const to = isoDay(new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1));
    
    Promise.all([api.fixtures({ from, to }), api.listProfiles(), api.listSessions("live,paused,degraded")])
      .then(([f, p, sessions]) => {
        if (cancelled) return;
        setFixtures(f);
        setProfiles(p);
        setProfileId(p.find((x) => x.id === preferredProfile.current)?.id ?? p[0]?.id ?? "");
        setActiveSession(sessions[0] ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("matches.err.load"));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const q = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (f: Fixture) => !q || [f.home.name, f.away.name, f.competition].some((x) => x?.toLowerCase().includes(q)),
    [q],
  );

  /** Fixtures in the chosen date range + search (before the league filter, so the rail shows true counts). */
  const inWindow = useMemo(() => fixtures.filter((f) => inRange(f, range, now) && matchesSearch(f)), [fixtures, range, now, matchesSearch]);

  /** Date-chip counts (respect search + league, so a chip never promises matches the list will hide). */
  const chipCount = useCallback(
    (r: Range) => fixtures.filter((f) => inRange(f, r, now) && matchesSearch(f) && (league === "all" || leagueKey(f) === league)).length,
    [fixtures, now, matchesSearch, league],
  );

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

  const shown = useMemo(() => (league === "all" ? inWindow : inWindow.filter((f) => leagueKey(f) === league)), [inWindow, league]);
  const shownLeagues = useMemo(() => (league === "all" ? leagues : leagues.filter((g) => g.key === league)), [leagues, league]);

  /** By-day grouping: day → league → fixtures. */
  const byDay = useMemo(() => {
    const days = new Map<string, { key: string; date: Date; leagues: LeagueGroup[] }>();
    for (const f of shown.slice().sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())) {
      const d = new Date(f.kickoff);
      const dk = d.toDateString();
      const day = days.get(dk) ?? { key: dk, date: d, leagues: [] };
      const lk = leagueKey(f);
      let g = day.leagues.find((x) => x.key === lk);
      if (!g) { g = { key: lk, name: f.competition || t("matches.otherFixtures"), fixtures: [], live: 0 }; day.leagues.push(g); }
      g.fixtures.push(f);
      days.set(dk, day);
    }
    return Array.from(days.values());
  }, [shown, t]);

  const liveNow = useMemo(() => fixtures.filter((f) => f.status === "live" && matchesSearch(f)), [fixtures, matchesSearch]);

  /* date strip: Live · Today · Tomorrow · next weekdays · week · month · next month · all */
  const dayChips = useMemo(() => {
    const today = startOfDay(now);
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, [now]);

  const resetStore = useCallback((session: ShowSession) => {
    useShowStore.setState({
      session,
      overlayToken: session.overlay_token,
      snapshot: null,
      events: [],
      suggestions: [],
      transcript: [],
    });
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
    if (!profile) {
      setError(t("matches.err.noProfile"));
      return;
    }
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

  const clearFilters = () => { setRange("all"); setLeague("all"); setSearch(""); };

  const renderRows = (list: Fixture[], showDay: boolean) => (
    <ul className="divide-y divide-zinc-800 overflow-hidden rounded-b-xl border-x border-b border-zinc-800 bg-zinc-900/40">
      {list.map((f) => (
        <FixtureRow
          key={f.id}
          fixture={f}
          t={t}
          time={fmt.time(f.kickoff)}
          day={showDay ? fmt.day(f.kickoff, false) : undefined}
          starting={starting === f.id}
          disabled={starting !== null || profiles.length === 0}
          onStart={() => startShow(f.id)}
        />
      ))}
    </ul>
  );

  const monthLabel = fmt.month(now);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <PageHeader
        title={t("matches.title")}
        description={t("matches.description")}
        icon="matches"
        actions={
          !loading && (
            <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-zinc-300">
              {t("matches.summary", { n: shown.length, m: shownLeagues.length })}
            </span>
          )
        }
      />

      {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* Resume — the most likely thing you want when a show is already running */}
      {activeSession && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-700/50 bg-emerald-950/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
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

      {/* Date strip + search */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label={t("matches.dates")} className="flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto pb-1">
            <Chip active={range === "live"} onClick={() => setRange("live")} tone="live" count={chipCount("live")}>
              <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" aria-hidden />
              {t("common.live")}
            </Chip>
            {dayChips.map((d, i) => {
              const key = `day:${isoDay(d)}` as Range;
              const parts = fmt.chip(d);
              return (
                <Chip key={key} active={range === key} onClick={() => setRange(key)} count={chipCount(key)} stacked>
                  <span className="text-[11px] font-medium uppercase opacity-80">{i === 0 ? t("time.today") : i === 1 ? t("time.tomorrow") : parts.weekday}</span>
                  <span className="text-base font-bold leading-none">{parts.day}</span>
                  <span className="text-[10px] opacity-70">{parts.month}</span>
                </Chip>
              );
            })}
            <span className="mx-1 w-px shrink-0 bg-zinc-700" aria-hidden />
            <Chip active={range === "week"} onClick={() => setRange("week")} count={chipCount("week")}>{t("matches.range.week")}</Chip>
            <Chip active={range === "month"} onClick={() => setRange("month")} count={chipCount("month")}>{t("matches.range.month")}</Chip>
            <Chip active={range === "next-month"} onClick={() => setRange("next-month")} count={chipCount("next-month")}>{t("matches.range.nextMonth")}</Chip>
            <Chip active={range === "all"} onClick={() => setRange("all")} count={chipCount("all")}>{t("matches.range.all")}</Chip>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
            <input
              type="search"
              aria-label={t("matches.search")}
              placeholder={t("matches.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "pl-9")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">{t("matches.groupBy")}</span>
            <div role="radiogroup" aria-label={t("matches.groupBy")} className="inline-flex rounded-lg bg-zinc-950/60 p-0.5">
              {(["league", "day"] as const).map((g) => (
                <button
                  key={g}
                  role="radio"
                  aria-checked={groupBy === g}
                  onClick={() => setGroupBy(g)}
                  className={cn("rounded-md px-3 py-1 text-xs font-semibold transition-colors", focusRing, groupBy === g ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-100")}
                >
                  {t(g === "league" ? "matches.groupLeague" : "matches.groupDay")}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-zinc-500">{range === "month" || range === "next-month" ? monthLabel : ""}</span>

          {/* Which profile will the show use? Always visible, never a surprise. */}
          {!loading && (
            <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
      </div>

      <div className="flex min-h-0 flex-col gap-4 lg:flex-row lg:gap-0">
        {/* League rail (resizable) */}
        <aside className="shrink-0 lg:sticky lg:top-0 lg:self-start" style={{ width: undefined }}>
          <div className="hidden lg:block" style={{ width: rail.size }}>
            <LeagueRail
              t={t}
              lang={lang}
              leagues={leagues}
              total={inWindow.length}
              selected={league}
              onSelect={setLeague}
              pins={pins}
              onPin={togglePin}
            />
          </div>
          {/* Mobile: a simple select */}
          <div className="lg:hidden">
            <select aria-label={t("matches.leagues")} value={league} onChange={(e) => setLeague(e.target.value)} className={inputClass}>
              <option value="all">{t("matches.allLeagues")} ({inWindow.length})</option>
              {leagues.map((g) => <option key={g.key} value={g.key}>{competitionLabel(g.name, lang)} ({g.fixtures.length})</option>)}
            </select>
          </div>
        </aside>

        <ResizeHandle
          className="hidden lg:block"
          value={rail.size}
          min={rail.min}
          max={rail.max}
          onChange={rail.setSize}
          onReset={rail.reset}
          label={t("resize.rail")}
        />

        {/* Fixtures */}
        <main className="min-w-0 flex-1 space-y-6 lg:pl-3" aria-busy={loading}>
          {loading ? (
            <LoadingList label={t("matches.loading")} />
          ) : (
            <>
              {range !== "live" && liveNow.length > 0 && (
                <section aria-labelledby="live-now">
                  <h2 id="live-now" className="mb-2 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-red-400">
                    <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" aria-hidden />
                    {t("matches.liveNow")} · {liveNow.length}
                  </h2>
                  <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-red-500/40 bg-red-500/5">
                    {liveNow.map((f) => (
                      <FixtureRow key={f.id} fixture={f} t={t} time={fmt.time(f.kickoff)} starting={starting === f.id} disabled={starting !== null || profiles.length === 0} onStart={() => startShow(f.id)} />
                    ))}
                  </ul>
                </section>
              )}

              {shown.length === 0 ? (
                <EmptyState
                  icon={<CalendarX2 className="h-7 w-7" />}
                  title={
                    search ? t("matches.empty.search", { q: search })
                    : range === "live" ? t("matches.empty.live")
                    : range.startsWith("day:") ? t("matches.empty.today")
                    : t("matches.empty.none")
                  }
                  description={fixtures.length > 0 ? t("matches.empty.tryOther") : t("matches.empty.sync")}
                  action={fixtures.length > 0 ? <Button onClick={clearFilters}>{t("matches.showAll")}</Button> : undefined}
                />
              ) : groupBy === "league" ? (
                shownLeagues.map((g) => (
                  <section key={g.key} aria-labelledby={`lg-${g.key}`}>
                    <LeagueHeader
                      id={`lg-${g.key}`}
                      name={g.name}
                      lang={lang}
                      count={g.fixtures.length}
                      live={g.live}
                      pinned={pins.includes(g.key)}
                      onPin={() => togglePin(g.key)}
                      t={t}
                    />
                    {renderRows(g.fixtures, !range.startsWith("day:"))}
                  </section>
                ))
              ) : (
                byDay.map((day) => (
                  <section key={day.key} aria-labelledby={`day-${day.key}`} className="space-y-4">
                    <h2 id={`day-${day.key}`} className="border-b border-zinc-800 pb-1 font-display text-xl font-bold uppercase tracking-wide text-zinc-50">
                      {fmt.day(day.date)}
                    </h2>
                    {day.leagues.map((g) => (
                      <div key={g.key}>
                        <LeagueHeader id={`d-${day.key}-${g.key}`} name={g.name} lang={lang} count={g.fixtures.length} live={0} pinned={pins.includes(g.key)} onPin={() => togglePin(g.key)} t={t} />
                        {renderRows(g.fixtures, false)}
                      </div>
                    ))}
                  </section>
                ))
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------- league rail & headers ---------- */

function LeagueRail({
  t, lang, leagues, total, selected, onSelect, pins, onPin,
}: {
  t: TFn; lang: "en" | "am"; leagues: LeagueGroup[]; total: number;
  selected: string; onSelect: (k: string) => void; pins: string[]; onPin: (k: string) => void;
}) {
  const pinned = leagues.filter((g) => pins.includes(g.key));
  const rest = leagues.filter((g) => !pins.includes(g.key));
  const row = (g: LeagueGroup) => {
    const th = themeFor(g.name);
    const active = selected === g.key;
    return (
      <li key={g.key} className="group relative">
        <button
          onClick={() => onSelect(active ? "all" : g.key)}
          aria-pressed={active}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg py-2 pl-2 pr-9 text-left text-sm transition-colors",
            focusRing,
            active ? "bg-emerald-600/20 text-zinc-50 ring-1 ring-emerald-600/50" : "text-zinc-300 hover:bg-zinc-800/60",
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center"><LeagueBadge theme={th} size={26} /></span>
          <span className="min-w-0 flex-1 truncate font-medium">{competitionLabel(g.name, lang)}</span>
          {g.live > 0 && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" aria-label={t("common.live")} />}
          <span className="shrink-0 text-xs tabular-nums text-zinc-500">{g.fixtures.length}</span>
        </button>
        <button
          onClick={() => onPin(g.key)}
          aria-label={pins.includes(g.key) ? t("matches.unpin") : t("matches.pin")}
          title={pins.includes(g.key) ? t("matches.unpin") : t("matches.pin")}
          className={cn("absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity", focusRing, pins.includes(g.key) ? "text-amber-400" : "text-zinc-600 opacity-0 hover:text-amber-300 focus:opacity-100 group-hover:opacity-100")}
        >
          <Star className="h-3.5 w-3.5" fill={pins.includes(g.key) ? "currentColor" : "none"} aria-hidden />
        </button>
      </li>
    );
  };
  return (
    <nav aria-label={t("matches.leagues")} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2">
      <h2 className="px-2 pb-2 pt-1 font-display text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">{t("matches.leagues")}</h2>
      <button
        onClick={() => onSelect("all")}
        aria-pressed={selected === "all"}
        className={cn("mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors", focusRing, selected === "all" ? "bg-emerald-600/20 text-zinc-50 ring-1 ring-emerald-600/50" : "text-zinc-300 hover:bg-zinc-800/60")}
      >
        {t("matches.allLeagues")}<span className="text-xs tabular-nums text-zinc-500">{total}</span>
      </button>
      {pinned.length > 0 && (
        <>
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">{t("matches.pinned")}</div>
          <ul className="space-y-0.5">{pinned.map(row)}</ul>
        </>
      )}
      {rest.length > 0 && (
        <>
          {pinned.length > 0 && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{t("matches.leagues")}</div>}
          <ul className="space-y-0.5">{rest.map(row)}</ul>
        </>
      )}
    </nav>
  );
}

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

function Chip({
  active, onClick, count, children, tone, stacked,
}: { active: boolean; onClick: () => void; count: number; children: React.ReactNode; tone?: "live"; stacked?: boolean }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors",
        stacked ? "min-w-[58px] flex-col gap-0 py-1.5" : "py-2",
        focusRing,
        active
          ? tone === "live" ? "border-red-500 bg-red-600 text-white" : "border-emerald-500 bg-emerald-600 text-white"
          : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-50",
      )}
    >
      {children}
      <span className={cn("rounded px-1 text-[11px] tabular-nums", stacked ? "mt-0.5" : "", active ? "bg-black/25 text-white" : "bg-zinc-800 text-zinc-400")}>{count}</span>
    </button>
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

      <Button
        variant={isFinished ? "secondary" : "primary"}
        onClick={onStart}
        disabled={disabled}
        loading={starting}
        aria-label={t("matches.startAria", { home: fixture.home.name, away: fixture.away.name })}
        className="col-span-2 sm:col-span-1"
      >
        {!starting && <Play className="h-3.5 w-3.5" aria-hidden />}
        {starting ? t("matches.starting") : t("matches.startShow")}
      </Button>
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
