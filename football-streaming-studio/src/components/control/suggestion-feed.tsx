"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, CommentaryItem } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";
import { cn } from "@/lib/utility/utils";
import { Check, SkipForward, RefreshCw } from "lucide-react";

export function SuggestionFeed() {
  const params = useParams<{ sessionId: string }>();
  const [items, setItems] = useState<CommentaryItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.listCommentary(params.sessionId, "pending_approval")
      .then(setItems)
      .catch(() => { /* surfaced elsewhere */ });
  }, [params.sessionId]);

  useSocket<CommentaryItem>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type !== "commentary.update") return;
    setItems((prev) => {
      const exists = prev.find((i) => i.id === msg.data.id);
      if (exists) {
        if (msg.data.status === "pending_approval") {
          return prev.map((i) => i.id === msg.data.id ? msg.data : i);
        }
        // Approved / skipped / played → remove from the pending list
        return prev.filter((i) => i.id !== msg.data.id);
      }
      if (msg.data.status === "pending_approval") {
        return [msg.data, ...prev];
      }
      return prev;
    });
  });

  const onApprove = async (id: string) => {
    setBusy(id);
    try {
      await api.approveCommentary(id);
    } catch { /* surfaced elsewhere */ }
    finally { setBusy(null); }
  };

  const onSkip = async (id: string) => {
    setBusy(id);
    try {
      await api.skipCommentary(id);
    } catch { /* surfaced elsewhere */ }
    finally { setBusy(null); }
  };

  const onRegenerate = async (id: string) => {
    setBusy(id);
    try {
      await api.regenerateCommentary(id);
    } catch { /* surfaced elsewhere */ }
    finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          AI Suggestions
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{items.length}</span>
          <Link
            href={`/studio/${params.sessionId}/commentary`}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
          >
            Open Desk
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">No suggestions right now.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5">
                {String((item.source_facts as { event?: { minute?: string | number } } | undefined)?.event?.minute ?? "—")}&apos;
              </span>
              <span className={cn(
                "rounded px-1.5 py-0.5 font-medium",
                item.priority === "high" ? "bg-red-600/20 text-red-300" :
                item.priority === "normal" ? "bg-blue-600/20 text-blue-300" :
                "bg-zinc-700/50"
              )}>{item.priority}</span>
              <span>{item.model_version}</span>
            </div>
            <p className="text-sm leading-snug text-zinc-200">{item.text}</p>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => onApprove(item.id)}
                disabled={busy === item.id}
                className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium hover:bg-emerald-500 disabled:opacity-40"
              >
                <Check className="h-3 w-3" /> Approve
              </button>
              <button
                onClick={() => onSkip(item.id)}
                disabled={busy === item.id}
                className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 disabled:opacity-40"
              >
                <SkipForward className="h-3 w-3" /> Skip
              </button>
              <button
                onClick={() => onRegenerate(item.id)}
                disabled={busy === item.id}
                className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}