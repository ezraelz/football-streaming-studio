// src/app/(control)/maker/page.tsx
import { Suspense } from "react";
import { MakerContent } from "./maker-content";

export const instant = false;

export default function MakerPage() {
  return (
    <Suspense fallback={null}>
      <MakerContent />
    </Suspense>
  );
}