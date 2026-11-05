export const instant = false;

import { Suspense } from "react";
import { CommentaryContent } from "./commentary-content";

export default function CommentaryDeskPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Loading commentary desk…</div>}>
      <CommentaryContent />
    </Suspense>
  );
}
