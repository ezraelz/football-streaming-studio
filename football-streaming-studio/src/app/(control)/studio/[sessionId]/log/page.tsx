export const instant = false;

import { Suspense } from "react";
import { LogContent } from "./log-content";

export default function ShowLogPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading log…</div>}>
      <LogContent />
    </Suspense>
  );
}