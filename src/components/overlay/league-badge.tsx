"use client";
import { useId, useState } from "react";
import type { LeagueTheme, Motif } from "@/lib/branding/leagues";

/**
 * Competition badge. Tries a licensed logo at /leagues/<id>.svg first, then draws an
 * original generated medallion (ring + generic symbol + monogram) in the league's colours.
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

  const long = theme.short.length;
  const fs = long > 4 ? 11 : long > 3 ? 13 : long > 2 ? 15 : 19;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={theme.name} className="shrink-0">
      <defs>
        <linearGradient id={`lg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.secondary} />
          <stop offset="0.6" stopColor={theme.primary} />
        </linearGradient>
        <clipPath id={`lc-${uid}`}><circle cx="32" cy="32" r="26" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="29.5" fill={`url(#lg-${uid})`} stroke={theme.accent} strokeWidth="2.5" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      {theme.flag && (
        <g clipPath={`url(#lc-${uid})`}>
          {theme.flag.map((c, i) => <rect key={i} x="0" y={44 + i * 4} width="64" height="4" fill={c} />)}
        </g>
      )}
      <MotifShape motif={theme.motif ?? "ball"} color={theme.accent} />
      <text
        x="32" y={theme.flag ? 41 : 48} textAnchor="middle" fontWeight="800" fontSize={fs} fill={theme.ink}
        stroke="rgba(0,0,0,.35)" strokeWidth=".6" paintOrder="stroke" style={{ fontFamily: "inherit" }}
      >
        {theme.short}
      </text>
    </svg>
  );
}

function spikesPath(cx: number, cy: number, R: number, r: number, n: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function star(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Generic symbols — not any real league's logo. */
function MotifShape({ motif, color }: { motif: Motif; color: string }) {
  switch (motif) {
    case "star": return <path d={star(32, 22, 9, 3.9)} fill={color} />;
    case "lion":
      return (
        <g>
          <path d={spikesPath(32, 22, 11.5, 8.4, 14)} fill={color} />
          <circle cx="32" cy="22.5" r="6.2" fill="rgba(0,0,0,.45)" />
          <circle cx="29.6" cy="21.5" r="1.1" fill={color} /><circle cx="34.4" cy="21.5" r="1.1" fill={color} />
          <path d="M30.2 25.2h3.6L32 27.3Z" fill={color} />
        </g>
      );
    case "starball":
      return (
        <g>
          <circle cx="32" cy="23" r="6.4" fill="none" stroke={color} strokeWidth="2" />
          <path d="M32 19.4 35 21.6 33.9 25.1h-3.8L29 21.6Z" fill={color} />
          {Array.from({ length: 7 }, (_, i) => {
            const a = Math.PI + (i * Math.PI) / 6;
            return <path key={i} d={star(32 + 12.5 * Math.cos(a), 23 + 12.5 * Math.sin(a), 2.6, 1.1)} fill={color} />;
          })}
        </g>
      );
    case "shield": return <path d="M32 10 44 14v9c0 7-5 11-12 14-7-3-12-7-12-14v-9Z" fill={color} />;
    case "stars": return <g fill={color}><path d={star(20, 24, 5.2, 2.2)} /><path d={star(32, 18, 6.4, 2.7)} /><path d={star(44, 24, 5.2, 2.2)} /></g>;
    case "crown": return <path d="M21 28 19 15l8 6 5-9 5 9 8-6-2 13Z" fill={color} />;
    case "bolt": return <path d="M35 11 24 25h7l-3 10 12-15h-7Z" fill={color} />;
    case "cup": return <path d="M23 12h18v7c0 6-4 10-9 10s-9-4-9-10Zm-5 2h5v4c0 3 1 5 3 6l-1 2c-4-1-7-5-7-9Zm28 0h-5v4c0 3-1 5-3 6l1 2c4-1 7-5 7-9ZM29 29h6v4h4v3H25v-3h4Z" fill={color} />;
    case "laurel":
      return (
        <g fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
          <path d="M23 31c-5-4-6-11-3-17M23 27c-3-1-5-3-6-6M25 33c-2-2-4-4-5-7" />
          <path d="M41 31c5-4 6-11 3-17M41 27c3-1 5-3 6-6M39 33c2-2 4-4 5-7" />
          <circle cx="32" cy="21" r="3.2" fill={color} stroke="none" />
        </g>
      );
    default:
      return (
        <g fill="none" stroke={color} strokeWidth="2">
          <circle cx="32" cy="22" r="9" />
          <path d="M32 17.5 36 20.4 34.5 25h-5L28 20.4Z" fill={color} stroke="none" />
        </g>
      );
  }
}
