"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useShowStore } from "@/lib/stores/show-store";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";

const SCENES = [
  { key: "scoreboard", label: "Scoreboard" },
  { key: "timeline", label: "Timeline" },
  { key: "stats", label: "Match Stats" },
  { key: "tactical", label: "Tactical View" },
  { key: "player", label: "Player Spotlight" },
  { key: "lower-third", label: "Lower Third" },
];

export function SceneList() {
  const params = useParams<{ sessionId: string }>();
  const { activeScene, setScene } = useShowStore();

  // Optimistic local switch + server sync (so OBS gets the change too)
  const switchScene = async (sceneKey: string) => {
    setScene(sceneKey); // instant UI feedback
    try {
      await api.setScene(params.sessionId, sceneKey);
    } catch {
      // Swallow — local state already updated; server sync is a convenience
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < SCENES.length) {
        e.preventDefault();
        switchScene(SCENES[idx].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Scenes
      </div>
      {SCENES.map((s, i) => (
        <button
          key={s.key}
          onClick={() => switchScene(s.key)}
          className={cn(
            "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
            activeScene === s.key
              ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-600/40"
              : "text-zinc-300 hover:bg-zinc-800"
          )}
        >
          <span>{s.label}</span>
          <kbd className="text-[10px] opacity-50">⌘{i + 1}</kbd>
        </button>
      ))}
    </div>
  );
}