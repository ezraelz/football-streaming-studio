"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShowStore } from "@/lib/stores/show-store";
import { useSocket } from "@/lib/hooks/use-socket";
import { usePendingSuggestions } from "@/lib/hooks/use-pending-suggestions";
import { api } from "@/lib/api/client";
import { PreviewPane } from "@/components/control/preview-pane";
import { MatchStrip } from "@/components/control/match-strip";
import { LiveDataPanel } from "@/components/control/live-data-panel";
import { SuggestionFeed } from "@/components/control/suggestion-feed";
import { BroadcastDesk } from "@/components/control/broadcast-desk";
import { ResizeHandle, useResizableSize } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/utility/utils";
import { focusRing } from "@/components/ui/button";
import type { ShowSession } from "@/lib/types/types";
import { useT } from "@/lib/i18n";
import { SpeechPlayer } from "@/components/control/speech-player";
import { SystemAlertBanner } from "@/components/control/system-alert-banner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tab = "suggestions" | "broadcast" | "match";

export function StudioContent() {
  const params = useParams<{ sessionId: string }>();
  const t = useT();
  const { session, snapshot, loadMock, setSession } = useShowStore();
  const [tab, setTab] = useState<Tab>("broadcast");
  const aside = useResizableSize("studio-aside", 440, 340, 780);
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

  if (!snapshot) return <StudioSkeleton message={t("studio.loading")} />;

  const pending = suggestions.items.length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "suggestions", label: t("studio.tab.suggestions"), badge: pending },
    { id: "broadcast", label: t("studio.tab.broadcast") },
    { id: "match", label: t("studio.tab.match") },
  ];
  // Suggestions first in the tab bar, but open on the Broadcast desk — that is where the show is run.

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      {/* Put the banner here, above the grid */}
      <SystemAlertBanner />
      <div className="grid gap-4 lg:h-full lg:gap-0 lg:grid-cols-[minmax(0,1fr)_auto_var(--aside)]" style={{ ["--aside" as string]: `${aside.size}px` } as React.CSSProperties}>
        {/* Left: what's on air + how to change it */}
        <div className="flex min-w-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
          <MatchStrip />
          <PreviewPane sessionId={params.sessionId} />
          <SpeechPlayer />
        </div>

        {/* Drag to resize the side panel. Double-click to reset. */}
        <ResizeHandle
          className="hidden lg:block"
          direction={-1}
          value={aside.size}
          min={aside.min}
          max={aside.max}
          onChange={aside.setSize}
          onReset={aside.reset}
          label={t("resize.panel")}
        />

        {/* Right: things that need a decision */}
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div role="tablist" aria-label={t("studio.panels")} className="flex gap-1 border-b border-zinc-800 p-1.5">
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
                    active ? "bg-emerald-600/20 text-zinc-50 ring-1 ring-emerald-600/40" : "text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  {t.label}
                  {!!t.badge && (
                    <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold leading-5 text-black tabular-nums">
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
            {tab === "broadcast" && <BroadcastDesk />}
            {tab === "match" && <LiveDataPanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function StudioSkeleton({ message }: { message?: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]" aria-busy="true" aria-label={message ?? "Loading"}>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
