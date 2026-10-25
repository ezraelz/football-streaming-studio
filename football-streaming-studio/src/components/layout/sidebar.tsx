"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Radio, Calendar, Settings, ListChecks, BarChart3, Home,
} from "lucide-react";
import { cn } from "../../lib/utility/utils";
import { LogOut } from "lucide-react";
import { clearTokens } from "@/lib/api/client";
import { useRouter } from "next/navigation";

const nav = [
  { href: "/", label: "Match Browser", icon: Home },
  { href: "/shows", label: "Show Profiles", icon: Radio },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearTokens();
    router.replace("/login");
  };
  return (
    <aside className="flex w-56 flex-col border-r border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 px-4 py-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Football
        </div>
        <div className="text-lg font-bold">Streaming Studio</div>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-emerald-600/20 text-emerald-300"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
      <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">
        v1.0 · MVP
      </div>
    </aside>
  );
}