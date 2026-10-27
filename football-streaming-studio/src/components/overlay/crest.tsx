"use client";
import { useId, useState } from "react";
import { clubStyle, luminance, slugify, type KitPattern } from "@/lib/branding/clubs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/**
 * Club crest. Source order: provider crest URL → licensed file at /crests/<slug>.svg →
 * an original generated shield in the club's colours (never an official crest).
 * `size` is in canvas pixels (1920×1080 space).
 */
export function TeamCrest({
  name, color, crestUrl, size = 80,
}: { name: string; color: string; crestUrl?: string | null; size?: number }) {
  const candidates: string[] = [];
  if (crestUrl) candidates.push(/^https?:/.test(crestUrl) ? crestUrl : `${API_BASE}${crestUrl}`);
  candidates.push(`/crests/${slugify(name)}.svg`);

  // `tried` is tied to the candidate list, so a different club re-starts from the first source.
  const key = candidates.join("|");
  const [state, setState] = useState({ key: "", tried: 0 });
  const tried = state.key === key ? state.tried : 0;
  const src = candidates[tried];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]"
        style={{ width: size, height: size }}
        onError={() => setState({ key, tried: tried + 1 })}
      />
    );
  }
  return <GeneratedCrest name={name} color={color} size={size} />;
}

/** Original shield: club colour + kit pattern + initials. */
export function GeneratedCrest({ name, color, size }: { name: string; color: string; size: number }) {
  const uid = useId().replace(/:/g, "");
  const style = clubStyle(name);
  const secondary = style?.secondary ?? "#ffffff";
  const pattern: KitPattern = style?.pattern ?? "solid";
  const initials = name.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
  const text = (initials.length > 1 ? initials.slice(0, 3).map((w) => w[0]).join("") : name.slice(0, 3)).toUpperCase();
  // Dominant colour under the text decides black or white lettering
  const dominant = pattern === "solid" || pattern === "band" ? color : luminance(color) < 140 ? color : secondary;
  const ink = luminance(dominant) > 150 ? "#111827" : "#ffffff";
  const shield = "M32 3 58 12v21c0 14-11 24-26 28C17 57 6 47 6 33V12Z";

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={name} className="shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]">
      <defs>
        <clipPath id={`c-${uid}`}><path d={shield} /></clipPath>
        <linearGradient id={`s-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c-${uid})`}>
        <rect width="64" height="64" fill={color} />
        {pattern === "stripes" && [14, 30, 46].map((x) => <rect key={x} x={x} y="0" width="9" height="64" fill={secondary} />)}
        {pattern === "hoops" && [14, 30, 46].map((y) => <rect key={y} x="0" y={y} width="64" height="9" fill={secondary} />)}
        {pattern === "halves" && <rect x="32" y="0" width="32" height="64" fill={secondary} />}
        {pattern === "band" && <rect x="24" y="0" width="16" height="64" fill={secondary} />}
        {pattern === "sash" && <path d="M0 14 14 0h14L0 28Z M0 42 42 0h14L0 56Z" fill={secondary} />}
        <rect width="64" height="34" fill={`url(#s-${uid})`} />
      </g>
      <path d={shield} fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.5" />
      <text
        x="32" y="39" textAnchor="middle" fontWeight="900" fontSize={text.length > 2 ? 15 : 19} fill={ink}
        stroke={ink === "#ffffff" ? "rgba(0,0,0,.45)" : "rgba(255,255,255,.5)"} strokeWidth=".6" paintOrder="stroke"
        style={{ fontFamily: "inherit" }}
      >
        {text}
      </text>
    </svg>
  );
}
