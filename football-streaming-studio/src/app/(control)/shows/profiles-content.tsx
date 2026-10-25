"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ShowProfile } from "@/lib/types/types";
import { Plus, Radio, Trash2, Edit3, Play, RefreshCw } from "lucide-react";
import { ProfileEditor } from "@/components/control/profile-editor";
import { useShowStore } from "@/lib/stores/show-store";

export function ProfilesContent() {
  const router = useRouter();
  const { loadMock } = useShowStore();

  const [profiles, setProfiles] = useState<ShowProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShowProfile | "new" | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listProfiles();
      setProfiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const useProfile = async (profile: ShowProfile) => {
    try {
      const session = await api.createSession(profile.id, "match-001");
      loadMock(profile.id);
      useShowStore.setState({
        session,
        overlayToken: session.overlay_token,
        commentaryMode: (profile.commentary_config as { mode?: string })?.mode as any ?? "approval",
        voice: (profile.commentary_config as { voice?: string })?.voice ?? "en-US-Neural-A",
        language: (profile.commentary_config as { language?: string })?.language ?? "en",
      });
      router.push(`/studio/${session.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create session");
    }
  };

  const remove = async (p: ShowProfile) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await api.deleteProfile(p.id);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-500">
        Loading profiles…
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Show Profiles</h1>
          <p className="text-sm text-zinc-400">
            Reusable theme and commentary settings for your broadcasts.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" /> New profile
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
          No profiles yet. Create one to start a show.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onUse={() => useProfile(p)}
              onEdit={() => setEditing(p)}
              onDelete={() => remove(p)}
            />
          ))}
        </div>
      )}

      {editing && (
        <ProfileEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ProfileCard({
  profile, onUse, onEdit, onDelete,
}: {
  profile: ShowProfile;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = profile.theme_config as { primary?: string; accent?: string };
  const commentary = profile.commentary_config as { mode?: string; voice?: string };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-semibold">{profile.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
            <Radio className="h-3 w-3" />
            {profile.mode === "human" ? "Human presenter" : "Automated AI"}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800">
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="rounded p-1.5 text-zinc-500 hover:bg-red-900/40 hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          <Swatch color={theme?.primary ?? "#10b981"} label="Primary" />
          <Swatch color={theme?.accent ?? "#3b82f6"} label="Accent" />
        </div>
        <div className="ml-auto text-[11px] text-zinc-500">
          {commentary?.mode} · {commentary?.voice}
        </div>
      </div>

      <button
        onClick={onUse}
        className="flex items-center justify-center gap-2 rounded bg-emerald-600/20 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30"
      >
        <Play className="h-4 w-4" /> Start session
      </button>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-4 w-4 rounded border border-zinc-700" style={{ background: color }} />
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}