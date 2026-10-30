"use client";
import { Check, Mic, RefreshCw, SkipForward } from "lucide-react";
import type { CommentaryItem } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpiryChip } from "./expiry-chip";
import { useT, type MsgKey } from "@/lib/i18n";

const PRIORITY: Record<CommentaryItem["priority"], { tone: Tone; label: MsgKey }> = {
  high: { tone: "live", label: "sugg.priority.high" },
  normal: { tone: "info", label: "sugg.priority.normal" },
  low: { tone: "neutral", label: "sugg.priority.low" },
};

/** One AI-written line awaiting an operator decision. Shared by the studio feed and the desk. */
export function SuggestionCard({
  item, busy, onApprove, onSkip, onRegenerate, onSpeak, large = false,
}: {
  item: CommentaryItem;
  busy: boolean;
  onApprove: () => void;
  onSkip: () => void;
  onRegenerate: () => void;
  onSpeak?: () => void;
  large?: boolean;
}) {
  const t = useT();
  const minute = (item.source_facts as { event?: { minute?: string | number } } | undefined)?.event?.minute;
  const priority = PRIORITY[item.priority];

  return (
    <article
      className={cn(
        "rounded-xl border bg-zinc-950/60 p-4",
        item.priority === "high" ? "border-red-900/60" : "border-zinc-800",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {minute !== undefined && <Badge className="tabular-nums">{String(minute)}&apos;</Badge>}
        <Badge tone={priority.tone}>{t(priority.label)}</Badge>
        <span className="ml-auto" />
        <ExpiryChip expiresAt={item.expires_at} />
      </div>

      <p className={cn("leading-snug text-zinc-50", large ? "text-base" : "text-sm")}>{item.text}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onApprove} disabled={busy} loading={busy}>
          {!busy && <Check className="h-4 w-4" aria-hidden />}
          {t("sugg.approve")}
        </Button>
        <Button onClick={onSkip} disabled={busy}>
          <SkipForward className="h-4 w-4" aria-hidden /> {t("sugg.skip")}
        </Button>
        {onSpeak && (
          <Button onClick={onSpeak} disabled={busy} title={t("sugg.speakHint")}>
            <Mic className="h-4 w-4" aria-hidden /> {t("sugg.speak")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRegenerate}
          disabled={busy}
          className="ml-auto"
          aria-label={t("sugg.regenerate")}
          title={t("sugg.regenerate")}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {large && <p className="mt-2 text-xs text-zinc-500">{t("sugg.writtenBy", { model: item.model_version })}</p>}
    </article>
  );
}
