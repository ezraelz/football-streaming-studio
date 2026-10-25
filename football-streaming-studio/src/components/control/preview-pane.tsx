"use client";
import { useEffect, useState } from "react";
import { useShowStore } from "@/lib/stores/show-store";

export function PreviewPane({ sessionId }: { sessionId: string }) {
  const { activeScene, overlayToken } = useShowStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const src = mounted && overlayToken
    ? `/overlay/${sessionId}?scene=${activeScene}&preview=1&token=${overlayToken}`
    : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-semibold uppercase tracking-wider">Program Preview</span>
        <span>1920 × 1080</span>
      </div>
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-black">
        {src ? (
          <iframe
            key={src}
            src={src}
            className="h-full w-full border-0"
            title="Program Preview"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            Loading preview…
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        This is the exact output OBS receives. Interactive controls live outside the broadcast.
      </p>
    </div>
  );
}