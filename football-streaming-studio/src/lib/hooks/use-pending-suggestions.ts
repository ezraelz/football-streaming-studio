"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type CommentaryItem } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";

/**
 * Pending AI lines for a session. Lives at the studio level so the tab badge and the
 * feed share one source of truth (and one websocket subscription).
 */
export function usePendingSuggestions(sessionId: string) {
  const [items, setItems] = useState<CommentaryItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCommentary(sessionId, "pending_approval")
      .then(setItems)
      .catch(() => setError("Couldn't load suggestions."));
  }, [sessionId]);

  useSocket<CommentaryItem>(`/ws/v1/show-sessions/${sessionId}`, (msg) => {
    if (msg.type !== "commentary.update") return;
    setItems((prev) => {
      const exists = prev.some((i) => i.id === msg.data.id);
      if (exists) {
        if (msg.data.status === "pending_approval") {
          return prev.map((i) => (i.id === msg.data.id ? msg.data : i));
        }
        // Approved / skipped / played → no longer pending
        return prev.filter((i) => i.id !== msg.data.id);
      }
      return msg.data.status === "pending_approval" ? [msg.data, ...prev] : prev;
    });
  });

  const run = useCallback(
    async (id: string, action: () => Promise<unknown>, failure: string, removeOnSuccess: boolean) => {
      setBusyId(id);
      setError(null);
      try {
        await action();
        if (removeOnSuccess) setItems((prev) => prev.filter((i) => i.id !== id));
      } catch (e) {
        setError(e instanceof Error && e.message ? `${failure} ${e.message}` : failure);
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  return {
    items,
    busyId,
    error,
    dismissError: () => setError(null),
    approve: (id: string) => run(id, () => api.approveCommentary(id), "Couldn't approve that line.", true),
    skip: (id: string) => run(id, () => api.skipCommentary(id), "Couldn't skip that line.", true),
    regenerate: (id: string) => run(id, () => api.regenerateCommentary(id), "Couldn't regenerate that line.", false),
  };
}
