"use client";
import { useState } from "react";
import { OverlayCanvas } from "@/components/overlay/canvas";
import { ScoreboardScene } from "@/components/overlay/scenes/scoreboard";
import { LowerThirdScene } from "@/components/overlay/scenes/lower-third";
import {
  EditorialLayer, ZONES, ZONE_LABEL, isTickerCard, lowerThirdLift, zoneOf, type Zone,
} from "@/components/overlay/scenes/editorial";
import { LEAGUE_THEMES, DEFAULT_THEME } from "@/lib/branding/leagues";
import { mockEditorialCards } from "@/lib/mock/editorial-cards";
import { mockSnapshot } from "@/lib/mock/fixtures";
import type { EditorialCard } from "@/lib/api/client";

type Setup = Record<string, Zone | "auto">; // card id → position (only cards that are on air)

const PRESETS: Record<string, Setup> = {
  "Main only": { lineups: "auto" },
  "Main + left": { lineups: "auto", standings: "auto", form: "auto" },
  "Left + bottom": { standings: "auto", form: "auto", h2h: "auto" },
  "Analysis desk": { lineups: "auto", standings: "auto", form: "auto", h2h: "auto", scorers: "right" },
  "Pre-match": { intro: "auto", countdown: "bottom", standings: "left", form: "right", ticker: "auto" },
  "Desk + ticker": { lineups: "auto", standings: "auto", h2h: "auto", ticker: "auto" },
};

export function DemoContent() {
  const [setup, setSetup] = useState<Setup>(PRESETS["Analysis desk"]);
  const [guides, setGuides] = useState(false);
  const [commentary, setCommentary] = useState(false);
  const [league, setLeague] = useState("Premier League");

  const cards: EditorialCard[] = mockEditorialCards
    .filter((c) => c.id in setup)
    .map((c) => {
      const z = setup[c.id];
      const payload: Record<string, unknown> = { ...c.payload, competition: league || undefined };
      if (z !== "auto" && !isTickerCard(c)) payload.zone = z;
      return { ...c, payload };
    });

  const toggle = (id: string) =>
    setSetup((s) => {
      const { [id]: gone, ...rest } = s;
      return gone === undefined ? { ...rest, [id]: "auto" } : rest;
    });

  const snapshot = { ...mockSnapshot, freshness: "fresh" as const };

  return (
    <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,#14532d_0%,#052e16_55%,#022c22_100%)]">
      <OverlayCanvas preview>
        <ScoreboardScene snapshot={snapshot} />
        <EditorialLayer
          cards={cards}
          guides={guides}
          competition={league}
          home={{ name: "Arsenal", color: "#EF0107" }}
          away={{ name: "Chelsea", color: "#034694" }}
        />
        {commentary && (
          <LowerThirdScene
            text="Saka cuts inside and curls it towards the far corner — just wide!"
            lift={lowerThirdLift(cards)}
          />
        )}
      </OverlayCanvas>

      <div className="fixed right-3 top-3 z-50 max-h-[calc(100vh-1.5rem)] w-72 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/85 p-3 text-xs text-white backdrop-blur">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PRESETS).map(([label, preset]) => (
            <button key={label} onClick={() => setSetup(preset)} className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20">
              {label}
            </button>
          ))}
          <button onClick={() => setSetup({})} className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20">Clear</button>
        </div>

        <label className="flex items-center gap-2">
          League theme
          <select value={league} onChange={(e) => setLeague(e.target.value)} className="flex-1 rounded-md bg-white/10 px-1 py-1">
            <option value="">{DEFAULT_THEME.name} (none)</option>
            {LEAGUE_THEMES.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </label>

        <ul className="space-y-1.5">
          {mockEditorialCards.map((c) => {
            const on = c.id in setup;
            return (
              <li key={c.id} className="flex items-center gap-2">
                <button
                  onClick={() => toggle(c.id)}
                  aria-pressed={on}
                  className={`flex-1 rounded-md px-2 py-1 text-left ${on ? "bg-emerald-600" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {c.card_type.replace(/_/g, " ")}
                </button>
                <select
                  aria-label={`Position for ${c.card_type}`}
                  disabled={!on || isTickerCard(c)}
                  value={setup[c.id] ?? "auto"}
                  onChange={(e) => setSetup((s) => ({ ...s, [c.id]: e.target.value as Zone | "auto" }))}
                  className="w-32 rounded-md bg-white/10 px-1 py-1 disabled:opacity-40"
                >
                  <option value="auto">Auto · {ZONE_LABEL[zoneOf(c)]}</option>
                  {ZONES.filter((z) => z !== "ticker").map((z) => <option key={z} value={z}>{ZONE_LABEL[z]}</option>)}
                </select>
              </li>
            );
          })}
        </ul>

        <label className="flex items-center gap-2"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Show screen outlines</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={commentary} onChange={(e) => setCommentary(e.target.checked)} /> Show live commentary bar</label>
      </div>
    </div>
  );
}
