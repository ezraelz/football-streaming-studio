export const instant = false;

import { Suspense } from "react";
import { StudioContent, StudioSkeleton } from "./studio-content";

export default function StudioPage() {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <StudioContent />
    </Suspense>
  );
}
