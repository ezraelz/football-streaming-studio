"use client";
import { useEffect, useRef } from "react";

const WS_BASE =
  (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000")
    .replace(/^http/, "ws");

export interface SocketMessage<T = unknown> {
  type: string;
  data: T;
}

export function useSocket<T = unknown>(
  path: string | null,
  onMessage: (msg: SocketMessage<T>) => void,
) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!path) return;

    let ws: WebSocket | null = null;
    let cancelled = false;
    let retry = 0;

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(`${WS_BASE}${path}`);

      ws.onopen = () => {
        retry = 0;
      };

      ws.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          handlerRef.current(parsed);
        } catch {
          /* malformed — ignore */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        // exponential-ish backoff: 1s, 2s, 4s, capped at 15s
        const delay = Math.min(1000 * 2 ** retry, 15000);
        retry += 1;
        setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [path]);
}