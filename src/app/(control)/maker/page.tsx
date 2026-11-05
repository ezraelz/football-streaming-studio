import { Suspense } from "react";
import { MakerContent } from "./maker-content";

export default function MakerPage() {
  return (
    <Suspense fallback={null}>
      <MakerContent />
    </Suspense>
  );
}
