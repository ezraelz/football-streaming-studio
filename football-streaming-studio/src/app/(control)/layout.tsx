"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { AuthGuard } from "@/components/layout/auth-guard";
import { useT } from "@/lib/i18n";
import { LanguageSwitch, ThemeToggle } from "@/components/ui/prefs";

export default function ControlLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LayoutFallback />}>
      <LayoutShell>{children}</LayoutShell>
    </Suspense>
  );
}

function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const [menuState, setMenuState] = useState({ open: false, pathname: "" });
  const menuOpen = menuState.open && menuState.pathname === pathname;

  const setMenuOpen = (open: boolean) => {
    setMenuState({ open, pathname });
  };

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // The login page renders on its own, without the app chrome.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh bg-zinc-950 text-zinc-100">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t("nav.skip")}
      </a>

      {/* Backdrop (mobile only) */}
      {menuOpen && (
        <button
          aria-label={t("nav.closeMenu")}
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar: slide-in drawer on mobile, fixed column on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 motion-reduce:transition-none lg:static lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar />
        </Suspense>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header with menu button */}
        <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5 lg:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold">{t("app.name")}</span>
          <span className="ml-auto flex items-center gap-2">
            <LanguageSwitch compact />
            <ThemeToggle />
          </span>
        </div>

        <TopBar />

        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </div>
  );
}

function LayoutFallback() {
  return (
    <div className="flex h-dvh bg-zinc-950">
      <div className="hidden w-56 border-r border-zinc-800 bg-zinc-900/50 lg:block" />
      <div className="flex-1 p-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-900 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function SidebarFallback() {
  const t = useT();
  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-4 py-5">
        <div className="text-sm text-zinc-500">{t("app.tagline")}</div>
        <div className="text-lg font-semibold text-zinc-100">{t("app.name")}</div>
      </div>
      <nav className="flex-1 space-y-2 p-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-800/60 motion-reduce:animate-none" />
        ))}
      </nav>
      <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">{t("nav.version")}</div>
    </aside>
  );
}