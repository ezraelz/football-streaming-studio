"use client";
import type { CSSProperties, ReactNode } from "react";
import { LeagueBadge } from "./league-badge";
import { useOverlayEnv } from "./env";
import { accentOn, alpha, themeFor, themeGradient, DEFAULT_THEME, type LeagueTheme } from "@/lib/branding/leagues";

/**
 * Shared card for the full-scene overlays (stats, timeline, player, tactical).
 * Same visual language as the editorial cards: league-tinted header bar, readable
 * 1080p type sizes, and a surface that follows the dark/light card tone.
 */
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
  const theme = given ?? themeFor(competition);
  const accent = accentOn(theme, tone);
  return (
    <section
      className={`ov-card-in absolute overflow-hidden rounded-[28px] border backdrop-blur-xl ${className}`}
      style={{ background: "var(--ov-surface)", borderColor: "var(--ov-border)", boxShadow: "var(--ov-shadow)", ...style }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(135deg, ${alpha(theme.primary, tone === "dark" ? 0.5 : 0.14)} 0%, transparent 55%)` }} />
      <div className="relative" style={{ height: 7, background: themeGradient(theme) }} />
      <header className="relative flex items-center justify-between gap-4 px-8 pt-5">
        <span className="flex items-center gap-3 text-[24px] font-extrabold uppercase tracking-[0.18em]" style={{ color: accent }}>
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: accent }} />
          {title}
        </span>
        {theme.id !== DEFAULT_THEME.id && <LeagueBadge theme={theme} size={44} />}
      </header>
      <div className="relative px-8 pb-7 pt-5">{children}</div>
    </section>
  );
}
