"use client";
import { useId, useState } from "react";
import { type LeagueTheme } from "@/lib/branding/leagues";

/**
 * Competition badge. Tries a licensed logo at /leagues/<id>.svg first, then draws an
 * original generated badge (shield + monogram) in the league's colours.
 */
export function LeagueBadge({ theme, size = 40 }: { theme: LeagueTheme; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const [failedId, setFailedId] = useState<string | null>(null);
  const failed = theme.id === "default" || failedId === theme.id;

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/leagues/${theme.id}.svg`}
        alt={theme.name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
        onError={() => setFailedId(theme.id)}
      />
    );
  }

  const fs = theme.short.length > 2 ? 17 : 23;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={theme.name} className="shrink-0">
      <defs>
        <linearGradient id={`lg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.secondary} />
          <stop offset="0.55" stopColor={theme.primary} />
          <stop offset="1" stopColor={theme.primary} />
        </linearGradient>
      </defs>
      <path d="M32 3 58 13v20c0 14-11 24-26 28C17 57 6 47 6 33V13Z" fill={`url(#lg-${uid})`} stroke={theme.accent} strokeWidth="2.5" />
      <path d="M32 9 52 17v16c0 10-8 18-20 22" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" />
      <text x="32" y="38" textAnchor="middle" fontWeight="800" fontSize={fs} fill={theme.ink} style={{ fontFamily: "inherit" }}>
        {theme.short}
      </text>
      <rect x="20" y="45" width="24" height="3" rx="1.5" fill={theme.accent} />
    </svg>
  );
}
