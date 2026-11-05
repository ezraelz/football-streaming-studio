"use client";
export const instant = false;
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Tv2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, inputClass } from "@/components/ui/form";
import { useT } from "@/lib/i18n";
import { LanguageSwitch, ThemeToggle } from "@/components/ui/prefs";

export default function LoginPageContent() {
  const router = useRouter();
  const t = useT();
  const uid = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(username, password);
      router.push("/");
      router.refresh();
    } catch {
      setError(t("login.error"));
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSwitch compact />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white" aria-hidden>
            <Tv2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t("app.name")}</h1>
          <p className="mt-1 text-sm text-zinc-400">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          {error && <Alert tone="error">{error}</Alert>}

          <Field label={t("login.username")} htmlFor={`${uid}-u`}>
            <input
              id={`${uid}-u`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className={inputClass}
            />
          </Field>

          <Field label={t("login.password")} htmlFor={`${uid}-p`}>
            <div className="relative">
              <input
                id={`${uid}-p`}
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? t("login.hide") : t("login.show")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!username || !password}>
            {busy ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-500">{t("login.devNote")}</p>
      </div>
    </div>
  );
}
