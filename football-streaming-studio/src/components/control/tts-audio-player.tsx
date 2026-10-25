"use client";
import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useSocket } from "@/lib/hooks/use-socket";

interface SpeechReady {
  commentary_id: string;
  speech_job_id: string;
  audio_url: string;
  text: string;
  priority: string;
}

/**
 * Listens for speech.ready WS events and plays the audio through the browser.
 * OBS captures browser audio via Application Audio Capture.
 *
 * Only one line plays at a time; a higher-priority line preempts a lower one.
 */
export function TtsAudioPlayer() {
  const params = useParams<{ sessionId: string }>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<SpeechReady[]>([]);
  const playingRef = useRef<SpeechReady | null>(null);

  const playNext = () => {
    if (playingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    playingRef.current = next;
    const el = audioRef.current!;
    el.src = next.audio_url;
    el.play().catch(() => {
      // Autoplay blocked — drop and move on
      playingRef.current = null;
      playNext();
    });
  };
  // Lazily create the audio element so it exists before playback is attempted
  useEffect(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.crossOrigin = "anonymous";
      audioRef.current = el;
      el.onended = () => {
        const current = playingRef.current;
        playingRef.current = null;
        if (current) {
          api.markPlayed(current.commentary_id).catch(() => {});
        }
        playNext();
      };
      el.onerror = () => {
        playingRef.current = null;
        playNext();
      };
    }
  }, []);

  useSocket<SpeechReady>(`/ws/v1/show-sessions/${params.sessionId}`, (msg) => {
    if (msg.type !== "speech.ready") return;
    const data = msg.data;

    // Dedup: same speech job already playing or queued
    if (playingRef.current?.speech_job_id === data.speech_job_id) return;
    if (queueRef.current.some((q) => q.speech_job_id === data.speech_job_id)) return;

    if (data.priority === "high") {
      // High-priority lines preempt current playback
      queueRef.current.unshift(data);
      if (playingRef.current) {
        audioRef.current?.pause();
        const preempted = playingRef.current;
        playingRef.current = null;
        // Put the interrupted line back at the front of the queue
        queueRef.current.push(preempted);
      }
    } else {
      queueRef.current.push(data);
    }
    playNext();
  });

  return null; // Invisible component
}