"use client";
import { useEffect, useState } from "react";
import { api, PlayerStatsPickerItem } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  sessionId: string;
  onClose: () => void;
  onConfirm: (playerIds: string[]) => void;
}

export function PlayerPicker({ sessionId, onClose, onConfirm }: Props) {
  const [players, setPlayers] = useState<PlayerStatsPickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.matchPlayerStatsList(sessionId)
      .then((r) => setPlayers(r.players))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectTeam = (team: "home" | "away") => {
    setSelected((prev) => {
      const next = new Set(prev);
      const teamIds = players.filter((p) => p.team === team).map((p) => p.player_id);
      const allSelected = teamIds.every((id) => next.has(id));
      teamIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(players.map((p) => p.player_id)));
  const clearAll = () => setSelected(new Set());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Select players</h2>
            <p className="text-xs text-zinc-400">
              Choose who appears on the player ratings card. Leave empty for top 10 by rating.
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-4 py-2 text-xs">
          <Button size="sm" onClick={selectAll}>Select all ({players.length})</Button>
          <Button size="sm" onClick={clearAll}>Clear</Button>
          <Button size="sm" onClick={() => selectTeam("home")}>Toggle home team</Button>
          <Button size="sm" onClick={() => selectTeam("away")}>Toggle away team</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && <p className="p-3 text-sm text-zinc-500">Loading…</p>}
          {error && <p className="p-3 text-sm text-red-400">{error}</p>}
          {!loading && !error && players.length === 0 && (
            <p className="p-3 text-sm text-zinc-500">No players with recorded stats yet.</p>
          )}
          <ul className="grid grid-cols-1 gap-1">
            {players.map((p) => {
              const isSel = selected.has(p.player_id);
              return (
                <li key={p.player_id}>
                  <button
                    onClick={() => toggle(p.player_id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm",
                      isSel
                        ? "bg-emerald-600/20 text-emerald-100 ring-1 ring-emerald-600/40"
                        : "hover:bg-zinc-800",
                    )}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-sm border"
                      style={{
                        background: isSel ? "#34d399" : "transparent",
                        borderColor: isSel ? "#34d399" : "#52525b",
                      }}
                    />
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: p.team_color }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{p.name}</span>
                      <span className="ml-2 text-xs text-zinc-500">{p.team_short}</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400 tabular-nums">
                      {p.rating != null ? `★ ${Number(p.rating).toFixed(1)}` : "—"}
                      <span className="ml-2 text-zinc-600">{p.minutes}&apos;</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 p-4">
          <span className="text-xs text-zinc-500">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConfirm(Array.from(selected))}
            >
              Create card
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}