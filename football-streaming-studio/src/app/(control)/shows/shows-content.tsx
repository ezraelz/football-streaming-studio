"use client";
import { Suspense } from "react";
import { ProfilesContent } from "./profiles-content";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/feedback";
import { useT } from "@/lib/i18n";

export default function ShowProfilesPage() {
  return (
    <Suspense fallback={<ProfilesSkeleton />}>
      <ProfilesContent />
    </Suspense>
  );
}

function ProfilesSkeleton() {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t("nav.shows")} description={t("common.loading")} icon="shows" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-48" /><Skeleton className="h-48" />
      </div>
    </div>
  );
}
