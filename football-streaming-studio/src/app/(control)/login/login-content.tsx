"use client";
export const instant = false;
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { AlertCircle } from "lucide-react";

export default function LoginPageContent() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      setError("Invalid credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/60 p-6"
      >
        <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
        <p className="mb-5 text-xs text-zinc-500">
          Development build. Uses your Django superuser.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        <label className="mb-1 block text-xs text-zinc-400">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="mb-3 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        />

        <label className="mb-1 block text-xs text-zinc-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        />

        <button
          type="submit"
          disabled={busy || !username || !password}
          className="w-full rounded bg-emerald-600 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

