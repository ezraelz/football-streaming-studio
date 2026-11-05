"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Clapperboard, Film, LogOut, Radio, Settings, Tv2 } from "lucide-react";
import { cn } from "@/lib/utility/utils";
import { clearTokens } from "@/lib/api/client";
import { useShowStore } from "@/lib/stores/show-store";
import { focusRing } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { LanguageSwitch, ThemeSwitch } from "@/components/ui/prefs";

// Grouped the way a producer works: pick the match, then set up the show.
const NAV_GROUPS = [
  { label: "nav.group.broadcast", items: [{ href: "/", key: "nav.matches", icon: CalendarDays, exact: true }, { href: "/maker", key: "nav.maker", icon: Film, exact: false }] },
  {
    label: "nav.group.setup",
    items: [
      { href: "/shows", key: "nav.shows", icon: Clapperboard, exact: false },
      { href: "/settings", key: "nav.settings", icon: Settings, exact: false },
    ],
  },
] as const;

export function Sidebar({ width = 248 }: { width?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const session = useShowStore((s) => s.session);
  const matchLabel = useShowStore((s) => (s.snapshot ? `${s.snapshot.home.shortName} v ${s.snapshot.away.shortName}` : null));

  const hasShow = session && session.state !== "stopped";
  const inStudio = pathname.startsWith("/studio");

  const logout = () => {
    clearTokens();
    router.replace("/login");
  };

  return (
    <aside className="flex h-full max-w-full flex-col border-r border-zinc-800 bg-zinc-900" style={{ width }}>
      <div className="pitch-stripes flex items-center gap-3 border-b border-zinc-800 bg-gradient-to-br from-emerald-950 to-zinc-900 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white/30" aria-hidden>
          <Tv2 className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-lg font-bold uppercase tracking-wide text-zinc-50">{t("app.name")}</div>
          <div className="text-xs text-zinc-400">{t("app.tagline")}</div>
        </div>
      </div>

      {/* Current show — always one click away, wherever you are */}
      {hasShow && (
        <div className="px-3 pt-3">
          <Link
            href={`/studio/${session.id}`}
            className={cn(
              "block rounded-lg border px-3 py-2.5 transition-colors",
              focusRing,
              inStudio
                ? "border-emerald-700/60 bg-emerald-600/15"
                : "border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800",
            )}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              <Radio
                className={cn("h-3.5 w-3.5", session.state === "live" ? "text-red-400" : "text-amber-400")}
                aria-hidden
              />
              {t("nav.currentShow")}
              <span className="ml-auto text-zinc-400">{t(`state.${session.state}` as const)}</span>
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-zinc-50">
              {matchLabel ?? t("nav.openStudio")}
            </div>
          </Link>
        </div>
      )}

      <nav aria-label={t("nav.main")} className="flex-1 space-y-4 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mb-1 px-3 font-display text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{t(group.label)}</div>
            <div className="space-y-1">
              {group.items.map(({ href, key, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      focusRing,
                      active ? "bg-emerald-600/15 text-zinc-50" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-emerald-500" aria-hidden />}
                    <Icon className={cn("h-4 w-4", active && "text-emerald-400")} aria-hidden />
                    <span className="truncate">{t(key)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-zinc-800 p-3">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <LanguageSwitch compact />
          <ThemeSwitch />
        </div>
        <button
          onClick={logout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100",
            focusRing,
          )}
        >
          <LogOut className="h-4 w-4" aria-hidden /> {t("nav.signOut")}
        </button>
        <div className="px-3 text-xs text-zinc-500">{t("nav.version")}</div>
      </div>
    </aside>
  );
}
