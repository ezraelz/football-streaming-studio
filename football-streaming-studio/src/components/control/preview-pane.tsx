"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useShowStore } from "@/lib/stores/show-store";
import { useI18n } from "@/lib/i18n";
import { overlayLitePref, overlayToneOverlayPref } from "@/lib/prefs";

/**
 * Program preview. It loads the very same overlay page OBS uses, once, and changes scene by
 * message — so cards and the ticker stay on screen while you switch scenes (a reload would drop them).
 */
export function PreviewPane({ sessionId }: { sessionId: string }) {
  const { t, lang } = useI18n();
  const tone = overlayToneOverlayPref.useValue();
  const lite = overlayLitePref.useValue();
  const { activeScene, overlayToken } = useShowStore();
  const [mounted, setMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialScene = useRef(activeScene);
  useEffect(() => setMounted(true), []);

  const src =
    mounted && overlayToken
      ? `/overlay/${sessionId}?scene=${initialScene.current}&preview=1&lang=${lang}&tone=${tone}${lite ? "&lite=1" : ""}&token=${overlayToken}`
      : "";

  const sendScene = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "scene.change", scene: activeScene },
      window.location.origin,
    );
  }, [activeScene]);

  useEffect(() => { sendScene(); }, [sendScene]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">{t("preview.heading")}</h2>
        <span className="flex items-center gap-1 text-xs text-zinc-400" title={t("preview.hintTitle")}>
          <ExternalLink className="h-3 w-3" aria-hidden /> {t("preview.hint")}
        </span>
      </div>
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-700 bg-black shadow-lg shadow-black/40">
        {src ? (
          <iframe
            ref={iframeRef}
            src={src}
            onLoad={sendScene}
            className="h-full w-full border-0"
            title={t("preview.title")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">{t("preview.loading")}</div>
        )}
      </div>
    </div>
  );
}
