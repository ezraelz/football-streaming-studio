"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useSocket } from "@/lib/hooks/use-socket";
import { AlertTriangle, X, ExternalLink } from "lucide-react";

interface SystemAlert {
  severity: "info" | "warn" | "error";
  title: string;
  body: string;
  action?: { label: string; url: string };
  timestamp: string;
}

export function SystemAlertBanner() {
  const params = useParams<{ sessionId?: string }>();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  useSocket<SystemAlert>(
    params.sessionId ? `/ws/v1/show-sessions/${params.sessionId}` : null,
    (msg) => {
      if (msg.type !== "system.alert") return;
      // Prepend — most recent first — and cap at 3
      setAlerts((prev) => [msg.data, ...prev].slice(0, 3));
    },
  );

  const dismiss = (i: number) => {
    setAlerts((prev) => prev.filter((_, idx) => idx !== i));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => (
        <div
          key={`${alert.timestamp}-${i}`}
          className={
            "flex items-start gap-3 rounded-lg border p-3 " +
            (alert.severity === "error"
              ? "border-red-800 bg-red-950/40"
              : alert.severity === "warn"
              ? "border-amber-800 bg-amber-950/40"
              : "border-blue-800 bg-blue-950/40")
          }
        >
          <AlertTriangle
            className={
              "h-4 w-4 shrink-0 " +
              (alert.severity === "error"
                ? "text-red-400"
                : alert.severity === "warn"
                ? "text-amber-400"
                : "text-blue-400")
            }
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-100">{alert.title}</div>
            <div className="mt-0.5 text-xs text-zinc-400">{alert.body}</div>
            {alert.action && (
              <a
                href={alert.action.url}
                className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
              >
                {alert.action.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <button
            onClick={() => dismiss(i)}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}