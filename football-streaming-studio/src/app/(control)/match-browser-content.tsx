"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarX2, ChevronRight, Play, Search } from "lucide-react";
import { api, type Fixture } from "@/lib/api/client";
import type { ShowProfile, ShowSession } from "@/lib/types/types";
import { useShowStore } from "@/lib/stores/show-store";
import { cn } from "@/lib/utility/utils";
import { Button, focusRing } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { inputClass } from "@/components/ui/form";

/* ---------- config & types ---------- */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type Filter = "all" | "live" | "today";
type CommentaryMode = ReturnType<typeof useShowStore.getState>["commentaryMode"];

const DEFAULT_MODE = "approval" as unknown as CommentaryMode;
const STATUS_ORDER: Record<string, number> = { live: 0, scheduled: 1, ft: 2 };
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "today", label: "Today" },
];

/* ---------- helpers ---------- */

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isToday(iso)) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type DayGroup = { key: string; label: string; competitions: { name: string; fixtures: Fixture[] }[] };

function groupFixtures(fixtures: Fixture[]): DayGroup[] {
  const sorted = fixtures.slice().sort((a, b) => {
    const da = new Date(a.kickoff);
    const db = new Date(b.kickoff);
    const dayDiff = new Date(da.toDateString()).getTime() - new Date(db.toDateString()).getTime();
    if (dayDiff !== 0) return dayDiff;
    const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    return s !== 0 ? s : da.getTime() - db.getTime();
  });

  const days = new Map<string, DayGroup>();
  for (const f of sorted) {
    const key = new Date(f.kickoff).toDateString();
    const name = f.competition || "Other fixtures";
    let day = days.get(key);
    if (!day) {
      day = { key, label: dayLabel(f.kickoff), competitions: [] };
      days.set(key, day);
    }
    let comp = day.competitions.find((c) => c.name === name);
    if (!comp) {
      comp = { name, fixtures: [] };
      day.competitions.push(comp);
    }
    comp.fixtures.push(f);
  }
  return Array.from(days.values());
}

/* ---------- main component ---------- */

export function MatchBrowserContent() {
  const router = useRouter();
  const preferredProfile = useRef(useSearchParams().get("profile"));
  const [search, setSearch] = useState("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [profiles, setProfiles] = useState<ShowProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<ShowSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.fixtures(), api.listProfiles(), api.listSessions("live,paused,degraded")])
      .then(([f, p, sessions]) => {
        if (cancelled) return;
        setFixtures(f);
        setProfiles(p);
        setProfileId(p.find((x) => x.id === preferredProfile.current)?.id ?? p[0]?.id ?? "");
        setActiveSession(sessions[0] ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load matches.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: fixtures.length,
      live: fixtures.filter((f) => f.status === "live").length,
      today: fixtures.filter((f) => isToday(f.kickoff)).length,
    }),
    [fixtures],
  );

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = fixtures
      .filter((f) => (filter === "live" ? f.status === "live" : filter === "today" ? isToday(f.kickoff) : true))
      .filter(
        (f) =>
          !q ||
          [f.home.name, f.away.name, f.competition].some((t) => t?.toLowerCase().includes(q)),
      );
    return groupFixtures(list);
  }, [fixtures, filter, search]);

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
      setError(e instanceof Error ? e.message : "Couldn't resume the session.");
      setResuming(false);
    }
  };

  const startShow = async (fixtureId: string) => {
    const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
    if (!profile) {
      setError("Create a show profile first: Show Profiles → New profile.");
      return;
    }
    setStarting(fixtureId);
    setError(null);
    try {
      let session = await api.createSession(profile.id, fixtureId);
      session = await api.transition(session.id, "armed");
      session = await api.transition(session.id, "live");

      const cfg = (profile.commentary_config ?? {}) as unknown as {
        mode?: string;
        voice?: string;
        language?: string;
      };
      resetStore(session);
      useShowStore.setState({
        commentaryMode: (cfg.mode as unknown as CommentaryMode | undefined) ?? DEFAULT_MODE,
        voice: cfg.voice ?? "en-US-Neural-A",
        language: cfg.language ?? "en",
      });
      router.push(`/studio/${session.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't start the show.");
      setStarting(null);
    }
  };

  const activeFixture = activeSession ? fixtures.find((f) => f.id === activeSession.match_id) : undefined;
  const activeProfile = profiles.find((p) => p.id === profileId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Matches" description="Pick a match to start a show. Live matches are listed first." />

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
              Your show is still running
              <Badge tone="success" className="capitalize">{activeSession.state}</Badge>
            </p>
            <p className="mt-1 truncate text-base font-semibold text-zinc-50">
              {activeFixture ? `${activeFixture.home.name} vs ${activeFixture.away.name}` : `Match ${activeSession.match_id}`}
            </p>
          </div>
          <Button variant="primary" size="lg" onClick={resume} loading={resuming}>
            {resuming ? "Resuming…" : "Resume show"}
            {!resuming && <ChevronRight className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Filter matches" className="inline-flex self-start rounded-lg bg-zinc-900 p-1">
          {FILTERS.map(({ id, label }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                  focusRing,
                  active ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
                )}
              >
                {label}
                <span className={cn("ml-1.5 text-xs tabular-nums", active ? "text-emerald-400" : "text-zinc-500")}>
                  {counts[id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative lg:ml-auto lg:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            type="search"
            aria-label="Search teams or competitions"
            placeholder="Search teams or competitions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(inputClass, "pl-9")}
          />
        </div>
      </div>

      {/* Which profile will the show use? Always visible, never a surprise. */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm">
          <span className="text-zinc-400">Starting shows with</span>
          {profiles.length === 0 ? (
            <Link href="/shows" className="font-medium text-emerald-400 hover:text-emerald-300">
              Create a show profile first →
            </Link>
          ) : profiles.length === 1 ? (
            <span className="font-medium text-zinc-100">{activeProfile?.name}</span>
          ) : (
            <select
              aria-label="Show profile"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className={cn(inputClass, "w-auto py-1.5")}
            >
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {profiles.length > 0 && (
            <Link href="/shows" className="ml-auto text-xs text-zinc-400 hover:text-zinc-100">
              Manage profiles
            </Link>
          )}
        </div>
      )}

      {/* Content */}
      <main className="space-y-8" aria-busy={loading}>
        {loading ? (
          <LoadingList />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={<CalendarX2 className="h-7 w-7" />}
            title={
              search ? `No matches for “${search}”`
              : filter === "live" ? "No matches are live right now"
              : filter === "today" ? "No matches are scheduled for today"
              : "No fixtures are available yet"
            }
            description={fixtures.length > 0 ? "Try another filter or clear the search." : "Fixtures appear once the data provider has synced."}
            action={
              (filter !== "all" || search) && fixtures.length > 0 ? (
                <Button onClick={() => { setFilter("all"); setSearch(""); }}>Show all matches</Button>
              ) : undefined
            }
          />
        ) : (
          grouped.map((day) => (
            <section key={day.key} aria-labelledby={`day-${day.key}`}>
              <h2 id={`day-${day.key}`} className="text-lg font-semibold text-zinc-50">{day.label}</h2>
              <div className="mt-3 space-y-5">
                {day.competitions.map((comp) => (
                  <div key={comp.name}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{comp.name}</h3>
                    <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
                      {comp.fixtures.map((f) => (
                        <FixtureRow
                          key={f.id}
                          fixture={f}
                          starting={starting === f.id}
                          disabled={starting !== null || profiles.length === 0}
                          onStart={() => startShow(f.id)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

/* ---------- pieces ---------- */

function FixtureRow({
  fixture, starting, disabled, onStart,
}: {
  fixture: Fixture;
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
            Live
          </Badge>
        ) : isFinished ? (
          <span className="text-sm font-medium text-zinc-400">Full time</span>
        ) : (
          <time dateTime={fixture.kickoff} className="text-sm font-semibold tabular-nums text-zinc-100">
            {formatTime(fixture.kickoff)}
          </time>
        )}
        {missing.length > 0 && (
          <span title={`No provider coverage for: ${missing.join(", ")}`}>
            <Badge tone="warn">Limited data</Badge>
          </span>
        )}
      </div>

      {/* Who */}
      <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
        <TeamLine team={fixture.home} />
        <span className="text-xs font-medium uppercase text-zinc-500">vs</span>
        <TeamLine team={fixture.away} align="right" />
      </div>

      <Button
        variant={isFinished ? "secondary" : "primary"}
        onClick={onStart}
        disabled={disabled}
        loading={starting}
        aria-label={`Start show: ${fixture.home.name} vs ${fixture.away.name}`}
        className="col-span-2 sm:col-span-1"
      >
        {!starting && <Play className="h-3.5 w-3.5" aria-hidden />}
        {starting ? "Starting…" : "Start show"}
      </Button>
    </li>
  );
}

function TeamLine({ team, align = "left" }: { team: Fixture["home"]; align?: "left" | "right" }) {
  const [failed, setFailed] = useState(false);
  const showCrest = Boolean(team.crestUrl) && !failed;

  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${
        align === "right" ? "flex-col-reverse text-center sm:flex-row-reverse sm:text-right" : "flex-col text-center sm:flex-row sm:text-left"
      }`}
    >
      <div className="h-9 w-9 shrink-0">
        {showCrest ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_BASE}${team.crestUrl}`}
            alt=""
            className="h-full w-full object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-white"
            style={team.color ? { backgroundColor: team.color } : undefined}
          >
            {(team.shortName ?? team.name).slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>
      <span className="min-w-0 truncate text-sm font-medium text-zinc-100 sm:text-base">{team.name}</span>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="space-y-3" aria-label="Loading matches">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
    </div>
  );
}
