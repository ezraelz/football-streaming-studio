"use client";
import { useEffect, useRef } from "react";

export function OverlayCanvas({
  children, preview = false,
}: { children: React.ReactNode; preview?: boolean }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const resize = () => {
      const scale = Math.min(
        wrapper.clientWidth / 1920,
        wrapper.clientHeight / 1080
      );
      inner.style.transform = `scale(${scale})`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className="relative h-screen w-screen overflow-hidden bg-transparent">
      <div
        ref={innerRef}
        className="absolute left-0 top-0"
        style={{ width: 1920, height: 1080, transformOrigin: "top left" }}
      >
        <div className="absolute inset-[5%]">{children}</div>
      </div>
      {preview && (
        <div className="pointer-events-none absolute right-4 top-4 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white/80">
          PREVIEW
        </div>
      )}
    </div>
  );
}