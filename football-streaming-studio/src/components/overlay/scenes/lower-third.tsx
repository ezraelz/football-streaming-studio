"use client";
import { useT } from "@/lib/i18n";
import { useOverlayEnv } from "@/components/overlay/env";

/**
 * Live-commentary caption in the style of a TV lower-third: a slanted red "LIVE" tab above a
 * solid dark bar with a green accent edge.
 */
export function LowerThirdScene({ text, lift, label }: { text?: string | null; lift?: number; label?: string | null }) {
  const t = useT();
  const { stage } = useOverlayEnv();
  if (!text) {
    return null; // nothing active → nothing on screen
  }
  return (
    // z-30: live commentary always sits above the graphics layer.
    // `lift` (px) raises it clear of the bottom strip when that is on air.
    <div className={`absolute left-0 z-30 ${stage.compactBug ? "right-0" : "max-w-[70%]"}`} style={{ bottom: lift ?? (stage.compactBug ? 12 : "8%") }}>
      <div key={text} className="ov-card-in bc-drop" style={{ filter: "drop-shadow(0 14px 24px rgb(0 0 0 / 0.5))" }}>
        {label !== null && (
          <div className="bc-slant -mb-px ml-4 inline-flex items-center gap-3 bg-[#d90f1e] px-7 py-1.5">
            <span className="flex items-center gap-3 text-[24px] font-extrabold uppercase tracking-[0.18em] text-[#fff]">
              <span className="ov-pulse inline-block h-3 w-3 rounded-full bg-white" />
              {label ?? t("ov.commentary")}
            </span>
          </div>
        )}
        <div className="flex">
          <span className="w-3 shrink-0 bg-emerald-500" />
          <div className="px-8 py-5" style={{ background: "var(--ov-surface-solid)" }}>
            <div className={`${stage.compactBug ? "text-[40px]" : "text-[40px]"} font-bold leading-snug text-white`}>{text}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
