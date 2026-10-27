"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useShowStore } from "@/lib/stores/show-store";

/**
 * Program preview. It loads the very same overlay page OBS uses, once, and changes scene by
 * message — so cards and the ticker stay on screen while you switch scenes (a reload would drop them).
 */
export function PreviewPane({ sessionId }: { sessionId: string }) {
  const { activeScene, overlayToken } = useShowStore();
  const [mounted, setMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialScene = useRef(activeScene);
  useEffect(() => setMounted(true), []);

  const src =
    mounted && overlayToken
      ? `/overlay/${sessionId}?scene=${initialScene.current}&preview=1&token=${overlayToken}`
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
        <h2 className="text-sm font-semibold text-zinc-100">Program output</h2>
        <span className="flex items-center gap-1 text-xs text-zinc-400" title="This is exactly what OBS receives">
          <ExternalLink className="h-3 w-3" aria-hidden /> 1920 × 1080 · what OBS sees
        </span>
      </div>
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-700 bg-black shadow-lg shadow-black/40">
        {src ? (
          <iframe
            ref={iframeRef}
            src={src}
            onLoad={sendScene}
            className="h-full w-full border-0"
            title="Program output preview"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">Loading preview…</div>
        )}
      </div>
    </div>
  );
}
