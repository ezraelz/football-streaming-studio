"use client";
import { useEffect, useRef } from "react";
import { OverlayEnvProvider, type CardAnim } from "./env";
import { STAGES, type FormatId } from "@/lib/overlay/stage";
import { useT } from "@/lib/i18n";
import type { Accent, OverlayTone } from "@/lib/prefs";

/**
 * Fixed 1920×1080 stage that scales to the window (OBS browser source or studio preview).
 * `tone` switches the cards between dark and light; `lite` turns off blur for slower PCs.
 */
export function OverlayCanvas({
  children, preview = false, tone = "dark", lite = false, accent = "pitch", format = "landscape", anim = "slide", fill = true,
}: { children: React.ReactNode; preview?: boolean; tone?: OverlayTone; lite?: boolean; accent?: Accent; format?: FormatId; anim?: CardAnim; fill?: boolean }) {
  const stage = STAGES[format];
  const t = useT();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const resize = () => {
      const scale = Math.min(wrapper.clientWidth / stage.canvasW, wrapper.clientHeight / stage.canvasH);
      inner.style.transform = `scale(${scale})`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [stage.canvasW, stage.canvasH]);

  return (
    <OverlayEnvProvider value={{ tone, lite, stage, anim }}>
      <div
        ref={wrapperRef}
        className={`ov-root ov-tone-${tone} ov-accent-${accent} ${lite ? "ov-lite" : ""} ov-anim-${anim} relative ${fill ? "h-screen w-screen" : "h-full w-full"} overflow-hidden bg-transparent`}
      >
        <div
          ref={innerRef}
          className="absolute left-0 top-0"
          style={{ width: stage.canvasW, height: stage.canvasH, transformOrigin: "top left" }}
        >
          <div className="absolute" style={{ left: stage.inset.l, top: stage.inset.t, width: stage.W, height: stage.H }}>{children}</div>
        </div>
        {preview && (
          <div className="pointer-events-none absolute right-4 top-4 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white/80">
            {t("ov.preview")}
          </div>
        )}
      </div>
    </OverlayEnvProvider>
  );
}
