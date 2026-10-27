"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ScrollText, Search } from "lucide-react";
import { api, type LogEntry } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";
import { LogRow } from "@/components/control/log-row";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Switch, inputClass } from "@/components/ui/form";
import { cn } from "@/lib/utility/utils";
import { focusRing } from "@/components/ui/button";

type Kind = "all" | "data" | "commentary" | "scene" | "override" | "error";
const KINDS: Kind[] = ["all", "data", "commentary", "scene", "override", "error"];

export function LogContent() {
  const params = useParams<{ sessionId: string }>();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);

  useEffect(() => {
    api.sessionLog(params.sessionId)
      .then((data) => { setEntries(data); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load log"))
      .finally(() => setLoading(false));
  }, [params.sessionId]);

  // Live log lines over WS
  useSocket<LogEntry>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type === "log.update") setEntries((prev) => [msg.data, ...prev]);
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => kind === "all" || e.kind === kind)
      .filter((e) => !onlyProblems || e.severity !== "info")
      .filter((e) => !q || e.message.toLowerCase().includes(q));
  }, [entries, kind, query, onlyProblems]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [entries]);

  const problems = entries.filter((e) => e.severity !== "info").length;
  const filtersActive = kind !== "all" || query !== "" || onlyProblems;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        title="Show log"
        description="A permanent record of everything that happened in this show. New lines appear at the top as they happen."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                focusRing,
                kind === k
                  ? "border-emerald-600 bg-emerald-600/15 text-emerald-200"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600",
              )}
            >
              {k}
              <span className="ml-1.5 tabular-nums text-zinc-400">{counts[k] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:ml-auto">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <Switch checked={onlyProblems} onChange={setOnlyProblems} label="Only warnings and errors" />
            Problems only <span className="tabular-nums text-zinc-400">({problems})</span>
          </label>
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
            <input
              type="search"
              aria-label="Search log messages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages…"
              className={cn(inputClass, "pl-9")}
            />
          </div>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title={filtersActive ? "No entries match these filters" : "Nothing logged yet"}
          description={filtersActive ? "Try a different type or clear the search." : "Events, scene changes and commentary will be recorded here."}
        />
      ) : (
        <ul className="flex flex-col gap-1.5" aria-live="polite">
          {filtered.map((e) => <LogRow key={e.id} entry={e} />)}
        </ul>
      )}
    </div>
  );
}
