"use client";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { AuthGuard } from "@/components/layout/auth-guard";

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LayoutFallback />}>
      <LayoutShell>{children}</LayoutShell>
    </Suspense>
  );
}

function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login page renders standalone without the app chrome.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </div>
  );
}

function LayoutFallback() {
  return <div className="flex h-screen bg-zinc-950" />;
}

function SidebarFallback() {
  return (
    <aside className="flex w-56 flex-col border-r border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 px-4 py-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Football
        </div>
        <div className="text-lg font-bold">Streaming Studio</div>
      </div>
      <nav className="flex-1 space-y-1 p-2" />
      <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">
        v1.0 · MVP
      </div>
    </aside>
  );
}