import type { ReactNode } from "react";
import { SessionNav } from "@/components/layout/session-nav";

export default function SessionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SessionNav />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
