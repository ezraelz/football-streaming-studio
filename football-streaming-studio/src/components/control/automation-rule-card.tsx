"use client";
import { useState } from "react";
import { AutomationRule } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";
import { ChevronDown, Trash2, Zap } from "lucide-react";

const EVENT_TYPES = [
  "goal", "card", "substitution", "half_time", "full_time", "feed_stale",
];

const ACTION_LABELS: Record<string, string> = {
  update_scoreboard: "Update scoreboard",
  show_scene: "Show scene",
  generate_commentary: "Generate commentary",
  speak_if_enabled: "Speak if enabled",
};

export function AutomationRuleCard({
  rule, onUpdate, onDelete,
}: {
  rule: AutomationRule;
  onUpdate: (patch: Partial<AutomationRule>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => onUpdate({ enabled: !rule.enabled })}
          className={cn(
            "h-5 w-9 rounded-full p-0.5 transition-colors",
            rule.enabled ? "bg-emerald-600" : "bg-zinc-700"
          )}
        >
          <div
            className={cn(
              "h-4 w-4 rounded-full bg-white transition-transform",
              rule.enabled && "translate-x-4"
            )}
          />
        </button>

        <div className="flex flex-1 items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-sm font-medium">{rule.label}</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {rule.event_type}
          </span>
        </div>

        <button
          onClick={() => setExpanded((e) => !e)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-zinc-500 hover:bg-red-900/40 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-zinc-800 p-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Trigger
            </label>
            <div className="flex gap-2">
              <select
                value={rule.event_type}
                onChange={(e) => onUpdate({ event_type: e.target.value })}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
              >
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={rule.required_status}
                onChange={(e) => onUpdate({ required_status: e.target.value })}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
              >
                <option value="">Any status</option>
                <option value="confirmed">Confirmed only</option>
                <option value="provisional">Provisional allowed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Actions
            </label>
            <ul className="space-y-1">
              {rule.actions.map((a, i) => (
                <li key={i} className="flex items-center gap-2 rounded bg-zinc-950/60 px-2 py-1 text-xs">
                  <span className="text-zinc-400">{ACTION_LABELS[a.type] ?? a.type}</span>
                  {a.sceneId && (
                    <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-300">
                      scene: {a.sceneId}
                    </span>
                  )}
                  {a.template && (
                    <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-300">
                      tpl: {a.template}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Guards
            </label>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.deduplicate_event}
                  onChange={(e) => onUpdate({ deduplicate_event: e.target.checked })}
                />
                Deduplicate event
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.require_fresh_match_state}
                  onChange={(e) => onUpdate({ require_fresh_match_state: e.target.checked })}
                />
                Require fresh match state
              </label>
              <label className="flex items-center gap-2">
                Cooldown
                <input
                  type="number"
                  min={0}
                  value={rule.cooldown_seconds}
                  onChange={(e) => onUpdate({ cooldown_seconds: parseInt(e.target.value, 10) || 0 })}
                  className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-xs"
                />
                <span className="text-zinc-500">seconds</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}