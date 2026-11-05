"use client";
import { Layers } from "lucide-react";
import { Rundown } from "@/components/control/rundown";
import { useT } from "@/lib/i18n";

/**
 * One desk for everything that goes to air. Scenes and cards were redundant (stats scene vs stats card,
 * etc.), so there is now a single list of graphics: the score bug is always on, live commentary is the
 * lower third, and everything else (cards and full-screen views) is a graphic you show or hide here.
 */
export function BroadcastDesk() {
  const t = useT();
  return (
    <section aria-labelledby="desk-graphics" className="flex flex-col gap-3">
      <div className="border-b border-zinc-800 pb-2">
        <h2 id="desk-graphics" className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-[0.14em] text-zinc-100">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white" aria-hidden><Layers className="h-4 w-4" /></span>
          {t("desk.graphics")}
        </h2>
        <p className="mt-1 text-xs text-zinc-400">{t("desk.graphicsHint")}</p>
      </div>
      <Rundown />
    </section>
  );
}
