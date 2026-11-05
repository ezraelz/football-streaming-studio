"use client";
import { useRef } from "react";
import { useParams } from "next/navigation";
import { useSocket } from "@/lib/hooks/use-socket";
import { api } from "@/lib/api/client";

interface SpeechUpdate {
  id: string;
  commentary_id: string;
  status: "queued" | "synthesizing" | "ready" | "playing" | "played" | "failed";
  audio_url: string | null;
  duration_ms: number | null;
  expires_at: string | null;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export function SpeechPlayer() {
  const params = useParams<{ sessionId: string }>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const queueRef = useRef<SpeechUpdate[]>([]);
  const playingRef = useRef(false);

  const playNext = () => {
    if (playingRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    const next = queueRef.current.shift();
    if (!next) return;

    // Expired? Skip.
    if (next.expires_at && new Date(next.expires_at).getTime() < Date.now()) {
      return playNext();
    }

    playingRef.current = true;
    audio.src = `${BASE}${next.audio_url}`;
    audio.onended = () => {
      playingRef.current = false;
      api.markSpeechPlayed(next.id).catch(() => {});
      playNext();
    };
    audio.onerror = () => {
      playingRef.current = false;
      playNext();
    };
    audio.play().catch(() => {
      playingRef.current = false;
    });
  };

  useSocket<SpeechUpdate>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type !== "speech.update") return;
    const update = msg.data;
    if (update.status === "ready" && update.audio_url) {
      queueRef.current.push(update);
      playNext();
    }
  });

  return (
    <audio
      ref={audioRef}
      preload="auto"
      style={{ display: "none" }}
      aria-hidden
    />
  );
}