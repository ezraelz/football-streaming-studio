"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { Fixture, ShowProfile, ShowSession } from "@/lib/types/types";
import { useShowStore } from "@/lib/stores/show-store";
import { FixtureCard } from "@/components/control/fixture-card";
import { Play } from "lucide-react";

export function MatchBrowserContent() {
  const router = useRouter();

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [profiles, setProfiles] = useState<ShowProfile[]>([]);
  const [activeSession, setActiveSession] = useState<ShowSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.fixtures(),
      api.listProfiles(),
      api.listSessions("live,paused,degraded"),
    ])
      .then(([f, p, sessions]) => {
        setFixtures(f);
        setProfiles(p);
        setActiveSession(sessions[0] ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const resume = async () => {
    if (!activeSession) return;
    try {
      let session = activeSession;
      if (session.state !== "live") {
        session = await api.transition(session.id, "live");
      }
      useShowStore.setState({
        session,
        overlayToken: session.overlay_token,
        snapshot: null,
        events: [],
        suggestions: [],
        transcript: [],
      });
      router.push(`/studio/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resume");
    }
  };

  const startShow = async (fixtureId: string) => {
    if (profiles.length === 0) {
      setError("Create a show profile first (Show Profiles → New profile).");
      return;
    }
    setStarting(fixtureId);
    setError(null);
    try {
      const profile = profiles[0];
      let session = await api.createSession(profile.id, fixtureId);

      // Advance to live so automation can fire
      session = await api.transition(session.id, "armed");
      session = await api.transition(session.id, "live");

      useShowStore.setState({
        session,
        overlayToken: session.overlay_token,
        snapshot: null,
        events: [],
        suggestions: [],
        transcript: [],
        commentaryMode: (profile.commentary_config as { mode?: string })?.mode as any ?? "approval",
        voice: (profile.commentary_config as { voice?: string })?.voice ?? "en-US-Neural-A",
        language: (profile.commentary_config as { language?: string })?.language ?? "en",
      });
      router.push(`/studio/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start show");
    } finally {
      setStarting(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Match Browser</h1>
        <p className="text-sm text-zinc-400">
          Select a fixture to open the production workspace.
        </p>
      </div>

      {activeSession && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Active session
            </div>
            <div className="mt-0.5 text-sm text-emerald-100">
              {activeSession.state} · {activeSession.match_id}
            </div>
          </div>
          <button
            onClick={resume}
            className="flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            <Play className="h-4 w-4" /> Resume
          </button>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fixtures.map((f) => (
          <FixtureCard
            key={f.id}
            fixture={f}
            onStart={() => startShow(f.id)}
            busy={starting === f.id}
          />
        ))}
      </div>
    </div>
  );
}