"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, LogEntry } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";
import { LogRow } from "@/components/control/log-row";
import { cn } from "@/lib/utility/utils";

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
    if (msg.type === "log.update") {
      setEntries((prev) => [msg.data, ...prev]);
    }
  });

  const filtered = useMemo(() => {
    return entries
      .filter((e) => kind === "all" || e.kind === kind)
      .filter((e) => !onlyProblems || e.severity !== "info")
      .filter((e) => !query || e.message.toLowerCase().includes(query.toLowerCase()));
  }, [entries, kind, query, onlyProblems]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [entries]);

  const problems = entries.filter((e) => e.severity !== "info").length;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Show Log</h1>
          <p className="text-sm text-zinc-400">
            Persisted audit trail of this session. Live updates arrive over the session socket.
          </p>
        </div>
        <Link
          href={`/studio/${params.sessionId}`}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          ← Back to Studio
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "rounded border px-2.5 py-1 text-xs capitalize",
              kind === k
                ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            )}
          >
            {k} <span className="ml-1 text-zinc-500">{counts[k] ?? 0}</span>
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-56 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
        />
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(e) => setOnlyProblems(e.target.checked)}
          />
          Only warn/error ({problems})
        </label>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
            No entries match the current filters.
          </p>
        ) : (
          filtered.map((e) => <LogRow key={e.id} entry={e as any} />)
        )}
      </div>
    </div>
  );
}