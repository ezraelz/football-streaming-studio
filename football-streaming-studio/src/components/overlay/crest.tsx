"use client";
import { useId, useState } from "react";
import { clubPrimary, clubStyle, crestDesign, luminance, slugify, type CrestShape, type Emblem, type KitPattern } from "@/lib/branding/clubs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/**
 * Club crest. Source order: provider crest URL → licensed file at /crests/<slug>.svg →
 * an original generated crest in the club's colours (never an official crest).
 * `size` is in canvas pixels (1920×1080 space) on the overlay, or CSS pixels in the studio.
 * `flat` drops the broadcast drop-shadow (use it on light control-panel surfaces).
 */
export function TeamCrest({
  name, color, crestUrl, size = 80, flat = false,
}: { name: string; color: string; crestUrl?: string | null; size?: number; flat?: boolean }) {
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
        className={flat ? "object-contain" : "object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]"}
        style={{ width: size, height: size }}
        onError={() => setState({ key, tried: tried + 1 })}
      />
    );
  }
  return <GeneratedCrest name={name} color={color} size={size} flat={flat} />;
}

/* ── original crest artwork ─────────────────────────────────────────────── */

const SHAPE_PATH: Record<Exclude<CrestShape, "round" | "ring">, string> = {
  shield: "M32 3 58 12v21c0 14-11 24-26 28C17 57 6 47 6 33V12Z",
  arch: "M8 12Q32 0 56 12v22c0 13-10 22-24 27C18 56 8 47 8 34Z",
  hex: "M32 3 57 17.5v29L32 61 7 46.5v-29Z",
  escudo: "M9 5h46v29a23 23 0 0 1-46 0Z",
  kite: "M32 2 59 15 54 41 32 62 10 41 5 15Z",
};
const ROUND = "M32 4a28 28 0 1 0 0.001 0Z";
const shapePath = (s: CrestShape) => (s === "round" || s === "ring" ? ROUND : SHAPE_PATH[s]);

function starPath(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function spikes(cx: number, cy: number, R: number, r: number, n: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Small generic symbols drawn above the initials. None of these copy a real club badge. */
function EmblemShape({ emblem, fill, stroke }: { emblem: Emblem; fill: string; stroke: string }) {
  const common = { fill, stroke, strokeWidth: 0.8, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  switch (emblem) {
    case "star": return <path d={starPath(32, 19, 7.5, 3.2)} {...common} />;
    case "ball":
      return (
        <g {...common}>
          <circle cx="32" cy="19" r="6.5" fillOpacity="0.15" />
          <path d="M32 15.5 35.3 18l-1.2 3.8h-4.2L28.7 18Z" />
        </g>
      );
    case "crown": return <path d="M24 25 22 13l6 5 4-7 4 7 6-5-2 12Z" {...common} />;
    case "bolt": return <path d="M34 10 26 21.5h5L29 29l9-12h-5.2Z" {...common} />;
    case "chevron": return <path d="M21 25 32 13l11 12v5L32 19 21 30Z" {...common} />;
    case "lion":
      return (
        <g {...common}>
          <path d={spikes(32, 20, 10.5, 7.6, 14)} />
          <circle cx="32" cy="20.5" r="5.6" fill={stroke} stroke="none" />
          <circle cx="29.8" cy="19.6" r="0.95" fill={fill} stroke="none" /><circle cx="34.2" cy="19.6" r="0.95" fill={fill} stroke="none" />
          <path d="M30.4 23.2h3.2l-1.6 1.8Z" fill={fill} stroke="none" />
        </g>
      );
    case "eagle": return <path d="M12 19 23 17l4 5 5-11 5 11 4-5 11 2-9 5-6 6-5 4-5-4-6-6Z" {...common} />;
    case "castle": return <path d="M22 30V17h4v3h3v-3h6v3h3v-3h4v13Z M30 30v-4a2 2 0 0 1 4 0v4Z" {...common} fillRule="evenodd" />;
    case "bean":
      return (
        <g {...common}>
          <ellipse cx="32" cy="20" rx="6.4" ry="10" transform="rotate(32 32 20)" />
          <path d="M28.4 28.6c4-4 4-9 7.2-17.2" fill="none" stroke={stroke} strokeWidth="1.8" />
        </g>
      );
    case "wave":
      return (
        <g fill="none" stroke={fill} strokeWidth="2.6" strokeLinecap="round">
          <path d="M20 15q3-3 6 0t6 0t6 0t6 0M20 21.5q3-3 6 0t6 0t6 0t6 0M20 28q3-3 6 0t6 0t6 0t6 0" />
        </g>
      );
    case "sun":
      return (
        <g {...common}>
          <circle cx="32" cy="20" r="5.2" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <line key={i} x1={32 + 7.6 * Math.cos(a)} y1={20 + 7.6 * Math.sin(a)} x2={32 + 11 * Math.cos(a)} y2={20 + 11 * Math.sin(a)} stroke={fill} strokeWidth="2.2" strokeLinecap="round" />;
          })}
        </g>
      );
    case "trident": return <g fill="none" stroke={fill} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M32 9v22M24.5 12v6.5a7.5 7.5 0 0 0 15 0V12" /></g>;
    case "cross": return <path d="M29 9h6v7h7v6h-7v9h-6v-9h-7v-6h7Z" {...common} />;
    default: return null;
  }
}

function Pattern({ pattern, color, secondary }: { pattern: KitPattern; color: string; secondary: string }) {
  return (
    <>
      <rect width="64" height="64" fill={color} />
      {pattern === "stripes" && [14, 30, 46].map((x) => <rect key={x} x={x} y="0" width="9" height="64" fill={secondary} />)}
      {pattern === "hoops" && [14, 30, 46].map((y) => <rect key={y} x="0" y={y} width="64" height="9" fill={secondary} />)}
      {pattern === "halves" && <rect x="32" y="0" width="32" height="64" fill={secondary} />}
      {pattern === "band" && <rect x="24" y="0" width="16" height="64" fill={secondary} />}
      {pattern === "sash" && <path d="M0 14 14 0h14L0 28Z M0 42 42 0h14L0 56Z" fill={secondary} />}
      {pattern === "tricolor" && (
        <>
          <rect width="64" height="22" y="0" fill="#078930" />
          <rect width="64" height="21" y="21.5" fill={secondary} />
          <rect width="64" height="22" y="42" fill="#da121a" />
        </>
      )}
    </>
  );
}

/** Original crest: shape + kit pattern + generic emblem + club initials. */
export function GeneratedCrest({
  name, color, size, flat = false,
}: { name: string; color: string; size: number; flat?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const style = clubStyle(name);
  const secondary = style?.secondary ?? "#ffffff";
  const pattern: KitPattern = style?.pattern ?? "solid";
  const { shape, emblem } = crestDesign(name);
  color = clubPrimary(name, color);

  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
  const text = (words.length > 1 ? words.slice(0, 3).map((w) => Array.from(w)[0]).join("") : Array.from(name).slice(0, 3).join("")).toUpperCase();

  // Pick black or white lettering from the colour sitting under the text (the middle of the crest).
  const under = pattern === "tricolor" ? secondary : pattern === "solid" || pattern === "band" ? color : luminance(color) < 140 ? color : secondary;
  const ink = luminance(under) > 150 ? "#111827" : "#ffffff";
  const halo = ink === "#ffffff" ? "rgba(0,0,0,.5)" : "rgba(255,255,255,.55)";
  const hasEmblem = emblem !== "none";
  const d = shapePath(shape);

  return (
    <svg
      viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={name}
      className={flat ? "shrink-0" : "shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]"}
    >
      <defs>
        <clipPath id={`c-${uid}`}><path d={d} /></clipPath>
        <linearGradient id={`s-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".3" /><stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c-${uid})`}>
        <Pattern pattern={pattern} color={color} secondary={secondary} />
        <rect width="64" height="38" fill={`url(#s-${uid})`} />
      </g>
      <path d={d} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.4" />
      <path d={d} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth=".8" transform="translate(0 .6)" />
      {shape === "ring" && <circle cx="32" cy="32" r="23.5" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1.4" />}
      {/* backing plate keeps initials legible over stripes/hoops */}
      {(pattern === "stripes" || pattern === "hoops" || pattern === "halves" || pattern === "sash") && (
        <rect x="11" y={hasEmblem ? 32 : 26} width="42" height="16" rx="3" fill={color} fillOpacity="0.9" />
      )}
      {hasEmblem && <EmblemShape emblem={emblem} fill={ink} stroke={halo} />}
      <text
        x="32" y={hasEmblem ? 45 : 39} textAnchor="middle" fontWeight="900"
        fontSize={text.length > 2 ? 14 : 18} fill={ink} stroke={halo} strokeWidth=".7" paintOrder="stroke"
        style={{ fontFamily: "inherit" }}
      >
        {text}
      </text>
    </svg>
  );
}
