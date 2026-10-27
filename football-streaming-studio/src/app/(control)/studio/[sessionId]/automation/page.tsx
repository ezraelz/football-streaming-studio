export const instant = false;

import { Suspense } from "react";
import { AutomationContent } from "./automation-content";

export default function AutomationPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Loading automation rules…</div>}>
      <AutomationContent />
    </Suspense>
  );
}
