"use client";
import { cn } from "@/lib/utility/utils";
import { useState } from "react";
import {
  Database, MessageSquare, Layers, UserCog, AlertCircle, ChevronDown,
} from "lucide-react";
import { LogEntry } from "@/lib/api/client";

const KIND_META = {
  data:       { label: "Data",       Icon: Database,       color: "text-blue-300" },
  commentary: { label: "Commentary", Icon: MessageSquare,  color: "text-emerald-300" },
  scene:      { label: "Scene",      Icon: Layers,         color: "text-purple-300" },
  override:   { label: "Override",   Icon: UserCog,        color: "text-amber-300" },
  error:      { label: "Error",      Icon: AlertCircle,    color: "text-red-300" },
} as const;

export function LogRow({ entry }: { entry: LogEntry }) {
  const meta = KIND_META[entry.kind];
  const [open, setOpen] = useState(false);
  const time = new Date(entry.created_at).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <div className={cn(
      "rounded border bg-zinc-950/40 px-3 py-2",
      entry.severity === "error" && "border-red-900/50",
      entry.severity === "warn"  && "border-amber-800/40",
      entry.severity === "info"  && "border-zinc-800",
    )}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="w-16 shrink-0 font-mono text-[11px] text-zinc-500">{time}</span>
        <span className={cn("flex shrink-0 items-center gap-1 text-[11px]", meta.color)}>
          <meta.Icon className="h-3 w-3" />
          {meta.label}
        </span>
        <span className="flex-1 truncate text-sm text-zinc-200">{entry.message}</span>
        {entry.detail && (
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && entry.detail && (
        <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 text-[10px] text-zinc-400">
          {JSON.stringify(entry.detail, null, 2)}
        </pre>
      )}
    </div>
  );
}