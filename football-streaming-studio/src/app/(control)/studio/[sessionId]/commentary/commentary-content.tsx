"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type CommentaryItem, type LogEntry } from "@/lib/api/client";
import type { ShowProfile } from "@/lib/types/types";
import { useSocket } from "@/lib/hooks/use-socket";
import { cn, formatTime } from "@/lib/utility/utils";
import { Languages, Mic, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Segmented, inputClass } from "@/components/ui/form";
import { SuggestionCard } from "@/components/control/suggestion-card";

type CommentaryMode = "off" | "suggest" | "approval" | "auto";

const MODES: { value: CommentaryMode; label: string; description: string }[] = [
  { value: "off", label: "Off", description: "No AI lines are generated." },
  { value: "suggest", label: "Suggest only", description: "Lines appear here but never play on their own." },
  { value: "approval", label: "Approval required", description: "A line is queued only after you approve it." },
  { value: "auto", label: "Automated", description: "Lines play within safety rules — no clicks needed." },
];

const TRANSCRIPT_STATUSES = ["played", "queued", "approved", "skipped"];

const STATUS_TONE: Record<string, Tone> = {
  played: "success", approved: "success", queued: "info", skipped: "neutral", failed: "danger",
};

export function CommentaryContent() {
  const params = useParams<{ sessionId: string }>();

  const [profile, setProfile] = useState<ShowProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<CommentaryItem[]>([]);
  const [transcript, setTranscript] = useState<CommentaryItem[]>([]);
  const [logTail, setLogTail] = useState<LogEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const config = (profile?.commentary_config ?? {}) as {
    mode?: CommentaryMode; voice?: string; language?: string;
  };
  const mode = config.mode ?? "approval";
  const voice = config.voice ?? "en-US-Neural-A";
  const language = config.language ?? "en";

  const refresh = useCallback(async () => {
    try {
      const s = await api.getSession(params.sessionId);
      const [p, pend, played] = await Promise.all([
        api.getProfile(s.show_profile_id),
        api.listCommentary(params.sessionId, "pending_approval"),
        api.listAllCommentary(params.sessionId),
      ]);
      setProfile(p);
      setPending(pend);
      setTranscript(played.filter((i) => TRANSCRIPT_STATUSES.includes(i.status)));
      const log = await api.sessionLog(params.sessionId);
      setLogTail(log.slice(0, 5));
      setLoadError(null);
      setLoaded(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load the commentary desk");
    }
  }, [params.sessionId]);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  // Live updates over WS
  useSocket<CommentaryItem | LogEntry>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type === "commentary.update") {
      const item = msg.data as CommentaryItem;
      setPending((prev) => {
        const rest = prev.filter((i) => i.id !== item.id);
        return item.status === "pending_approval" ? [item, ...rest] : rest;
      });
      setTranscript((prev) => {
        const rest = prev.filter((i) => i.id !== item.id);
        return TRANSCRIPT_STATUSES.includes(item.status) ? [item, ...rest] : rest;
      });
    }
    if (msg.type === "log.update") {
      setLogTail((prev) => [msg.data as LogEntry, ...prev].slice(0, 5));
    }
  });

  const act = async (id: string, fn: () => Promise<unknown>, failure: string) => {
    setBusy(id);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error && e.message ? `${failure} ${e.message}` : failure);
    } finally {
      setBusy(null);
    }
  };

  const onApprove = (id: string) => act(id, () => api.approveCommentary(id), "Couldn't approve that line.");
  const onSkip = (id: string) => act(id, () => api.skipCommentary(id), "Couldn't skip that line.");
  const onRegenerate = (id: string) => act(id, () => api.regenerateCommentary(id), "Couldn't regenerate that line.");
  const onSpeak = (id: string) =>
    act(id, async () => {
      await api.speakCommentary(id);
      await api.approveCommentary(id); // approval flow also promotes the item
    }, "Couldn't speak that line.");

  const updateConfig = (patch: Partial<typeof config>, key: string) =>
    profile
      ? act(key, async () => {
          await api.updateCommentaryConfig(profile.id, { ...config, ...patch });
          await refresh();
        }, "Couldn't save that setting.")
      : Promise.resolve();

  if (loadError) {
    return (
      <Alert tone="error">
        <p className="font-medium">The commentary desk didn&apos;t load.</p>
        <p className="mt-0.5 text-red-200/80">{loadError}</p>
        <Button size="sm" className="mt-2" onClick={() => { setLoadError(null); void refresh(); }}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </Button>
      </Alert>
    );
  }

  if (!loaded) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]" aria-busy="true">
        <div className="flex flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const emptyCopy =
    mode === "off" ? "Commentary is off. Choose a mode on the right to start receiving lines."
    : mode === "auto" ? "Automated mode plays lines without approval, so nothing waits here."
    : "New AI lines will appear here as soon as something happens in the match.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Commentary desk"
        description="Approve what the AI says, set how much it can do on its own, and review what has aired."
      />

      {actionError && <Alert tone="error" onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT — the work */}
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Waiting for you"
            icon={<Sparkles className="h-4 w-4" />}
            actions={pending.length > 0 ? <Badge tone="warn">{pending.length} pending</Badge> : undefined}
          >
            {pending.length === 0 ? (
              <EmptyState title="Nothing to approve" description={emptyCopy} className="border-0 py-6" />
            ) : (
              <div className="flex flex-col gap-3">
                {pending.map((item) => (
                  <SuggestionCard
                    key={item.id}
                    large
                    item={item}
                    busy={busy === item.id}
                    onApprove={() => onApprove(item.id)}
                    onSkip={() => onSkip(item.id)}
                    onRegenerate={() => onRegenerate(item.id)}
                    onSpeak={() => onSpeak(item.id)}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Transcript"
            actions={
              <>
                <span className="text-xs text-zinc-400">{transcript.length} lines</span>
                <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh transcript" title="Refresh">
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </Button>
              </>
            }
          >
            {transcript.length === 0 ? (
              <p className="text-sm text-zinc-400">Nothing has been said yet.</p>
            ) : (
              <ol className="divide-y divide-zinc-800/80">
                {transcript.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <time dateTime={item.created_at} className="w-16 shrink-0 pt-0.5 font-mono text-xs text-zinc-400">
                      {formatTime(item.created_at)}
                    </time>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", item.status === "skipped" ? "text-zinc-500 line-through" : "text-zinc-100")}>
                        {item.text}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.language.toUpperCase()} · {item.priority} · {item.trigger_event_id ?? "scheduled"}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[item.status] ?? "neutral"} className="shrink-0 capitalize">
                      {item.status}
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* RIGHT — the setup */}
        <aside className="flex flex-col gap-4">
          <Panel title="Commentary mode">
            <Segmented
              layout="stack"
              label="Commentary mode"
              value={mode}
              options={MODES}
              disabled={busy === "mode"}
              onChange={(m) => updateConfig({ mode: m }, "mode")}
            />
            {mode === "auto" && <AutomationPreflight />}
          </Panel>

          <Panel title="Voice" icon={<Mic className="h-4 w-4" />}>
            <div className="flex flex-col gap-4">
              <Field label="Voice model" htmlFor="voice">
                <select
                  id="voice"
                  value={voice}
                  onChange={(e) => updateConfig({ voice: e.target.value }, "voice")}
                  className={inputClass}
                >
                  <option value="en-US-Neural-A">en-US · Neural A (female)</option>
                  <option value="en-US-Neural-B">en-US · Neural B (male)</option>
                  <option value="en-GB-Neural-A">en-GB · Neural A</option>
                  <option value="en-GB-Neural-B">en-GB · Neural B</option>
                </select>
              </Field>
              <Field label="Language" htmlFor="language">
                <div className="relative">
                  <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => updateConfig({ language: e.target.value }, "language")}
                    className={cn(inputClass, "pl-9")}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="pt">Portuguese</option>
                    <option value="fr">French</option>
                  </select>
                </div>
              </Field>
            </div>
          </Panel>

          <Panel title="Safety rules" icon={<ShieldCheck className="h-4 w-4" />}>
            <p className="mb-2 text-xs text-zinc-400">Enforced by the server. Emergency stop is always in the top bar.</p>
            <dl className="divide-y divide-zinc-800/80 text-sm">
              <Rule label="Goal announcements" value="8s cooldown" />
              <Rule label="Stat observations" value="45s cooldown" />
              <Rule label="Max line length" value="140 characters" />
              <Rule label="Line expires after" value="90s" />
            </dl>
          </Panel>

          <Panel title="Recent activity">
            {logTail.length === 0 ? (
              <p className="text-sm text-zinc-400">No entries yet.</p>
            ) : (
              <ul className="space-y-2 text-sm text-zinc-300">
                {logTail.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" aria-hidden />
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="font-medium tabular-nums text-zinc-100">{value}</dd>
    </div>
  );
}

const PREFLIGHT = [
  "Match data is fresh and provider is connected",
  "OBS Browser Source loaded at 1920×1080",
  "Audio routing verified (TTS → OBS)",
  "Emergency stop tested in this session",
  "Cooldowns & rate limits configured",
];

/** Real, tickable checklist (it used to be decorative boxes). Local to the session; not enforced. */
function AutomationPreflight() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const count = PREFLIGHT.filter((c) => done[c]).length;
  const ready = count === PREFLIGHT.length;

  return (
    <div className={cn(
      "mt-4 rounded-lg border p-3",
      ready ? "border-emerald-700/50 bg-emerald-950/20" : "border-amber-700/50 bg-amber-950/20",
    )}>
      <div className={cn("mb-2 flex items-center justify-between text-sm font-semibold", ready ? "text-emerald-300" : "text-amber-300")}>
        <span>Before going automated</span>
        <span className="tabular-nums text-xs">{count}/{PREFLIGHT.length}</span>
      </div>
      <ul className="space-y-2">
        {PREFLIGHT.map((c) => (
          <li key={c}>
            <Checkbox checked={!!done[c]} onChange={(v) => setDone((d) => ({ ...d, [c]: v }))}>
              <span className="text-xs text-zinc-200">{c}</span>
            </Checkbox>
          </li>
        ))}
      </ul>
    </div>
  );
}
