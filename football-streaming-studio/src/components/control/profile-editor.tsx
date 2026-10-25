"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { ShowProfile, ShowMode } from "@/lib/types/types";
import { cn } from "@/lib/utility/utils";
import { X, AlertCircle } from "lucide-react";

export function ProfileEditor({
  initial, onClose, onSaved,
}: {
  initial: ShowProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState<ShowMode>(initial?.mode ?? "human");
  const theme = (initial?.theme_config ?? {}) as { primary?: string; accent?: string };
  const [primary, setPrimary] = useState(theme.primary ?? "#10b981");
  const [accent, setAccent] = useState(theme.accent ?? "#3b82f6");

  const commentary = (initial?.commentary_config ?? {}) as {
    mode?: string; voice?: string; language?: string;
  };
  const [commMode, setCommMode] = useState(commentary.mode ?? "approval");
  const [voice, setVoice] = useState(commentary.voice ?? "en-US-Neural-A");
  const [language, setLanguage] = useState(commentary.language ?? "en");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      name: name || "Untitled show",
      mode,
      theme_config: { primary, accent, logo: null },
      commentary_config: { mode: commMode, voice, language },
    };
    try {
      if (initial) await api.updateProfile(initial.id, payload);
      else await api.createProfile(payload as Omit<ShowProfile, "id">);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initial ? "Edit profile" : "New show profile"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly PL Review"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Mode">
            <div className="grid grid-cols-2 gap-2">
              {(["human", "automated"] as ShowMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded border px-3 py-2 text-sm capitalize",
                    mode === m
                      ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                      : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Theme">
            <div className="flex gap-3">
              <ColorInput label="Primary" value={primary} onChange={setPrimary} />
              <ColorInput label="Accent" value={accent} onChange={setAccent} />
            </div>
          </Field>

          <Field label="Commentary">
            <div className="space-y-2">
              <select
                value={commMode}
                onChange={(e) => setCommMode(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              >
                <option value="off">Off</option>
                <option value="suggest">Suggest only</option>
                <option value="approval">Approval required</option>
                <option value="auto">Automated</option>
              </select>
              <div className="flex gap-2">
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                >
                  <option value="en-US-Neural-A">en-US Neural A</option>
                  <option value="en-US-Neural-B">en-US Neural B</option>
                  <option value="en-GB-Neural-A">en-GB Neural A</option>
                  <option value="en-GB-Neural-B">en-GB Neural B</option>
                </select>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                >
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                  <option value="pt">PT</option>
                  <option value="fr">FR</option>
                </select>
              </div>
            </div>
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
          >
            {busy ? "Saving…" : initial ? "Save changes" : "Create profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function ColorInput({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1">
      <div className="mb-1 text-[11px] text-zinc-400">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-zinc-700 bg-zinc-950 p-0.5"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs"
        />
      </div>
    </div>
  );
}