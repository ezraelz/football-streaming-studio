"use client";
import { Suspense } from "react";
import { ProfilesContent } from "./profiles-content";

export default function ShowProfilesPage() {
  return (
    <Suspense fallback={<ProfilesSkeleton />}>
      <ProfilesContent />
    </Suspense>
  );
}

function ProfilesSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Show Profiles</h1>
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    </div>
  );
}