"use client";
import { useEffect, useState } from "react";
import { useShowStore } from "@/lib/stores/show-store";
import { cn } from "@/lib/utility/utils";
import {
  Server, Radio, KeyRound, Volume2, ShieldCheck, Copy, Check, RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api/client";

export default function SettingsPage() {
  const { settings, updateSettings, overlayToken, session } = useShowStore();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-400">
          Connections, overlay access, and OBS integration.
        </p>
      </header>

      <BackendSection
        apiBase={settings.apiBase}
        onChange={(apiBase) => updateSettings({ apiBase })}
      />

      <ProviderSection
        name={settings.providerName}
        staleThreshold={settings.staleThresholdSeconds}
        onChange={(patch) => updateSettings(patch)}
      />

      <OverlaySection
        token={overlayToken}
        sessionId={session?.id ?? "sess-mock"}
      />

      <ObsSection
        url={settings.obsUrl}
        connected={settings.obsConnected}
        onChange={(patch) => updateSettings(patch)}
      />

      <AudioSection />
    </div>
  );
}

/* ---------- Sections ---------- */

function BackendSection({
  apiBase, onChange,
}: { apiBase: string; onChange: (v: string) => void }) {
  return (
    <Section icon={<Server className="h-4 w-4" />} title="Backend API" hint="Where the app sends control and data requests. Swap this to your Django host once it's deployed.">
      <label className="block text-xs text-zinc-400">API base URL</label>
      <input
        value={apiBase}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono"
      />
      <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Using in-memory mock data until Django is wired.
      </div>
    </Section>
  );
}

function ProviderSection({
  name, staleThreshold, onChange,
}: {
  name: string;
  staleThreshold: number;
  onChange: (patch: { providerName?: string; staleThresholdSeconds?: number }) => void;
}) {
  return (
    <Section icon={<Radio className="h-4 w-4" />} title="Football Data Provider" hint="Server-side only. Provider credentials never touch the client.">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400">Provider</label>
          <input
            value={name}
            onChange={(e) => onChange({ providerName: e.target.value })}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">
            Stale threshold (seconds)
          </label>
          <input
            type="number"
            min={5}
            value={staleThreshold}
            onChange={(e) =>
              onChange({ staleThresholdSeconds: parseInt(e.target.value, 10) || 30 })
            }
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded border border-amber-800/40 bg-amber-950/20 p-2 text-[11px] text-amber-300/80">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        Provider keys are configured on the Django server, not in this app.
      </div>
    </Section>
  );
}

function OverlaySection({
  token, sessionId,
}: { token: string | null; sessionId: string }) {
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  const base =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const overlayUrl = token
    ? `${base}/overlay/${sessionId}?scene=scoreboard&token=${token}`
    : `${base}/overlay/${sessionId}?scene=scoreboard`;

  const copy = async (which: "url" | "token", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard may be blocked; silently ignore */
    }
  };

  return (
    <Section
      icon={<KeyRound className="h-4 w-4" />}
      title="Overlay Access"
      hint="This URL is what you paste into OBS as a Browser Source. Use the token — never share it publicly."
    >
      <label className="block text-xs text-zinc-400">Overlay URL</label>
      <div className="mt-1 flex gap-2">
        <input
          readOnly
          value={overlayUrl}
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-300"
        />
        <button
          onClick={() => copy("url", overlayUrl)}
          className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          {copied === "url" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          Copy
        </button>
      </div>

      <label className="mt-3 block text-xs text-zinc-400">Session token</label>
      <div className="mt-1 flex gap-2">
        <input
          readOnly
          value={token ?? "No active session"}
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-300"
        />
        <button
          disabled={!token}
          onClick={() => token && copy("token", token)}
          className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          {copied === "token" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          Copy
        </button>
        <button
          disabled={!token}
          className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          title="Rotate token (backend will implement)"
        >
          <RefreshCw className="h-3 w-3" /> Rotate
        </button>
      </div>

      <div className="mt-3 rounded border border-zinc-800 bg-zinc-950/40 p-3 text-[11px] text-zinc-500">
        Overlays are read-only and scoped to one session. In production, the token
        will be short-lived and revocable from this page.
      </div>
    </Section>
  );
}


function ObsSection() {
  const [status, setStatus] = useState<{ connected: boolean; current_scene: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setStatus(await api.obsStatus());
    } catch {
      setStatus({ connected: false, current_scene: null });
    }
  };

  useEffect(() => {
    const initialRefresh = window.setTimeout(refresh, 0);
    const id = setInterval(refresh, 10000);
    return () => {
      window.clearTimeout(initialRefresh);
      clearInterval(id);
    };
  }, []);

  const reconnect = async () => {
    setBusy(true);
    try {
      setStatus(await api.obsReconnect());
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <span className="text-zinc-400"><Radio className="h-4 w-4" /></span>
        OBS Integration
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Optional. If connected, scene changes in this app are pushed to OBS automatically.
      </p>

      <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn(
            "h-2 w-2 rounded-full",
            status?.connected ? "bg-emerald-400" : "bg-zinc-600"
          )} />
          {status === null ? "Checking…" :
           status.connected ? `Connected${status.current_scene ? ` · ${status.current_scene}` : ""}` :
           "Not connected"}
        </div>
        <button
          onClick={reconnect}
          disabled={busy}
          className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} /> Reconnect
        </button>
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-zinc-500">
        <div>OBS WebSocket must be enabled in <strong>OBS → Tools → WebSocket Server Settings</strong>.</div>
        <div>If disconnected, the app still works — scene switches are local only.</div>
      </div>
    </section>
  );
}

export { ObsSection };

function AudioSection() {
  return (
    <Section
      icon={<Volume2 className="h-4 w-4" />}
      title="Audio Routing"
      hint="Human presenter mic and AI TTS must be separate audio sources in OBS."
    >
      <ul className="space-y-2 text-sm text-zinc-300">
        <li className="flex gap-2">
          <span className="text-zinc-500">1.</span>
          Add a <strong>Microphone</strong> source for the presenter.
        </li>
        <li className="flex gap-2">
          <span className="text-zinc-500">2.</span>
          Add an <strong>Application Audio</strong> capture routed to the studio app
          for AI TTS playback.
        </li>
        <li className="flex gap-2">
          <span className="text-zinc-500">3.</span>
          Enable <strong>Monitor and Output</strong> on the TTS source so you can hear
          it locally without a second device.
        </li>
      </ul>
    </Section>
  );
}

/* ---------- Layout ---------- */

function Section({
  icon, title, hint, children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <span className="text-zinc-400">{icon}</span>
        {title}
      </div>
      <p className="mb-4 text-xs text-zinc-500">{hint}</p>
      {children}
    </section>
  );
}