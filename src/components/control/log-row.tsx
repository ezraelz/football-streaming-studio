"use client";
import { useState } from "react";
import { AlertCircle, ChevronDown, Database, Layers, MessageSquare, UserCog } from "lucide-react";
import { cn, formatTime } from "@/lib/utility/utils";
import type { LogEntry } from "@/lib/api/client";

const KIND_META = {
  data: { label: "Data", Icon: Database, color: "text-sky-300" },
  commentary: { label: "Commentary", Icon: MessageSquare, color: "text-emerald-300" },
  scene: { label: "Scene", Icon: Layers, color: "text-violet-300" },
  override: { label: "Override", Icon: UserCog, color: "text-amber-300" },
  error: { label: "Error", Icon: AlertCircle, color: "text-red-300" },
} as const;

export function LogRow({ entry }: { entry: LogEntry }) {
  const meta = KIND_META[entry.kind];
  const [open, setOpen] = useState(false);
  const hasDetail = !!entry.detail && Object.keys(entry.detail).length > 0;

  return (
    <li
      className={cn(
        "rounded-lg border-l-2 bg-zinc-900/50 px-3 py-2",
        entry.severity === "error" ? "border-l-red-500" : entry.severity === "warn" ? "border-l-amber-400" : "border-l-zinc-700",
      )}
    >
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        aria-expanded={hasDetail ? open : undefined}
        disabled={!hasDetail}
        className="flex w-full items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-default"
      >
        <time dateTime={entry.created_at} className="w-20 shrink-0 font-mono text-xs text-zinc-400">
          {formatTime(entry.created_at)}
        </time>
        <span className={cn("flex w-28 shrink-0 items-center gap-1.5 text-xs font-medium", meta.color)}>
          <meta.Icon className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{entry.message}</span>
        {hasDetail && (
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} aria-hidden />
        )}
      </button>

      {open && hasDetail && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-zinc-300">
          {JSON.stringify(entry.detail, null, 2)}
        </pre>
      )}
    </li>
  );
}
