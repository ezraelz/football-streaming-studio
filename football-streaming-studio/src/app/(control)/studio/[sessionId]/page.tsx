export const instant = false;

import { Suspense } from "react";
import { StudioContent } from "./studio-content";

export default function StudioPage() {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <StudioContent />
    </Suspense>
  );
}

function StudioSkeleton() {
  return (
    <div className="grid h-full grid-cols-[220px_1fr_360px] gap-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40" />
      <div className="aspect-video w-full animate-pulse rounded-lg bg-zinc-900/40" />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40" />
    </div>
  );
}