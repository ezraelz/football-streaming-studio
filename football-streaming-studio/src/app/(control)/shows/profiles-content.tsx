"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, Edit3, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import type { ShowProfile } from "@/lib/types/types";
import { ProfileEditor } from "@/components/control/profile-editor";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";

const MODE_LABEL: Record<string, string> = {
  off: "Commentary off", suggest: "Suggest only", approval: "Approval required", auto: "Automated",
};

export function ProfilesContent() {
  const [profiles, setProfiles] = useState<ShowProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShowProfile | "new" | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await api.listProfiles());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const remove = async (p: ShowProfile) => {
    try {
      await api.deleteProfile(p.id);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Show profiles"
        description="Reusable looks and commentary settings. Pick one when you start a show."
        actions={
          <>
            <Button onClick={refresh} aria-label="Refresh profiles"><RefreshCw className="h-4 w-4" aria-hidden /> Refresh</Button>
            <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> New profile</Button>
          </>
        }
      />

      {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-48" /><Skeleton className="h-48" />
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={<Clapperboard className="h-7 w-7" />}
          title="No profiles yet"
          description="A profile holds your colours, voice and approval settings. Create one to start your first show."
          action={<Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Create a profile</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} onEdit={() => setEditing(p)} onDelete={() => remove(p)} />
          ))}
        </div>
      )}

      {editing && (
        <ProfileEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void refresh(); }}
        />
      )}
    </div>
  );
}

function ProfileCard({
  profile, onEdit, onDelete,
}: { profile: ShowProfile; onEdit: () => void; onDelete: () => void }) {
  const theme = profile.theme_config as { primary?: string; accent?: string };
  const commentary = profile.commentary_config as { mode?: string; voice?: string; language?: string };
  const primary = theme?.primary ?? "#10b981";
  const accent = theme?.accent ?? "#3b82f6";

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div
        className="h-2"
        style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }}
        role="img"
        aria-label={`Theme colours ${primary} and ${accent}`}
      />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-50">{profile.name}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge>{profile.mode === "human" ? "Human presenter" : "Automated AI"}</Badge>
              <Badge tone={commentary?.mode === "auto" ? "warn" : "neutral"}>
                {MODE_LABEL[commentary?.mode ?? "approval"] ?? commentary?.mode}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${profile.name}`} title="Edit">
              <Edit3 className="h-4 w-4" aria-hidden />
            </Button>
            <ConfirmButton
              variant="ghost"
              size="icon"
              confirmLabel="Delete?"
              ariaLabel={`Delete ${profile.name}`}
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
              onConfirm={onDelete}
              className="text-zinc-400 hover:text-red-300"
            />
          </div>
        </div>

        <p className="text-sm text-zinc-400">
          {commentary?.voice ?? "Default voice"} · {(commentary?.language ?? "en").toUpperCase()}
        </p>

        <Link href={`/?profile=${profile.id}`} className={buttonClass("primary", "md", "w-full")}>
          Choose a match with this profile
        </Link>
      </div>
    </article>
  );
}
