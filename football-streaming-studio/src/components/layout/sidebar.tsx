"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Clapperboard, LogOut, Radio, Settings, Tv2 } from "lucide-react";
import { cn } from "@/lib/utility/utils";
import { clearTokens } from "@/lib/api/client";
import { useShowStore } from "@/lib/stores/show-store";
import { focusRing } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { LanguageSwitch, ThemeSwitch } from "@/components/ui/prefs";

const NAV = [
  { href: "/", key: "nav.matches", icon: CalendarDays, exact: true },
  { href: "/shows", key: "nav.shows", icon: Clapperboard },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const { session, snapshot } = useShowStore();

  const hasShow = session && session.state !== "stopped";
  const inStudio = pathname.startsWith("/studio");

  const logout = () => {
    clearTokens();
    router.replace("/login");
  };

  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white" aria-hidden>
          <Tv2 className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-zinc-50">{t("app.name")}</div>
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
              {snapshot ? `${snapshot.home.shortName} v ${snapshot.away.shortName}` : t("nav.openStudio")}
            </div>
          </Link>
        </div>
      )}

      <nav aria-label={t("nav.main")} className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, key, icon: Icon, ...rest }) => {
          const exact = "exact" in rest ? rest.exact : false;
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                focusRing,
                active
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-emerald-400")} aria-hidden />
              {t(key)}
            </Link>
          );
        })}
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
