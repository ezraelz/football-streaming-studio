"use client";
import { useState } from "react";
import { ChevronDown, Trash2, Zap } from "lucide-react";
import type { AutomationRule } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Switch, inputClass } from "@/components/ui/form";

const EVENT_TYPES = ["goal", "card", "substitution", "half_time", "full_time", "feed_stale"];

const EVENT_LABELS: Record<string, string> = {
  goal: "a goal", card: "a card", substitution: "a substitution",
  half_time: "half-time", full_time: "full-time", feed_stale: "the data feed goes stale",
};

const ACTION_LABELS: Record<string, string> = {
  update_scoreboard: "update the scoreboard",
  show_scene: "show scene",
  generate_commentary: "write commentary",
  speak_if_enabled: "speak it if voice is on",
};

function summarise(rule: AutomationRule) {
  const status =
    rule.required_status === "confirmed" ? "confirmed " :
    rule.required_status === "provisional" ? "provisional " : "";
  const event = EVENT_LABELS[rule.event_type] ?? rule.event_type;
  const actions = rule.actions.map((a) =>
    a.type === "show_scene" && a.sceneId
      ? `show the ${a.sceneId} scene`
      : (ACTION_LABELS[a.type] ?? a.type),
  );
  return { when: `${status}${event}`, then: actions };
}

export function AutomationRuleCard({
  rule, onUpdate, onDelete, defaultExpanded = false,
}: {
  rule: AutomationRule;
  onUpdate: (patch: Partial<AutomationRule>) => void;
  onDelete: () => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { when, then } = summarise(rule);
  const detailsId = `rule-${rule.id}`;

  return (
    <div className={cn("rounded-xl border bg-zinc-900/60", rule.enabled ? "border-zinc-700" : "border-zinc-800")}>
      <div className="flex items-start gap-3 p-4">
        <div className="pt-0.5">
          <Switch checked={rule.enabled} onChange={(v) => onUpdate({ enabled: v })} label={`${rule.label} enabled`} />
        </div>

        <div className={cn("min-w-0 flex-1", !rule.enabled && "opacity-70")}>
          <div className="flex flex-wrap items-center gap-2">
            <Zap className="h-4 w-4 text-zinc-500" aria-hidden />
            <h3 className="text-sm font-semibold text-zinc-100">{rule.label}</h3>
            <Badge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "On" : "Off"}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            When <span className="text-zinc-200">{when}</span> happens, {then.length ? then.join(", then ") : "do nothing"}.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={detailsId}
        >
          {expanded ? "Done" : "Edit"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </Button>
      </div>

      {expanded && (
        <div id={detailsId} className="space-y-5 border-t border-zinc-800 p-4">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Trigger</legend>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Event type"
                value={rule.event_type}
                onChange={(e) => onUpdate({ event_type: e.target.value })}
                className={cn(inputClass, "w-auto")}
              >
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
              <select
                aria-label="Required event status"
                value={rule.required_status}
                onChange={(e) => onUpdate({ required_status: e.target.value })}
                className={cn(inputClass, "w-auto")}
              >
                <option value="">Any status</option>
                <option value="confirmed">Confirmed only</option>
                <option value="provisional">Provisional allowed</option>
              </select>
            </div>
          </fieldset>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Then, in order</h4>
            <ol className="space-y-1.5">
              {rule.actions.map((a, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-zinc-950/60 px-3 py-2 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-xs tabular-nums text-zinc-300">{i + 1}</span>
                  <span className="capitalize text-zinc-200">{ACTION_LABELS[a.type] ?? a.type}</span>
                  {a.sceneId && <Badge>{a.sceneId}</Badge>}
                  {a.template && <Badge>template: {a.template}</Badge>}
                </li>
              ))}
            </ol>
          </section>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Safeguards</legend>
            <div className="space-y-3">
              <Checkbox checked={rule.deduplicate_event} onChange={(v) => onUpdate({ deduplicate_event: v })}>
                Ignore repeats of the same event
              </Checkbox>
              <Checkbox checked={rule.require_fresh_match_state} onChange={(v) => onUpdate({ require_fresh_match_state: v })}>
                Only run when match data is fresh
              </Checkbox>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                Wait at least
                <input
                  type="number"
                  min={0}
                  value={rule.cooldown_seconds}
                  onChange={(e) => onUpdate({ cooldown_seconds: parseInt(e.target.value, 10) || 0 })}
                  className={cn(inputClass, "w-20 tabular-nums")}
                />
                seconds before running again
              </label>
            </div>
          </fieldset>

          <div className="flex justify-end border-t border-zinc-800 pt-3">
            <ConfirmButton
              size="sm"
              confirmLabel="Click again to delete"
              icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
              onConfirm={onDelete}
            >
              Delete rule
            </ConfirmButton>
          </div>
        </div>
      )}
    </div>
  );
}
