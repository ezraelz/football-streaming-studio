export const instant = false;

import { Suspense } from "react";
import { CommentaryContent } from "./commentary-content";

export default function CommentaryDeskPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading commentary desk…</div>}>
      <CommentaryContent />
    </Suspense>
  );
}