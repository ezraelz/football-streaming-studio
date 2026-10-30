"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { usePendingSuggestions } from "@/lib/hooks/use-pending-suggestions";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button";
import { SuggestionCard } from "./suggestion-card";
import { useT } from "@/lib/i18n";

type Suggestions = ReturnType<typeof usePendingSuggestions>;

export function SuggestionFeed({ suggestions }: { suggestions: Suggestions }) {
  const params = useParams<{ sessionId: string }>();
  const t = useT();
  const { items, busyId, error, dismissError, approve, skip, regenerate } = suggestions;

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error" onDismiss={dismissError}>{error}</Alert>}

      {items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title={t("sugg.emptyTitle")}
          description={t("sugg.emptyBody")}
          action={
            <Link href={`/studio/${params.sessionId}/commentary`} className={buttonClass("secondary", "sm")}>
              {t("sugg.openDesk")}
            </Link>
          }
        />
      ) : (
        items.map((item) => (
          <SuggestionCard
            key={item.id}
            item={item}
            busy={busyId === item.id}
            onApprove={() => approve(item.id)}
            onSkip={() => skip(item.id)}
            onRegenerate={() => regenerate(item.id)}
          />
        ))
      )}
    </div>
  );
}
