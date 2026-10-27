"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  BarChart3, Captions, Crosshair, History, LayoutDashboard, UserRound,
  type LucideIcon,
} from "lucide-react";
import { useShowStore } from "@/lib/stores/show-store";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";
import { focusRing } from "@/components/ui/button";

const SCENES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "scoreboard", label: "Scoreboard", icon: LayoutDashboard },
  { key: "timeline", label: "Timeline", icon: History },
  { key: "stats", label: "Match stats", icon: BarChart3 },
  { key: "tactical", label: "Tactical", icon: Crosshair },
  { key: "player", label: "Player", icon: UserRound },
  { key: "lower-third", label: "Lower third", icon: Captions },
];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Vision-mixer style scene buttons that sit directly under the program preview. */
export function SceneList() {
  const params = useParams<{ sessionId: string }>();
  const { activeScene, setScene } = useShowStore();
  const [syncError, setSyncError] = useState(false);

  // Optimistic local switch + server sync (so OBS gets the change too)
  const switchScene = async (sceneKey: string) => {
    setScene(sceneKey); // instant UI feedback
    try {
      await api.setScene(params.sessionId, sceneKey);
      setSyncError(false);
    } catch {
      setSyncError(true);
    }
  };
  const switchRef = useRef(switchScene);
  switchRef.current = switchScene;

  // Plain number keys 1–6. (⌘/Ctrl+number is taken by the browser for tab switching.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < SCENES.length) {
        e.preventDefault();
        void switchRef.current(SCENES[idx].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Scenes</h2>
        <span className="text-xs text-zinc-400">
          Press <kbd className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">1</kbd>–
          <kbd className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">{SCENES.length}</kbd> to switch
        </span>
      </div>

      <div role="group" aria-label="Scenes" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {SCENES.map(({ key, label, icon: Icon }, i) => {
          const active = activeScene === key;
          return (
            <button
              key={key}
              onClick={() => switchScene(key)}
              aria-pressed={active}
              className={cn(
                "relative flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition-colors",
                focusRing,
                active
                  ? "border-red-500/70 bg-red-500/10 text-zinc-50"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800",
              )}
            >
              <kbd className="absolute right-1.5 top-1.5 font-mono text-xs text-zinc-500">{i + 1}</kbd>
              <Icon className={cn("h-5 w-5", active ? "text-red-300" : "text-zinc-400")} aria-hidden />
              <span className="truncate">{label}</span>
              {active && (
                <span className="absolute inset-x-0 -bottom-px mx-auto h-0.5 w-8 rounded-full bg-red-400" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {syncError && (
        <p role="status" className="text-xs text-amber-300">
          Scene changed here, but couldn&apos;t reach the server. OBS may not have followed.
        </p>
      )}
    </div>
  );
}
