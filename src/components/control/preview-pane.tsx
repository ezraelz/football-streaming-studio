"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Monitor, Smartphone, Square } from "lucide-react";
import { useShowStore } from "@/lib/stores/show-store";
import { useI18n } from "@/lib/i18n";
import { accentPref, formatPref, overlayToneOverlayPref } from "@/lib/prefs";
import { FORMAT_IDS, STAGES, type FormatId } from "@/lib/overlay/stage";
import { cn } from "@/lib/utility/utils";
import { focusRing } from "@/components/ui/button";

const FORMAT_ICON: Record<FormatId, typeof Monitor> = { landscape: Monitor, portrait: Smartphone, square: Square };

/** Format switcher shared by the preview and Settings. */
export function FormatSwitch({ value, onChange, className }: { value: FormatId; onChange: (f: FormatId) => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t("format.label")} className={cn("inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5", className)}>
      {FORMAT_IDS.map((f) => {
        const Icon = FORMAT_ICON[f];
        const active = value === f;
        return (
          <button
            key={f}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(f)}
            title={t(`format.${f}.hint` as const)}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors", focusRing, active ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-100")}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {t(`format.${f}` as const)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Program preview. It loads the very same overlay page OBS uses, once. It always runs in "lite" mode
 * (no blur) because the preview is for checking layout, and blur is the most expensive thing on the page.
 */
export function PreviewPane({ sessionId }: { sessionId: string }) {
  const { t, lang } = useI18n();
  const tone = overlayToneOverlayPref.useValue();
  const accent = accentPref.useValue();
  const format = formatPref.useValue();
  const activeScene = useShowStore((s) => s.activeScene);
  const overlayToken = useShowStore((s) => s.overlayToken);
  const [mounted, setMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialScene = useRef(activeScene);
  useEffect(() => setMounted(true), []);

  const src =
    mounted && overlayToken
      ? `/overlay/${sessionId}?scene=${initialScene.current}&preview=1&lite=1&lang=${lang}&tone=${tone}&accent=${accent}&format=${format}&token=${overlayToken}`
      : "";

  const sendScene = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "scene.change", scene: activeScene }, window.location.origin);
  }, [activeScene]);
  useEffect(() => { sendScene(); }, [sendScene]);

  const stage = STAGES[format];
  const tall = stage.canvasH >= stage.canvasW;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold uppercase tracking-wide text-zinc-100">{t("preview.heading")}</h2>
        <FormatSwitch value={format} onChange={formatPref.set} />
      </div>
      <div className="flex justify-center rounded-xl bg-zinc-950/60 p-2">
        <div
          className="overflow-hidden rounded-xl border border-zinc-700 bg-black shadow-lg shadow-black/40"
          style={{ aspectRatio: `${stage.canvasW} / ${stage.canvasH}`, width: tall ? "auto" : "100%", height: tall ? "min(64vh, 640px)" : "auto", maxWidth: "100%" }}
        >
          {src ? (
            <iframe ref={iframeRef} src={src} onLoad={sendScene} loading="lazy" className="h-full w-full border-0" title={t("preview.title")} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">{t("preview.loading")}</div>
          )}
        </div>
      </div>
      <span className="flex items-center gap-1 text-xs text-zinc-400" title={t("preview.hintTitle")}>
        <ExternalLink className="h-3 w-3" aria-hidden /> {stage.canvasW} × {stage.canvasH} · {t("preview.hint2")}
      </span>
    </div>
  );
}
