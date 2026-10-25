export function LowerThirdScene({ text }: { text?: string | null }) {
  if (!text) {
    return null; // nothing active → nothing on screen
  }
  return (
    <div className="absolute bottom-[8%] left-[5%] max-w-[60%]">
      <div className="border-l-4 border-emerald-500 bg-black/80 px-4 py-3 backdrop-blur-md">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          Live Commentary
        </div>
        <div className="text-lg font-medium text-white">{text}</div>
      </div>
    </div>
  );
}