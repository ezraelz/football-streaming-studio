"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, AutomationRule } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";
import { ControllerStateBar } from "@/components/control/controller-state-bar";
import { AutomationRuleCard } from "@/components/control/automation-rule-card";
import { Plus, Info, AlertTriangle } from "lucide-react";

export function AutomationContent() {
  const params = useParams<{ sessionId: string }>();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.getSession(params.sessionId);
      setProfileId(s.show_profile_id);
      const list = await api.listAutomationRules(s.show_profile_id);
      setRules(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params.sessionId]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  // Listen for automation-driven scene commands — shows the operator what fired
  useSocket<{ scene_id: string; rule_id: string | null }>(
    `/ws/v1/show-sessions/${params.sessionId}`,
    (msg) => {
      if (msg.type === "scene.command") {
        setLastCommand(`Scene → ${msg.data.scene_id} (automation)`);
        setTimeout(() => setLastCommand(null), 5000);
      }
    },
  );

  const addRule = async () => {
    if (!profileId) return;
    try {
      await api.createAutomationRule(profileId, {
        label: "New rule",
        enabled: false,
        event_type: "goal",
        required_status: "confirmed",
        actions: [{ type: "show_scene", sceneId: "scoreboard" }],
        deduplicate_event: true,
        require_fresh_match_state: true,
        cooldown_seconds: 10,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const updateRule = async (id: string, patch: Partial<AutomationRule>) => {
    try {
      const updated = await api.updateAutomationRule(id, patch);
      setRules((prev) => prev.map((r) => r.id === id ? updated : r));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await api.deleteAutomationRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading automation rules…</div>;
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Automation Rules</h1>
          <p className="text-sm text-zinc-400">
            Configured rules run automatically when a matching event lands during a live session.
          </p>
        </div>
        <Link
          href={`/studio/${params.sessionId}`}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          ← Back to Studio
        </Link>
      </header>

      <ControllerStateBar />

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {lastCommand && (
        <div className="rounded border border-emerald-800/60 bg-emerald-950/30 p-2 text-xs text-emerald-300">
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          {lastCommand}
        </div>
      )}

      <div className="rounded-md border border-blue-800/50 bg-blue-950/30 p-3 text-xs text-blue-200/80">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <strong className="text-blue-200">Automation is rule-driven, not LLM-driven.</strong>{" "}
            The backend executes only the actions you configure here. Every action is audited with
            its rule ID, event ID and outcome.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          {rules.filter((r) => r.enabled).length} of {rules.length} rules enabled
        </div>
        <button
          onClick={addRule}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" /> New rule
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {rules.map((r) => (
          <AutomationRuleCard
            key={r.id}
            rule={r}
            onUpdate={(patch) => updateRule(r.id, patch)}
            onDelete={() => deleteRule(r.id)}
          />
        ))}
      </div>
    </div>
  );
}