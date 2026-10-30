"use client";
import { MatchSnapshot } from "@/lib/types/types";
import { LineupSide } from "@/lib/api/client";
import { OverlayPanel } from "@/components/overlay/panel";
import { useI18n } from "@/lib/i18n";
import { localTeamName } from "@/lib/branding/clubs";
import { assignToFormation } from "@/lib/overlay/formations";

interface TacticalSceneProps {
  snapshot: MatchSnapshot;
  lineups?: {
    home: LineupSide | null;
    away: LineupSide | null;
  } | null;
  /** Show player names below each jersey dot. Default true. */
  showNames?: boolean;
  /** Show player numbers inside each jersey dot. Default true. */
  showNumbers?: boolean;
}

export function TacticalScene({
  snapshot,
  lineups,
  showNames = true,
  showNumbers = true,
}: TacticalSceneProps) {
  const { t, lang } = useI18n();
  const line = { stroke: "white", strokeOpacity: 0.55, strokeWidth: 2, fill: "none" } as const;

  const homeFormation = lineups?.home?.formation ?? "4-3-3";
  const awayFormation = lineups?.away?.formation ?? "4-3-3";

  // Slots come from `slotsFromFormation` — x = depth (0..100), y = width (0..100)
  const homeSlots = assignToFormation(lineups?.home?.players ?? [], homeFormation);
  const awaySlots = assignToFormation(lineups?.away?.players ?? [], awayFormation);

  // Home occupies left half: x 0..100 → 0..50
  // Away occupies right half: x 0..100 → 50..100 (mirrored)
  const homePlacement = homeSlots.map((p) => ({
    ...p,
    finalX: p.x / 2,
    finalY: p.y,
  }));
  const awayPlacement = awaySlots.map((p) => ({
    ...p,
    finalX: 100 - p.x / 2,
    finalY: p.y,
  }));

  const toSvgX = (x: number) => 6 + (x / 100) * 668;
  const toSvgY = (y: number) => 6 + (y / 100) * 408;

  const formationLabel = (side: LineupSide | null | undefined) =>
    side?.formation ? ` (${side.formation})` : "";

  const renderPlayer = (
    p: { name: string; number?: number | null; finalX: number; finalY: number },
    color: string,
    keyPrefix: string,
    idx: number,
  ) => {
    const cx = toSvgX(p.finalX);
    const cy = toSvgY(p.finalY);
    // Surname only — "Erling Haaland" → "Haaland"
    const surname = p.name.split(" ").slice(-1)[0];
    // Short form for very long surnames
    const shortName = surname.length > 12 ? surname.slice(0, 11) + "…" : surname;

    return (
      <g key={`${keyPrefix}-${idx}`}>
        {/* Jersey */}
        <circle cx={cx} cy={cy} r="13" fill={color} stroke="white" strokeWidth="2.5" />
        {showNumbers && p.number != null && (
          <text
            x={cx}
            y={cy + 5}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="white"
          >
            {p.number}
          </text>
        )}
        {showNames && (
          <text
            x={cx}
            y={cy + 28}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="white"
            style={{ opacity: 0.9, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
          >
            {shortName}
          </text>
        )}
      </g>
    );
  };

  return (
    <OverlayPanel
      title={`${t("ov.tactical")} · ${snapshot.home.shortName} – ${snapshot.away.shortName}`}
      competition={snapshot.competition}
      className="left-1/2 top-[18%] w-[1100px] -translate-x-1/2"
    >
      <div className="mb-3 flex items-center justify-between text-[24px] font-extrabold text-white">
        <span className="flex items-center gap-2">
          <i className="inline-block h-4 w-4 rounded-full" style={{ background: snapshot.home.color }} />
          {localTeamName(snapshot.home.name, lang)}
          <span className="text-white/50" style={{ fontSize: "0.8em" }}>
            {formationLabel(lineups?.home)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-white/50" style={{ fontSize: "0.8em" }}>
            {formationLabel(lineups?.away)}
          </span>
          {localTeamName(snapshot.away.name, lang)}
          <i className="inline-block h-4 w-4 rounded-full" style={{ background: snapshot.away.color }} />
        </span>
      </div>

      <svg viewBox="0 0 680 420" className="w-full rounded-2xl" style={{ background: "var(--ov-pitch)" }}>
        {/* Pitch markings */}
        <rect x="6" y="6" width="668" height="408" {...line} />
        <line x1="340" y1="6" x2="340" y2="414" {...line} />
        <circle cx="340" cy="210" r="56" {...line} />
        <circle cx="340" cy="210" r="3" fill="white" fillOpacity="0.6" />
        <rect x="6" y="110" width="96" height="200" {...line} />
        <rect x="6" y="160" width="36" height="100" {...line} />
        <rect x="578" y="110" width="96" height="200" {...line} />
        <rect x="638" y="160" width="36" height="100" {...line} />

        {/* Home players */}
        {homePlacement.map((p, i) => renderPlayer(p, snapshot.home.color, "h", i))}

        {/* Away players */}
        {awayPlacement.map((p, i) => renderPlayer(p, snapshot.away.color, "a", i))}
      </svg>

      <div className="mt-3 text-[18px] text-white/55">{t("ov.tacticalNote")}</div>
    </OverlayPanel>
  );
}