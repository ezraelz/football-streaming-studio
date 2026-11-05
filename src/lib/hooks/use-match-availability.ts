"use client";
import { useEffect, useState } from "react";
import { api, MatchAvailability } from "@/lib/api/client";

export function useMatchAvailability(sessionId: string | null) {
  const [data, setData] = useState<MatchAvailability | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.matchAvailability(sessionId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "availability unavailable");
          setData(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sessionId]);

  return { data, loading, error };
}