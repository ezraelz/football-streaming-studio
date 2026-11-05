export const instant = false;

import { Suspense } from "react";
import { LogContent } from "./log-content";

export default function ShowLogPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Loading log…</div>}>
      <LogContent />
    </Suspense>
  );
}
