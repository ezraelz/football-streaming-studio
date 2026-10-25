"use client";
import { Suspense, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useShowStore } from "@/lib/stores/show-store";
import { useSocket } from "@/lib/hooks/use-socket";
import { api } from "@/lib/api/client";
import { SceneList } from "@/components/control/scene-list";
import { PreviewPane } from "@/components/control/preview-pane";
import { LiveDataPanel } from "@/components/control/live-data-panel";
import { SuggestionFeed } from "@/components/control/suggestion-feed";
import type { ShowSession } from "@/lib/types/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function StudioContent() {
  const params = useParams<{ sessionId: string }>();
  const { session, snapshot, loadMock, setSession } = useShowStore();

  // Load the session from the API if the store doesn't have it yet
  // (e.g. user hard-reloaded the page and the store was wiped)
  useEffect(() => {
    if (session && session.id === params.sessionId) return; // already loaded
    if (!UUID_RE.test(params.sessionId)) {
      // Mock session — seed with loadMock
      loadMock();
      return;
    }
    // Real session — fetch it from the API
    api.getSession(params.sessionId)
      .then((s) => setSession(s))
      .catch(() => {
        // If the session doesn't exist, fall back to mock
        loadMock();
      });
  }, [params.sessionId, session, setSession, loadMock]);

  // Fetch the snapshot from the API if we have a real session but no snapshot
  useEffect(() => {
    if (!session || !UUID_RE.test(session.id)) return;
    if (snapshot) return;

    api.match(session.match_id)
      .then((snap) => useShowStore.setState({ snapshot: snap }))
      .catch(() => {
        // Snapshot not ready — the poller may not have synced the match yet
      });
  }, [session, snapshot]);

  // WebSocket: session updates and scene commands
  const isRealSession = UUID_RE.test(params.sessionId);
  const wsPath = isRealSession ? `/ws/v1/show-sessions/${params.sessionId}` : null;

  useSocket<ShowSession>(wsPath, (msg) => {
    if (msg.type === "session.update") {
      setSession(msg.data);
    }
    if (msg.type === "scene.command" && (msg.data as any).scene_id) {
      useShowStore.getState().setScene((msg.data as any).scene_id);
    }
  });

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        Loading session…
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[220px_1fr_360px] gap-4">
      <SceneList />
      <PreviewPane sessionId={params.sessionId} />
      <div className="flex flex-col gap-4 overflow-y-auto">
        <div className="flex gap-2">
          <Link href={`/studio/${params.sessionId}/commentary`} className="flex-1 rounded border border-zinc-700 py-1.5 text-center text-xs text-zinc-300 hover:bg-zinc-800">Commentary</Link>
          <Link href={`/studio/${params.sessionId}/automation`} className="flex-1 rounded border border-zinc-700 py-1.5 text-center text-xs text-zinc-300 hover:bg-zinc-800">Automation</Link>
          <Link href={`/studio/${params.sessionId}/log`} className="flex-1 rounded border border-zinc-700 py-1.5 text-center text-xs text-zinc-300 hover:bg-zinc-800">Log</Link>
        </div>
        <LiveDataPanel />
        <Suspense fallback={null}>
          <SuggestionFeed />
        </Suspense>
      </div>
    </div>
  );
}