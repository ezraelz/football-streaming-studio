// src/components/control/analysis-panel.tsx (new)

"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, H2HMeeting, Prediction, TeamFixture } from "@/lib/api/client";
import type { MatchSnapshot } from "@/lib/types/types";

export function AnalysisPanel() {
  const params = useParams<{ sessionId: string }>();
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [h2h, setH2h] = useState<H2HMeeting[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [homeFixtures, setHomeFixtures] = useState<TeamFixture[]>([]);
  const [awayFixtures, setAwayFixtures] = useState<TeamFixture[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const session = await api.getSession(params.sessionId);
        const snap = await api.match(session.match_id);
        setSnapshot(snap);
        const [h, p, homeFx, awayFx] = await Promise.all([
          api.h2h(snap.matchId),
          api.prediction(snap.matchId),
          api.teamFixtures(snap.home.id),
          api.teamFixtures(snap.away.id),
        ]);
        setH2h(h);
        setPrediction(p);
        setHomeFixtures(homeFx);
        setAwayFixtures(awayFx);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load analysis");
      }
    })();
  }, [params.sessionId]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!snapshot) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      {/* Prediction */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Prediction
          </h3>
          <span className="text-[10px] text-zinc-500">
            {prediction?.model_version} · n={prediction?.sample_size}
          </span>
        </div>
        {prediction?.probabilities ? (
          <>
            <div className="flex h-6 overflow-hidden rounded-md bg-zinc-800 text-[11px] font-bold">
              <div className="flex items-center justify-center bg-emerald-600 text-white"
                   style={{ width: `${prediction.probabilities.home_win * 100}%` }}>
                {Math.round(prediction.probabilities.home_win * 100)}%
              </div>
              <div className="flex items-center justify-center bg-zinc-600 text-white"
                   style={{ width: `${prediction.probabilities.draw * 100}%` }}>
                {Math.round(prediction.probabilities.draw * 100)}%
              </div>
              <div className="flex items-center justify-center bg-blue-600 text-white"
                   style={{ width: `${prediction.probabilities.away_win * 100}%` }}>
                {Math.round(prediction.probabilities.away_win * 100)}%
              </div>
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
              <span>{prediction.team_a}</span>
              <span>Draw</span>
              <span>{prediction.team_b}</span>
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
              Estimates only, based on {prediction.sample_size} past meetings. Not a guarantee.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            No H2H data available to compute a prediction.
          </p>
        )}
      </section>

      {/* H2H */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Head to head
        </h3>
        <ul className="space-y-1">
          {h2h.map((m, i) => (
            <li key={i} className="flex justify-between text-xs text-zinc-300">
              <span className="text-zinc-500 tabular-nums">{m.date}</span>
              <span>{m.home_team} — {m.away_team}</span>
              <span className="tabular-nums font-semibold">{m.score}</span>
            </li>
          ))}
          {h2h.length === 0 && <li className="text-sm text-zinc-500">No meetings available.</li>}
        </ul>
      </section>

      {/* Next matches */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Next matches
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[snapshot.home, snapshot.away].map((team, i) => {
            const list = i === 0 ? homeFixtures : awayFixtures;
            return (
              <div key={team.id}>
                <div className="mb-1 text-xs font-semibold text-zinc-300">{team.shortName}</div>
                <ul className="space-y-1 text-[11px] text-zinc-400">
                  {list.map((f) => (
                    <li key={f.match_id} className="truncate">
                      {new Date(f.kickoff).toLocaleDateString()} · {f.home_short} v {f.away_short}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}