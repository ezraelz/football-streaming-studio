"use client";
import { Suspense } from "react";
import { OverlayContent } from "./overlay-content";

export default function OverlayPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <OverlayContent />
    </Suspense>
  );
}