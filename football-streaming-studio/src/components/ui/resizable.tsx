"use client";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { cn } from "@/lib/utility/utils";
import { useT } from "@/lib/i18n";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * A size (px) that the user can change and that is remembered in this browser.
 * Starts at `initial` on the server and first paint, then restores the saved value.
 */
export function useResizableSize(storageKey: string, initial: number, min: number, max: number) {
  const [size, setSizeState] = useState(initial);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`studio.size.${storageKey}`);
      const n = raw == null ? NaN : Number(raw);
      if (Number.isFinite(n)) setSizeState(clamp(n, min, max));
    } catch { /* storage blocked */ }
    loaded.current = true;
  }, [storageKey, min, max]);

  const setSize = useCallback((next: number | ((prev: number) => number)) => {
    setSizeState((prev) => {
      const v = clamp(typeof next === "function" ? next(prev) : next, min, max);
      try { window.localStorage.setItem(`studio.size.${storageKey}`, String(Math.round(v))); } catch { /* ignore */ }
      return v;
    });
  }, [storageKey, min, max]);

  const reset = useCallback(() => setSize(initial), [setSize, initial]);
  return { size, setSize, reset, min, max };
}

/**
 * Drag handle between two panels. Drag with mouse/touch, or focus it and use the arrow keys
 * (Shift = bigger steps). Double-click or press Home to reset.
 * `direction` says which way the dragged edge grows the target: use 1 when the target panel is to the
 * LEFT of / ABOVE the handle, -1 when it is to the RIGHT / BELOW.
 */
export function ResizeHandle({
  orientation = "vertical", direction = 1, value, min, max, onChange, onReset, label, className,
}: {
  orientation?: "vertical" | "horizontal"; // "vertical" = a vertical bar that resizes WIDTH
  direction?: 1 | -1;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  onReset?: () => void;
  label?: string;
  className?: string;
}) {
  const t = useT();
  const start = useRef<{ pos: number; value: number } | null>(null);
  const [active, setActive] = useState(false);
  const horizontalResize = orientation === "vertical";

  useEffect(() => {
    if (!active) return;
    const cls = horizontalResize ? "is-resizing" : "is-resizing-y";
    document.body.classList.add(cls);
    return () => document.body.classList.remove(cls);
  }, [active, horizontalResize]);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { pos: horizontalResize ? e.clientX : e.clientY, value };
    setActive(true);
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const delta = (horizontalResize ? e.clientX : e.clientY) - start.current.pos;
    onChange(clamp(start.current.value + delta * direction, min, max));
  };
  const end = () => { start.current = null; setActive(false); };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    const grow = horizontalResize ? "ArrowRight" : "ArrowDown";
    const shrink = horizontalResize ? "ArrowLeft" : "ArrowUp";
    if (e.key === grow) onChange(clamp(value + step * direction, min, max));
    else if (e.key === shrink) onChange(clamp(value - step * direction, min, max));
    else if (e.key === "Home") onReset?.();
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label ?? t("resize.label")}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={t("resize.hint")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cn(
        "resize-handle group relative z-10 shrink-0 outline-none",
        horizontalResize ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
        className,
      )}
    >
      <span
        className={cn(
          "absolute rounded-full bg-zinc-700 transition-colors group-hover:bg-emerald-500 group-focus-visible:bg-emerald-500",
          active && "bg-emerald-500",
          horizontalResize ? "inset-y-1/2 left-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2" : "inset-x-1/2 left-1/2 top-1/2 h-1 w-12 -translate-x-1/2 -translate-y-1/2",
        )}
      />
      <span className={cn("absolute bg-emerald-500/0 transition-colors group-hover:bg-emerald-500/40", active && "bg-emerald-500/60", horizontalResize ? "inset-y-0 left-1/2 w-px -translate-x-1/2" : "inset-x-0 top-1/2 h-px -translate-y-1/2")} />
    </div>
  );
}
