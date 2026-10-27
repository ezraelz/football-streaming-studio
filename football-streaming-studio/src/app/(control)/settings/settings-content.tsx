"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, KeyRound, Radio, RefreshCw, Server, ShieldCheck, Volume2 } from "lucide-react";
import { useShowStore } from "@/lib/stores/show-store";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";

const SECTIONS = [
  { id: "backend", label: "Backend" },
  { id: "provider", label: "Data provider" },
  { id: "overlay", label: "Overlay for OBS" },
  { id: "obs", label: "OBS connection" },
  { id: "audio", label: "Audio routing" },
];

export default function SettingsPage() {
  const { settings, updateSettings, overlayToken, session } = useShowStore();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" description="Connections, overlay access and OBS integration." />

      <div className="mt-6 grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-0 space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-6">
          <BackendSection apiBase={settings.apiBase} onChange={(apiBase) => updateSettings({ apiBase })} />
          <ProviderSection
            name={settings.providerName}
            staleThreshold={settings.staleThresholdSeconds}
            onChange={(patch) => updateSettings(patch)}
          />
          <OverlaySection token={overlayToken} sessionId={session?.id ?? "sess-mock"} />
          <ObsSection />
          <AudioSection />
        </div>
      </div>
    </div>
  );
}

/* ---------- Sections ---------- */

function Section({
  id, icon, title, hint, children,
}: { id: string; icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4">
      <Panel title={title} icon={icon}>
        <p className="mb-4 text-sm text-zinc-400">{hint}</p>
        {children}
      </Panel>
    </div>
  );
}

function BackendSection({ apiBase, onChange }: { apiBase: string; onChange: (v: string) => void }) {
  return (
    <Section id="backend" icon={<Server className="h-4 w-4" />} title="Backend API"
      hint="Where the app sends control and data requests. Point this at your Django host once it's deployed.">
      <Field label="API base URL" htmlFor="api-base">
        <input id="api-base" value={apiBase} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "font-mono")} />
      </Field>
      <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
        Using in-memory mock data until Django is wired.
      </p>
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
    <Section id="provider" icon={<Radio className="h-4 w-4" />} title="Football data provider"
      hint="Where live scores and events come from.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Provider" htmlFor="provider-name">
          <input id="provider-name" value={name} onChange={(e) => onChange({ providerName: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Treat data as stale after" htmlFor="stale" hint="Seconds without an update. Time-sensitive commentary pauses when data goes stale.">
          <input
            id="stale"
            type="number"
            min={5}
            value={staleThreshold}
            onChange={(e) => onChange({ staleThresholdSeconds: parseInt(e.target.value, 10) || 30 })}
            className={cn(inputClass, "tabular-nums")}
          />
        </Field>
      </div>
      <Alert tone="warn" className="mt-4">
        <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Provider keys are configured on the Django server, never in this app.</span>
      </Alert>
    </Section>
  );
}

function CopyField({
  label, id, value, disabled, extra,
}: { label: string; id: string; value: string; disabled?: boolean; extra?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard may be blocked */ }
  };
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex gap-2">
        <input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} className={cn(inputClass, "font-mono text-xs")} />
        <Button onClick={copy} disabled={disabled} className="w-24">
          {copied ? <Check className="h-4 w-4 text-emerald-400" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {extra}
      </div>
      <span className="sr-only" aria-live="polite">{copied ? `${label} copied` : ""}</span>
    </Field>
  );
}

function OverlaySection({ token, sessionId }: { token: string | null; sessionId: string }) {
  const { session } = useShowStore();
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  // One URL, no `scene=`: this source shows the scene, the graphics and the ticker, and follows
  // scene changes made in the studio. (`?scene=<key>` still works to pin a source to one scene.)
  const overlayUrl = token
    ? `${base}/overlay/${sessionId}?token=${token}`
    : `${base}/overlay/${sessionId}`;

  const rotate = async () => {
    if (!session) return;
    setRotating(true);
    setError(null);
    try {
      const updated = await api.rotateToken(session.id);
      useShowStore.setState({ session: updated, overlayToken: updated.overlay_token });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rotate the token.");
    } finally {
      setRotating(false);
    }
  };

  return (
    <Section id="overlay" icon={<KeyRound className="h-4 w-4" />} title="Overlay for OBS"
      hint="Add ONE Browser Source (1920×1080) with this URL, full-frame, above your video. It renders the scene, graphics cards and ticker together — the same picture as the studio preview. The link contains a secret token; don't share it.">
      <div className="flex flex-col gap-4">
        <CopyField label="Overlay URL" id="overlay-url" value={overlayUrl} />
        <CopyField
          label="Session token"
          id="overlay-token"
          value={token ?? "No active session"}
          disabled={!token}
          extra={
            <Button onClick={rotate} disabled={!token || !session} loading={rotating} title="Invalidates the old URL">
              {!rotating && <RefreshCw className="h-4 w-4" aria-hidden />} Rotate
            </Button>
          }
        />
        {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}
        <ul className="space-y-1 text-xs text-zinc-400">
          <li>Scene changes, graphics and the ticker all arrive through this one page — you don&apos;t need a Browser Source per scene.</li>
          <li>Tip: in the source&apos;s properties, leave &ldquo;Shutdown source when not visible&rdquo; off so it keeps its state.</li>
          <li>Overlays are read-only and limited to one show. Rotating the token breaks the old URL, so update OBS afterwards.</li>
        </ul>
      </div>
    </Section>
  );
}

export function ObsSection() {
  const [status, setStatus] = useState<{ connected: boolean; current_scene: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { setStatus(await api.obsStatus()); }
    catch { setStatus({ connected: false, current_scene: null }); }
  };

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    const id = setInterval(refresh, 10000);
    return () => { window.clearTimeout(first); clearInterval(id); };
  }, []);

  const reconnect = async () => {
    setBusy(true);
    try { setStatus(await api.obsReconnect()); } finally { setBusy(false); }
  };

  return (
    <Section id="obs" icon={<Radio className="h-4 w-4" />} title="OBS connection"
      hint="Optional. When connected, scene changes here are pushed to OBS automatically.">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="flex items-center gap-2.5 text-sm" role="status">
          <span className={cn("h-2.5 w-2.5 rounded-full", status?.connected ? "bg-emerald-400" : "bg-zinc-600")} aria-hidden />
          {status === null ? "Checking…"
            : status.connected ? `Connected${status.current_scene ? ` · on “${status.current_scene}”` : ""}`
            : "Not connected"}
        </div>
        
        <Button onClick={reconnect} loading={busy}>
          {!busy && <RefreshCw className="h-4 w-4" aria-hidden />} Reconnect
        </Button>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-zinc-400">
        <li>Enable the WebSocket server in <strong className="text-zinc-200">OBS → Tools → WebSocket Server Settings</strong>.</li>
        <li>If disconnected, the app still works — scene changes just stay local.</li>
      </ul>
    </Section>
  );
}

function AudioSection() {
  const steps: ReactNode[] = [
    <>Add a <strong>Microphone</strong> source for the presenter.</>,
    <>Add an <strong>Application Audio</strong> capture routed to this app for AI voice playback.</>,
    <>Turn on <strong>Monitor and Output</strong> for the voice source so you can hear it without a second device.</>,
  ];
  return (
    <Section id="audio" icon={<Volume2 className="h-4 w-4" />} title="Audio routing"
      hint="Presenter mic and AI voice must be separate audio sources in OBS.">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-zinc-200">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
