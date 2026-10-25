export const instant = false;
import { Suspense } from "react";
import { AutomationContent } from "./automation-content";

export default function AutomationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading automation…</div>}>
      <AutomationContent />
    </Suspense>
  );
}