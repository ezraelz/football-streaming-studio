"use client";
import type { CSSProperties, ReactNode } from "react";
import { LeagueBadge } from "./league-badge";
import { useOverlayEnv } from "./env";
import { useI18n } from "@/lib/i18n";
import { alpha, competitionLabel, themeGradient, DEFAULT_THEME, type LeagueTheme } from "@/lib/branding/leagues";

/** Sizes the panel is drawn at. The editorial cards pass their own scale; scenes use `SCENE_SIZE`. */
export interface PanelScale { pad: number; label: number; small: number; gap: number }
export const SCENE_SIZE: PanelScale = { pad: 34, label: 24, small: 22, gap: 20 };

/**
 * The single "TV graphic" frame used by EVERY overlay element (scenes and cards), so they read as
 * one broadcast package: chamfered corners, a slanted league-coloured title tab, an accent rule,
 * mown-grass stripes and a coloured kick-off glow — not a rounded web card.
 */
export function BroadcastPanel({
  type, subtitle, theme, scale, index = 0, glow, className = "", style, children, noHeader = false,
}: {
  type: string;
  subtitle?: string;
  theme: LeagueTheme;
  scale: PanelScale;
  index?: number;
  glow?: [string, string];
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  noHeader?: boolean;
}) {
  const { tone } = useOverlayEnv();
  const { lang } = useI18n();
  const tab = Math.round(scale.label * 2.1);
  const cut = Math.max(14, Math.round(scale.pad * 0.7));

  return (
    <section
      className={`ov-card-in bc-drop relative flex min-h-0 flex-col ${className}`}
      style={{
        filter: "drop-shadow(0 18px 28px rgb(0 0 0 / 0.45))",
        ["--ov-delay" as string]: `${index * 120}ms`,
        ...style,
      } as CSSProperties}
    >
      <div
        className="bc-chamfer relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ ["--cut" as string]: `${cut}px`, background: "var(--ov-surface)" } as CSSProperties}
      >
        <div className="bc-stripes pointer-events-none absolute inset-0" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(115deg, ${alpha(theme.primary, tone === "dark" ? 0.55 : 0.16)} 0%, transparent 52%)` }}
        />
        {glow && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(55% 85% at 0% 60%, ${alpha(glow[0], 0.28)}, transparent 70%), radial-gradient(55% 85% at 100% 60%, ${alpha(glow[1], 0.28)}, transparent 70%)` }}
          />
        )}

        {/* accent rule */}
        <div className="relative shrink-0" style={{ height: 6, background: themeGradient(theme) }} />

        {!noHeader && (
          <header className="relative flex shrink-0 items-stretch justify-between" style={{ paddingRight: scale.pad }}>
            <div className="flex items-stretch">
              {/* slanted title tab */}
              <div
                className="bc-slant relative -ml-4 flex items-center"
                style={{
                  height: tab, paddingLeft: scale.pad + 10, paddingRight: scale.pad * 0.9,
                  background: `linear-gradient(100deg, ${theme.primary}, ${theme.secondary})`,
                  borderBottom: `4px solid ${theme.accent}`,
                }}
              >
                <span className="flex items-center gap-3">
                  {theme.id !== DEFAULT_THEME.id && <LeagueBadge theme={theme} size={Math.round(tab * 0.62)} />}
                  <span className="font-extrabold uppercase text-[#fff]" style={{ fontSize: scale.label * 1.12, letterSpacing: "0.14em", lineHeight: 1 }}>
                    {type}
                  </span>
                </span>
              </div>
              <div className="bc-slant ml-1.5 self-stretch" style={{ width: Math.max(8, scale.label * 0.4), background: theme.accent, height: tab - 4, opacity: 0.9 }} />
            </div>
            {subtitle && (
              <span className="flex items-center truncate font-semibold uppercase text-white/70" style={{ fontSize: scale.small, letterSpacing: "0.1em" }}>
                {competitionLabel(subtitle, lang)}
              </span>
            )}
          </header>
        )}

        <div className="relative min-h-0 flex-1" style={{ padding: `${scale.gap}px ${scale.pad}px ${scale.pad * 0.8}px` }}>
          {children}
        </div>

        {/* bottom accent: short coloured bar, like a lower-third underline */}
        <div className="pointer-events-none absolute bottom-0 left-0" style={{ height: 5, width: "34%", background: theme.accent }} />
      </div>
    </section>
  );
}
