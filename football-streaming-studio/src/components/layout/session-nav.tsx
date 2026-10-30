"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquareText, ScrollText, Zap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utility/utils";
import { focusRing } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n";

const TABS = [
  { slug: "", key: "tabs.studio", icon: LayoutDashboard },
  { slug: "/commentary", key: "tabs.commentary", icon: MessageSquareText },
  { slug: "/automation", key: "tabs.automation", icon: Zap },
  { slug: "/log", key: "tabs.log", icon: ScrollText },
] as const;

export function SessionNav() {
  const t = useT();
  const { sessionId } = useParams<{ sessionId: string }>();
  const pathname = usePathname();
  const base = `/studio/${sessionId}`;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800">
      <nav aria-label={t("tabs.sections")} className="-mx-1 flex-1 overflow-x-auto px-1">
        <ul className="flex min-w-max gap-1">
          {TABS.map(({ slug, key, icon: Icon }) => {
            const href = base + slug;
            const active = slug === "" ? pathname === base : pathname.startsWith(href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    focusRing,
                    active
                      ? "border-emerald-500 text-zinc-50"
                      : "border-transparent text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        onClick={async () => {
          const res = await api.provisionObs(sessionId);
          alert(
            `${res.obs_connected ? t("tabs.obsConnected") : t("tabs.obsOffline")}.\n` +
            res.results.map((r) => `${r.obs_scene}: ${r.created_or_updated ? "✓" : "✗"}`).join("\n")
          );
        }}
        title={t("tabs.provisionHint")}
        className="mb-1 mr-1 flex shrink-0 items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {t("tabs.provision")}
      </button>
    </div>
  );
}