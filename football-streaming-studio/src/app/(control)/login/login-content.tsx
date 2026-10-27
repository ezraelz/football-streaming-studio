"use client";
export const instant = false;
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Tv2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, inputClass } from "@/components/ui/form";

export default function LoginPageContent() {
  const router = useRouter();
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
      setError("That username or password isn’t right. Check them and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white" aria-hidden>
            <Tv2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Streaming Studio</h1>
          <p className="mt-1 text-sm text-zinc-400">Sign in to run your football show.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          {error && <Alert tone="error">{error}</Alert>}

          <Field label="Username" htmlFor={`${uid}-u`}>
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

          <Field label="Password" htmlFor={`${uid}-p`}>
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
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!username || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-500">Development build · uses your Django superuser.</p>
      </div>
    </div>
  );
}
