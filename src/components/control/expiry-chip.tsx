"use client";
import { Timer } from "lucide-react";
import { cn, secondsUntil } from "@/lib/utility/utils";
import { useT } from "@/lib/i18n";
import { useFormat } from "@/lib/i18n/use-format";
import { useNow } from "@/lib/hooks/use-now";

/** Live countdown until an AI line goes stale. Turns amber, then red, as it runs out. */
export function ExpiryChip({ expiresAt }: { expiresAt: string }) {
  const t = useT();
  const fmt = useFormat();
  const now = useNow(1000);
  const seconds = secondsUntil(expiresAt, now);
  const tone =
    seconds <= 0 ? "text-red-300 bg-red-500/15"
    : seconds <= 15 ? "text-amber-300 bg-amber-500/15"
    : "text-zinc-300 bg-zinc-800";

  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums", tone)}
      title={t("sugg.expiryHint")}
    >
      <Timer className="h-3 w-3" aria-hidden />
      {fmt.countdown(seconds)}
    </span>
  );
}
