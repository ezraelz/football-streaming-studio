export function LowerThirdScene({ text, lift }: { text?: string | null; lift?: number }) {
  if (!text) {
    return null; // nothing active → nothing on screen
  }
  return (
    // z-30: live commentary always sits above the graphics layer.
    // `lift` (px) raises it clear of the bottom strip when that is on air.
    <div className="absolute left-[5%] z-30 max-w-[60%]" style={{ bottom: lift ?? "8%" }}>
      <div className="border-l-4 border-emerald-500 bg-black/85 px-6 py-4 backdrop-blur-md">
        <div className="mb-1 text-[16px] font-semibold uppercase tracking-wider text-emerald-400">
          Live Commentary
        </div>
        <div className="text-[28px] font-medium leading-snug text-white">{text}</div>
      </div>
    </div>
  );
}
