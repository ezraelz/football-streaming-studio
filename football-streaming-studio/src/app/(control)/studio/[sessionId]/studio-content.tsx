"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShowStore } from "@/lib/stores/show-store";
import { useSocket } from "@/lib/hooks/use-socket";
import { usePendingSuggestions } from "@/lib/hooks/use-pending-suggestions";
import { api } from "@/lib/api/client";
import { SceneList } from "@/components/control/scene-list";
import { PreviewPane } from "@/components/control/preview-pane";
import { MatchStrip } from "@/components/control/match-strip";
import { LiveDataPanel } from "@/components/control/live-data-panel";
import { SuggestionFeed } from "@/components/control/suggestion-feed";
import { EditorialPanel } from "@/components/control/editorial-panel";
import { Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/utility/utils";
import { focusRing } from "@/components/ui/button";
import type { ShowSession } from "@/lib/types/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tab = "suggestions" | "graphics" | "match" | "analysis";

export function StudioContent() {
  const params = useParams<{ sessionId: string }>();
  const { session, snapshot, loadMock, setSession } = useShowStore();
  const [tab, setTab] = useState<Tab>("suggestions");
  const suggestions = usePendingSuggestions(params.sessionId);

  // Load the session from the API if the store doesn't have it yet
  // (e.g. user hard-reloaded the page and the store was wiped)
  useEffect(() => {
    if (session && session.id === params.sessionId) return; // already loaded
    if (!UUID_RE.test(params.sessionId)) {
      loadMock(); // Mock session — seed with loadMock
      return;
    }
    api.getSession(params.sessionId)
      .then((s) => setSession(s))
      .catch(() => loadMock()); // If the session doesn't exist, fall back to mock
  }, [params.sessionId, session, setSession, loadMock]);

  // Fetch the snapshot from the API if we have a real session but no snapshot
  useEffect(() => {
    if (!session || !UUID_RE.test(session.id)) return;
    if (snapshot) return;
    api.match(session.match_id)
      .then((snap) => useShowStore.setState({ snapshot: snap }))
      .catch(() => { /* poller may not have synced the match yet */ });
  }, [session, snapshot]);

  // WebSocket: session updates and scene commands
  const isRealSession = UUID_RE.test(params.sessionId);
  const wsPath = isRealSession ? `/ws/v1/show-sessions/${params.sessionId}` : null;

  useSocket<ShowSession>(wsPath, (msg) => {
    if (msg.type === "session.update") setSession(msg.data);
    if (msg.type === "scene.command" && (msg.data as { scene_id?: string }).scene_id) {
      useShowStore.getState().setScene((msg.data as unknown as { scene_id: string }).scene_id);
    }
  });

  if (!snapshot) return <StudioSkeleton message="Loading show…" />;

  const pending = suggestions.items.length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "suggestions", label: "Suggestions", badge: pending },
    { id: "graphics", label: "Graphics" },
    { id: "match", label: "Match data" },
    { id: "analysis", label: "Analysis" }, 
  ];

  return (
    <div className="grid gap-4 lg:h-full lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* Left: what's on air + how to change it */}
      <div className="flex min-w-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
        <MatchStrip />
        <PreviewPane sessionId={params.sessionId} />
        <SceneList />
      </div>

      {/* Right: things that need a decision */}
      <aside className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div role="tablist" aria-label="Studio panels" className="flex gap-1 border-b border-zinc-800 p-1.5">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  focusRing,
                  active ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
                )}
              >
                {t.label}
                {!!t.badge && (
                  <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold leading-5 text-zinc-950 tabular-nums">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>



        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          {tab === "suggestions" && (
            <Suspense fallback={null}>
              <SuggestionFeed suggestions={suggestions} />
            </Suspense>
          )}
          {tab === "graphics" && <EditorialPanel />}
          {tab === "match" && <LiveDataPanel />}
        </div>
      </aside>
    </div>
  );
}

export function StudioSkeleton({ message }: { message?: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]" aria-busy="true" aria-label={message ?? "Loading"}>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
