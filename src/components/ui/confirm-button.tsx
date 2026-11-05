"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/**
 * Two-step button for destructive actions. First click arms it (turns solid red and
 * asks for confirmation); a second click within `timeout` ms runs `onConfirm`.
 * Blur, Escape, or the timeout disarm it. Replaces window.confirm(), which blocks
 * the page — a bad trade-off while a broadcast is running.
 */
export function ConfirmButton({
  onConfirm, children, confirmLabel = "Click again to confirm", icon, variant = "danger",
  size = "md", timeout = 4000, disabled, loading, className, ariaLabel,
}: {
  onConfirm: () => void;
  children?: ReactNode;
  confirmLabel?: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  timeout?: number;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onClick = () => {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(disarm, timeout);
      return;
    }
    disarm();
    onConfirm();
  };

  return (
    <Button
      variant={armed ? "danger-solid" : variant}
      size={size}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      onBlur={disarm}
      onKeyDown={(e) => { if (e.key === "Escape") disarm(); }}
      aria-label={armed ? confirmLabel : ariaLabel}
      className={className}
    >
      {icon}
      {armed ? confirmLabel : children}
    </Button>
  );
}
