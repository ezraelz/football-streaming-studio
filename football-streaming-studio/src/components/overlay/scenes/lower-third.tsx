"use client";
import { useT } from "@/lib/i18n";
import { useOverlayEnv } from "@/components/overlay/env";

export function LowerThirdScene({ text, lift }: { text?: string | null; lift?: number }) {
  const t = useT();
  useOverlayEnv();
  if (!text) {
    return null; // nothing active → nothing on screen
  }
  return (
    // z-30: live commentary always sits above the graphics layer.
    // `lift` (px) raises it clear of the bottom strip when that is on air.
    <div className="absolute left-[2%] z-30 max-w-[62%]" style={{ bottom: lift ?? "8%" }}>
      <div
        key={text}
        className="ov-card-in overflow-hidden rounded-2xl border-l-[10px] border-emerald-500 px-8 py-5 backdrop-blur-xl"
        style={{ background: "var(--ov-surface-strong)", boxShadow: "var(--ov-shadow)" }}
      >
        <div className="mb-1.5 flex items-center gap-2.5 text-[20px] font-extrabold uppercase tracking-wider text-emerald-400">
          <span className="ov-pulse inline-block h-3 w-3 rounded-full bg-emerald-400" />
          {t("ov.commentary")}
        </div>
        <div className="text-[34px] font-semibold leading-snug text-white">{text}</div>
      </div>
    </div>
  );
}
