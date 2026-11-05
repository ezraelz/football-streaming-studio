import type { ReactNode } from "react";
import { CalendarDays, Clapperboard, Settings, Trophy, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { matches: CalendarDays, shows: Clapperboard, settings: Settings, trophy: Trophy };

/**
 * Page banner: pitch-green gradient with mown stripes and centre-circle line art, so every page
 * opens like a football programme. `icon` is optional.
 */
export function PageHeader({
  title, description, actions, icon,
}: { title: string; description?: ReactNode; actions?: ReactNode; icon?: keyof typeof ICONS | (string & {}) }) {
  const Icon = icon ? ICONS[icon] : undefined;
  return (
    <header className="pitch-stripes pitch-lines relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-emerald-900/50 bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {Icon && (
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white/20 sm:flex" aria-hidden>
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-zinc-50">{title}</h1>
          {description && <p className="mt-0.5 max-w-2xl text-sm text-zinc-300">{description}</p>}
        </div>
      </div>
      {actions && <div className="relative flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
