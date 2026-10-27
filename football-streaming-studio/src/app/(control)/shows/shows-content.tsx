"use client";
import { Suspense } from "react";
import { ProfilesContent } from "./profiles-content";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/feedback";

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
      <PageHeader title="Show profiles" description="Loading…" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-48" /><Skeleton className="h-48" />
      </div>
    </div>
  );
}
