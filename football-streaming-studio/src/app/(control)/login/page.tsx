export const instant = false;
import { Suspense } from "react";
import LoginPageContent from "./login-content";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <LoginPageContent />
    </Suspense>
  );
}