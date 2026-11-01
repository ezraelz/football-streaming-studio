"use client";
import { Clapperboard, Layers } from "lucide-react";
import { SceneList } from "@/components/control/scene-list";
import { EditorialPanel } from "@/components/control/editorial-panel";
import { useT } from "@/lib/i18n";

/**
 * One desk for everything that goes to air: full-screen scenes at the top, graphics cards below.
 * (Scenes and cards render together on the overlay, so they are operated together.)
 */
export function BroadcastDesk() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="desk-scenes">
        <DeskHeading id="desk-scenes" icon={<Clapperboard className="h-4 w-4" />} title={t("desk.scenes")} hint={t("desk.scenesHint")} />
        <SceneList />
      </section>
      <section aria-labelledby="desk-graphics">
        <DeskHeading id="desk-graphics" icon={<Layers className="h-4 w-4" />} title={t("desk.graphics")} hint={t("desk.graphicsHint")} />
        <EditorialPanel />
      </section>
    </div>
  );
}

function DeskHeading({ id, icon, title, hint }: { id: string; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="mb-3 border-b border-zinc-800 pb-2">
      <h2 id={id} className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-[0.14em] text-zinc-100">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white" aria-hidden>{icon}</span>
        {title}
      </h2>
      <p className="mt-1 text-xs text-zinc-400">{hint}</p>
    </div>
  );
}
