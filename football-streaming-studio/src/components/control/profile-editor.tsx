"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { ShowMode, ShowProfile } from "@/lib/types/types";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Segmented, inputClass } from "@/components/ui/form";
import { cn } from "@/lib/utility/utils";

export function ProfileEditor({
  initial, onClose, onSaved,
}: { initial: ShowProfile | null; onClose: () => void; onSaved: () => void }) {
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState<ShowMode>(initial?.mode ?? "human");
  const theme = (initial?.theme_config ?? {}) as { primary?: string; accent?: string };
  const [primary, setPrimary] = useState(theme.primary ?? "#10b981");
  const [accent, setAccent] = useState(theme.accent ?? "#3b82f6");

  const commentary = (initial?.commentary_config ?? {}) as { mode?: string; voice?: string; language?: string };
  const [commMode, setCommMode] = useState(commentary.mode ?? "approval");
  const [voice, setVoice] = useState(commentary.voice ?? "en-US-Neural-A");
  const [language, setLanguage] = useState(commentary.language ?? "en");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog behaviour: focus the first field, close on Escape.
  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: name.trim() || "Untitled show",
      mode,
      theme_config: { primary, accent, logo: null },
      commentary_config: { mode: commMode, voice, language },
    };
    try {
      if (initial) await api.updateProfile(initial.id, payload);
      else await api.createProfile(payload as Omit<ShowProfile, "id">);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-900 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 id={`${uid}-title`} className="text-lg font-semibold text-zinc-50">
            {initial ? "Edit profile" : "New show profile"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          {error && <Alert tone="error">{error}</Alert>}

          <Field label="Name" htmlFor={`${uid}-name`}>
            <input
              ref={nameRef}
              id={`${uid}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly PL Review"
              className={inputClass}
            />
          </Field>

          <Field label="Who presents?">
            <Segmented
              label="Who presents"
              value={mode}
              onChange={setMode}
              options={[
                { value: "human", label: "Human presenter" },
                { value: "automated", label: "Automated AI" },
              ]}
            />
          </Field>

          <Group title="Colours">
            <div className="flex flex-col gap-3 sm:flex-row">
              <ColorInput label="Primary" value={primary} onChange={setPrimary} />
              <ColorInput label="Accent" value={accent} onChange={setAccent} />
            </div>
            <div
              className="mt-3 flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white"
              style={{ background: `linear-gradient(90deg, ${primary}, ${accent})`, textShadow: "0 1px 2px rgba(0,0,0,.5)" }}
              aria-hidden
            >
              <span>HOME</span><span className="tabular-nums">2 – 1</span><span>AWAY</span>
            </div>
          </Group>

          <Group title="Commentary">
            <div className="space-y-3">
              <Field label="Mode" htmlFor={`${uid}-cm`}>
                <select id={`${uid}-cm`} value={commMode} onChange={(e) => setCommMode(e.target.value)} className={inputClass}>
                  <option value="off">Off</option>
                  <option value="suggest">Suggest only</option>
                  <option value="approval">Approval required</option>
                  <option value="auto">Automated</option>
                </select>
              </Field>
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Field label="Voice" htmlFor={`${uid}-voice`}>
                  <select id={`${uid}-voice`} value={voice} onChange={(e) => setVoice(e.target.value)} className={inputClass}>
                    <option value="en-US-Neural-A">en-US Neural A</option>
                    <option value="en-US-Neural-B">en-US Neural B</option>
                    <option value="en-GB-Neural-A">en-GB Neural A</option>
                    <option value="en-GB-Neural-B">en-GB Neural B</option>
                  </select>
                </Field>
                <Field label="Language" htmlFor={`${uid}-lang`}>
                  <select id={`${uid}-lang`} value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
                    <option value="en">EN</option>
                    <option value="es">ES</option>
                    <option value="pt">PT</option>
                    <option value="fr">FR</option>
                  </select>
                </Field>
              </div>
            </div>
          </Group>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 bg-zinc-900 px-5 py-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Create profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-zinc-800 p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</legend>
      {children}
    </fieldset>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex-1">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-200">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 p-0.5"
        />
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "font-mono text-xs")} />
      </div>
    </div>
  );
}
