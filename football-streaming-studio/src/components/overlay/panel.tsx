"use client";
import type { CSSProperties, ReactNode } from "react";
import { BroadcastPanel, SCENE_SIZE } from "./broadcast";
import { useOverlayEnv } from "./env";
import { accentOn, themeFor, type LeagueTheme } from "@/lib/branding/leagues";

/** Full-screen scene frame (stats, timeline, player, tactical). Thin wrapper over BroadcastPanel. */
export function OverlayPanel({
  title, competition, theme: given, className = "", style, children,
}: {
  title: string;
  competition?: string | null;
  theme?: LeagueTheme;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { tone } = useOverlayEnv();
  const base = given ?? themeFor(competition);
  const theme = tone === "light" ? { ...base, accent: accentOn(base, "light") } : base;
  return (
    <BroadcastPanel
      type={title}
      subtitle={competition ?? undefined}
      theme={theme}
      scale={SCENE_SIZE}
      className={`absolute ${className}`}
      style={style}
    >
      {children}
    </BroadcastPanel>
  );
}
