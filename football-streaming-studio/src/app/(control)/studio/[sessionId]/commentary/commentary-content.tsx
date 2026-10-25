"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  api, CommentaryItem, LogEntry,
} from "@/lib/api/client";
import type { ShowProfile } from "@/lib/types/types";
import { useSocket } from "@/lib/hooks/use-socket";
import { cn, timeAgo } from "@/lib/utility/utils";
import {
  Check, SkipForward, Mic, Languages, XCircle,
  RefreshCw, AlertCircle,
} from "lucide-react";

type CommentaryMode = "off" | "suggest" | "approval" | "auto";

const MODES: { key: CommentaryMode; label: string; hint: string }[] = [
  { key: "off", label: "Off", hint: "No AI lines generated." },
  { key: "suggest", label: "Suggest only", hint: "Show suggestions, never play automatically." },
  { key: "approval", label: "Approval required", hint: "Queue a line after you approve it." },
  { key: "auto", label: "Automated", hint: "Play within safety rules — no clicks required." },
];

export function CommentaryContent() {
  const params = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<{
    id: string; state: string; mode: string; show_profile_id: string;
  } | null>(null);
  const [profile, setProfile] = useState<ShowProfile | null>(null);
  const [pending, setPending] = useState<CommentaryItem[]>([]);
  const [transcript, setTranscript] = useState<CommentaryItem[]>([]);
  const [logTail, setLogTail] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Derived config from profile
  const config = (profile?.commentary_config ?? {}) as {
    mode?: CommentaryMode; voice?: string; language?: string;
  };
  const mode = config.mode ?? "approval";
  const voice = config.voice ?? "en-US-Neural-A";
  const language = config.language ?? "en";

  const refresh = useCallback(async () => {
    try {
      const s = await api.getSession(params.sessionId);
      setSession({
        id: s.id, state: s.state, mode: s.mode,
        show_profile_id: s.show_profile_id,
      });
      const [p, pend, played] = await Promise.all([
        api.getProfile(s.show_profile_id),
        api.listCommentary(params.sessionId, "pending_approval"),
        api.listAllCommentary(params.sessionId),
      ]);
      setProfile(p);
      setPending(pend);
      setTranscript(
        played.filter((i) => ["played", "queued", "approved", "skipped"].includes(i.status))
      );
      const log = await api.sessionLog(params.sessionId);
      setLogTail(log.slice(0, 5));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load commentary desk");
    }
  }, [params.sessionId]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  // Live updates over WS
  useSocket<CommentaryItem>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type === "commentary.update") {
      const item = msg.data;
      setPending((prev) => {
        const filtered = prev.filter((i) => i.id !== item.id);
        return item.status === "pending_approval" ? [item, ...filtered] : filtered;
      });
      setTranscript((prev) => {
        const filtered = prev.filter((i) => i.id !== item.id);
        return ["played", "queued", "approved", "skipped"].includes(item.status)
          ? [item, ...filtered]
          : filtered;
      });
    }
  });

  useSocket<LogEntry>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type === "log.update") {
      setLogTail((prev) => [msg.data, ...prev].slice(0, 5));
    }
  });

  // --- Actions ---
  const onApprove = async (id: string) => {
    setBusy(id);
    try { await api.approveCommentary(id); } catch { /* logged */ }
    finally { setBusy(null); }
  };
  const onSkip = async (id: string) => {
    setBusy(id);
    try { await api.skipCommentary(id); } catch { /* logged */ }
    finally { setBusy(null); }
  };
  const onRegenerate = async (id: string) => {
    setBusy(id);
    try { await api.regenerateCommentary(id); } catch { /* logged */ }
    finally { setBusy(null); }
  };

  const onModeChange = async (nextMode: CommentaryMode) => {
    if (!profile) return;
    setBusy("mode");
    try {
      await api.updateCommentaryConfig(profile.id, { ...config, mode: nextMode });
      await refresh();
    } finally { setBusy(null); }
  };

  const onVoiceChange = async (voice: string) => {
    if (!profile) return;
    await api.updateCommentaryConfig(profile.id, { ...config, voice });
    await refresh();
  };

  const onLanguageChange = async (language: string) => {
    if (!profile) return;
    await api.updateCommentaryConfig(profile.id, { ...config, language });
    await refresh();
  };

  const onStop = async () => {
    setBusy("stop");
    try { await api.transition(params.sessionId, "stopped"); await refresh(); }
    finally { setBusy(null); }
  };

  const onSpeak = async (id: string) => {
    setBusy(id);
    try {
      await api.speakCommentary(id);
      // Approval flow also promotes the item:
      await api.approveCommentary(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Speak failed");
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-sm text-zinc-500">
        Loading session…
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Commentary Desk</h1>
          <p className="text-sm text-zinc-400">
            Review suggestions, adjust mode, and monitor the transcript.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "rounded px-2 py-0.5 text-xs font-semibold uppercase",
            session.state === "live" ? "bg-red-600/20 text-red-300" : "bg-zinc-700/40 text-zinc-300"
          )}>
            {session.state}
          </span>
          <Link
            href={`/studio/${params.sessionId}`}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            ← Back to Studio
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* LEFT — Mode + Suggestions + Transcript */}
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Commentary Mode
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => onModeChange(m.key)}
                  disabled={busy === "mode"}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-xs disabled:opacity-40",
                    mode === m.key
                      ? "border-emerald-600 bg-emerald-600/20 text-emerald-200"
                      : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  )}
                >
                  <div className="font-semibold">{m.label}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-400">{m.hint}</div>
                </button>
              ))}
            </div>
            {mode === "auto" && <AutomationPreflight />}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Pending Suggestions
              </div>
              <span className="text-xs text-zinc-500">{pending.length}</span>
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing pending right now.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {pending.map((item) => (
                  <PendingCard
                    key={item.id}
                    item={item}
                    onSpeak={onSpeak}
                    busy={busy === item.id}
                    onApprove={() => onApprove(item.id)}
                    onSkip={() => onSkip(item.id)}
                    onRegenerate={() => onRegenerate(item.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Transcript
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{transcript.length} lines</span>
                <button
                  onClick={refresh}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-800"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            </div>
            {transcript.length === 0 ? (
              <p className="text-sm text-zinc-500">No lines yet.</p>
            ) : (
              <ul className="space-y-2">
                {transcript.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded border border-zinc-800 bg-zinc-950/40 p-3"
                  >
                    <StatusChip status={item.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200">{item.text}</p>
                      <div className="mt-1 text-[10px] text-zinc-500">
                        {item.language} · {item.priority} · {item.model_version} ·{" "}
                        {item.trigger_event_id ?? "scheduled"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* RIGHT — Voice, safety, recent log */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Mic className="h-3.5 w-3.5" /> Voice
            </div>
            <label className="mb-1 block text-[11px] text-zinc-400">Voice model</label>
            <select
              value={voice}
              onChange={(e) => onVoiceChange(e.target.value)}
              className="mb-3 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
            >
              <option value="en-US-Neural-A">en-US · Neural A (female)</option>
              <option value="en-US-Neural-B">en-US · Neural B (male)</option>
              <option value="en-GB-Neural-A">en-GB · Neural A</option>
              <option value="en-GB-Neural-B">en-GB · Neural B</option>
            </select>

            <label className="mb-1 flex items-center gap-1 text-[11px] text-zinc-400">
              <Languages className="h-3 w-3" /> Language
            </label>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="pt">Portuguese</option>
              <option value="fr">French</option>
            </select>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Cooldowns (server-enforced)
            </div>
            <CooldownRow label="Goal announcements" value="8s" />
            <CooldownRow label="Stat observations" value="45s" />
            <CooldownRow label="Max line length" value="140 chars" />
            <CooldownRow label="Line expires after" value="90s" />
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Recent activity
            </div>
            {logTail.length === 0 ? (
              <p className="text-xs text-zinc-500">No entries yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {logTail.map((e) => (
                  <li key={e.id} className="text-[11px] text-zinc-400">
                    <span className="mr-1 text-zinc-600">·</span>
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
              <XCircle className="h-3.5 w-3.5" /> Safety
            </div>
            <p className="text-[11px] leading-relaxed text-red-200/70">
              Emergency stop cancels queued speech and stops automated scene changes.
              Scores and graphics remain live.
            </p>
            <button
              onClick={onStop}
              disabled={busy === "stop" || session.state === "stopped"}
              className="mt-3 w-full rounded bg-red-700 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
            >
              {busy === "stop" ? "Stopping…" : "Emergency Stop"}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function PendingCard({
  item, busy, onApprove, onSkip, onRegenerate, onSpeak,
}: {
  item: CommentaryItem;
  busy: boolean;
  onApprove: () => void;
  onSkip: () => void;
  onRegenerate: () => void;
  onSpeak: (id: string) => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] text-zinc-500">
        <span className={cn(
          "rounded px-1.5 py-0.5 font-medium",
          item.priority === "high" ? "bg-red-600/20 text-red-300" :
          item.priority === "normal" ? "bg-blue-600/20 text-blue-300" :
          "bg-zinc-700/50"
        )}>{item.priority}</span>
        <span>{item.model_version}</span>
        <span>·</span>
        <span>expires {timeAgo(item.expires_at)}</span>
      </div>
      <p className="text-sm text-zinc-200">{item.text}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onApprove} disabled={busy}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" /> Approve & Play
        </button>
        <button
          onClick={onSkip} disabled={busy}
          className="flex items-center gap-1.5 rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-40"
        >
          <SkipForward className="h-3.5 w-3.5" /> Skip
        </button>
        <button
          onClick={onRegenerate} disabled={busy}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Regenerate
        </button>
        <button
          onClick={() => void onSpeak(item.id)}
          disabled={busy}
          className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          <Mic className="h-3.5 w-3.5" /> Speak
        </button>
      </div>
    </div>
  );
}

function CooldownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs text-zinc-300">
      <span className="text-zinc-400">{label}</span>
      <span className="rounded bg-zinc-800 px-1.5 py-0.5 tabular-nums">{value}</span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "played" ? "bg-emerald-600/20 text-emerald-300"
    : status === "queued" ? "bg-blue-600/20 text-blue-300"
    : status === "approved" ? "bg-emerald-600/20 text-emerald-200"
    : status === "skipped" ? "bg-zinc-700/60 text-zinc-400"
    : status === "failed" ? "bg-red-600/20 text-red-300"
    : "bg-zinc-700/60 text-zinc-400";
  return (
    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase", tone)}>
      {status}
    </span>
  );
}

function AutomationPreflight() {
  const checks = [
    "Match data is fresh and provider is connected",
    "OBS Browser Source loaded at 1920×1080",
    "Audio routing verified (TTS → OBS)",
    "Emergency stop tested in this session",
    "Cooldowns & rate limits configured",
  ];
  return (
    <div className="mt-4 rounded-md border border-amber-700/50 bg-amber-950/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-300">
        <AlertCircle className="h-3.5 w-3.5" /> Preflight · Automated mode
      </div>
      <ul className="space-y-1 text-[11px] text-amber-200/80">
        {checks.map((c) => (
          <li key={c} className="flex items-start gap-2">
            <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-amber-500" />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}