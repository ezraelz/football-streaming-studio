"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utility/utils";
import { focusRing } from "./button";

export const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 " +
  "transition-colors hover:border-zinc-600 focus:outline-none focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label, htmlFor, hint, children, className,
}: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-zinc-200">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export function Switch({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        focusRing,
        checked ? "bg-emerald-600" : "bg-zinc-700",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Checkbox({
  checked, onChange, children,
}: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-600 bg-zinc-950 accent-emerald-500"
      />
      <span>{children}</span>
    </label>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Pick-one control. `layout="stack"` shows descriptions as radio cards. */
export function Segmented<T extends string>({
  value, onChange, options, label, disabled, layout = "inline",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  disabled?: boolean;
  layout?: "inline" | "stack";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(layout === "inline" ? "inline-flex rounded-lg bg-zinc-900 p-1" : "flex flex-col gap-2")}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "text-left transition-colors disabled:opacity-50",
              focusRing,
              layout === "inline"
                ? cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium",
                    active ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
                  )
                : cn(
                    "rounded-lg border px-3 py-2.5",
                    active
                      ? "border-emerald-600 bg-emerald-600/10"
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900",
                  ),
            )}
          >
            <span className={cn("block text-sm font-medium", layout === "stack" && active ? "text-emerald-200" : "")}>
              {o.label}
            </span>
            {layout === "stack" && o.description && (
              <span className="mt-0.5 block text-xs text-zinc-400">{o.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
