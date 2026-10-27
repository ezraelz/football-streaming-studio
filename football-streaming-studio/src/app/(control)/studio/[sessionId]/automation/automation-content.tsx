"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Workflow, Zap } from "lucide-react";
import { api, type AutomationRule } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";
import { useShowStore } from "@/lib/stores/show-store";
import { ControllerStateBar } from "@/components/control/controller-state-bar";
import { AutomationRuleCard } from "@/components/control/automation-rule-card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export function AutomationContent() {
  const params = useParams<{ sessionId: string }>();
  const setSession = useShowStore((s) => s.setSession);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.getSession(params.sessionId);
      setSession(s); // keep the shared store (and the controller bar) in sync after a reload
      setProfileId(s.show_profile_id);
      setRules(await api.listAutomationRules(s.show_profile_id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params.sessionId, setSession]);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  // Listen for automation-driven scene commands — shows the operator what fired
  useSocket<{ scene_id: string; rule_id: string | null }>(
    `/ws/v1/show-sessions/${params.sessionId}`,
    (msg) => {
      if (msg.type === "scene.command") {
        setLastCommand(`Automation switched the scene to “${msg.data.scene_id}”.`);
        setTimeout(() => setLastCommand(null), 5000);
      }
    },
  );

  const addRule = async () => {
    if (!profileId) return;
    setAdding(true);
    try {
      const created = await api.createAutomationRule(profileId, {
        label: "New rule",
        enabled: false,
        event_type: "goal",
        required_status: "confirmed",
        actions: [{ type: "show_scene", sceneId: "scoreboard" }],
        deduplicate_event: true,
        require_fresh_match_state: true,
        cooldown_seconds: 10,
      });
      setRules((prev) => [...prev, created]);
      setNewId(created.id); // open it straight away so it can be edited
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setAdding(false);
    }
  };

  const updateRule = async (id: string, patch: Partial<AutomationRule>) => {
    const before = rules;
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))); // optimistic
    try {
      const updated = await api.updateAutomationRule(id, patch);
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setRules(before);
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await api.deleteAutomationRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const enabled = rules.filter((r) => r.enabled).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Automation"
        description="Rules that run on their own when a matching event lands during a live show."
      />

      <ControllerStateBar />

      {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {lastCommand && (
        <Alert tone="success"><span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" aria-hidden />{lastCommand}</span></Alert>
      )}

      <Alert tone="info">
        <strong className="font-semibold">Rules, not AI judgement.</strong>{" "}
        The backend only does what you configure here, and records every action with its rule, event and outcome.
      </Alert>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">
          Rules{!loading && <span className="ml-2 font-normal text-zinc-400">{enabled} of {rules.length} on</span>}
        </h2>
        <Button variant="primary" onClick={addRule} loading={adding} disabled={!profileId}>
          {!adding && <Plus className="h-4 w-4" aria-hidden />} New rule
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-6 w-6" />}
          title="No automation rules yet"
          description="Create a rule to switch scenes or draft commentary automatically — for example, show the scoreboard on every confirmed goal."
          action={<Button variant="primary" onClick={addRule} disabled={!profileId}><Plus className="h-4 w-4" aria-hidden /> Create the first rule</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <AutomationRuleCard
              key={r.id}
              rule={r}
              defaultExpanded={r.id === newId}
              onUpdate={(patch) => updateRule(r.id, patch)}
              onDelete={() => deleteRule(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
