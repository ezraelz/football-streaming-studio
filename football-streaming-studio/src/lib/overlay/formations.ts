/**
 * Position slots on a horizontal pitch.
 * x = depth (0 = own goal line, 100 = opponent goal line)
 * y = width (0 = top, 100 = bottom)
 */
export type Slot = { x: number; y: number; role: string };

/**
 * Generate formation slots from a formation string like "4-3-3" or "4-2-3-1".
 * The string is a list of row counts from defense to attack:
 *   "4-3-3"   → 1 GK, 4 defenders, 3 midfielders, 3 forwards
 *   "4-2-3-1" → 1 GK, 4 def, 2 DM, 3 AM, 1 ST
 *   "3-5-2"   → 1 GK, 3 def, 5 mid, 2 forwards
 */
export function slotsFromFormation(formation: string): Slot[] {
  // Normalize: "4-3-3" / "4 - 3 - 3" / "4:3:3" / "433" all become [4, 3, 3]
  const digits = (formation || "").replace(/[^0-9]/g, "");
  const rows: number[] = digits ? digits.split("").map(Number) : [4, 3, 3];

  // Sanity check: must have at least 1 outfield row and sum to 10 outfielders
  const outfield = rows.reduce((a, b) => a + b, 0);
  if (outfield !== 10) {
    // Malformed input — fall back to 4-3-3
    rows.length = 0;
    rows.push(4, 3, 3);
  }

  const slots: Slot[] = [];

  // Goalkeeper — fixed at the own goal line
  slots.push({ x: 8, y: 50, role: "GK" });

  // Outfield rows: distribute evenly between x=20 (defense) and x=85 (attack)
  const nRows = rows.length;
  const xStart = 22;   // first outfield row (defenders)
  const xEnd = 85;     // last outfield row (forwards)
  const step = nRows === 1 ? 0 : (xEnd - xStart) / (nRows - 1);

  // Role labels per row position (defense → attack)
  const roleLabels: string[][] = [
    // 1 row
    ["MF"],
    // 2 rows
    ["DF", "FW"],
    // 3 rows
    ["DF", "MF", "FW"],
    // 4 rows
    ["DF", "DM", "AM", "FW"],
    // 5 rows
    ["DF", "DM", "CM", "AM", "FW"],
  ];

  const roleForRow = (rowIdx: number, total: number): string => {
    const labels = roleLabels[total - 1] ?? roleLabels[2];
    return labels[rowIdx] ?? "MF";
  };

  rows.forEach((count, rowIdx) => {
    const x = nRows === 1 ? 50 : xStart + step * rowIdx;
    const role = roleForRow(rowIdx, nRows);

    // Distribute the count players evenly across the pitch width,
    // with equal margins on both sides.
    const count_ = Math.max(1, count);
    const margin = count_ === 1 ? 50 : Math.max(8, 50 / count_);
    const available = 100 - margin * 2;

    for (let i = 0; i < count_; i++) {
      const y = count_ === 1 ? 50 : margin + (available / (count_ - 1)) * i;
      slots.push({ x, y, role });
    }
  });

  return slots;
}

/**
 * Assign lineup players to slots generated from the formation string.
 * Tries to match by position label first, then falls back to index order.
 */
const POSITION_ALIASES: Record<string, string[]> = {
  GK: ["GK", "GOALKEEPER"],
  DF: ["DF", "DEF", "DEFENDER", "LB", "RB", "CB", "LWB", "RWB", "SW"],
  MF: ["MF", "MID", "MIDFIELDER", "CM", "DM", "AM", "LM", "RM", "CDM", "CAM"],
  FW: ["FW", "FORWARD", "ST", "CF", "LW", "RW", "SS", "ATT", "STRIKER"],
};

function matchesRole(playerPosition: string | null | undefined, slotRole: string): boolean {
  if (!playerPosition) return false;
  const pos = playerPosition.toUpperCase().trim();
  const aliases = POSITION_ALIASES[slotRole.toUpperCase()];
  if (aliases) return aliases.some((a) => pos === a || pos.startsWith(a));
  return pos === slotRole.toUpperCase();
}

export function assignToFormation(
  players: Array<{ name: string; number?: number | null; position?: string | null }>,
  formation: string,
): Array<{ name: string; number?: number | null; x: number; y: number }> {
  const slots = slotsFromFormation(formation);
  const remaining = [...players];

  return slots.map((slot, i) => {
    // Try to find a position match first
    let idx = remaining.findIndex((p) => matchesRole(p.position, slot.role));
    // Fall back to next-by-index
    if (idx === -1) idx = Math.min(i, remaining.length - 1);
    const p = remaining[idx] ?? { name: "—", number: null };
    if (idx >= 0 && idx < remaining.length) remaining.splice(idx, 1);
    return {
      name: p.name,
      number: p.number,
      x: slot.x,
      y: slot.y,
    };
  });
}