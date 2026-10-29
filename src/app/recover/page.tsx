"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Brand from "@/components/Brand";

export default function RecoverPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", code: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code: form.code, newPassword: form.password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Reset failed");
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Cannot reach the registry. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mesh flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        <Link href="/login" className="text-xs font-semibold text-brand-700 hover:underline">Back to sign in</Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="card card-pad w-full max-w-md">
          <span className="eyebrow">Password recovery</span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-stone-900">Reset your password</h1>
          <p className="mt-1 text-sm text-stone-500">
            Use the recovery code you saved when the root account was created.
          </p>

          {done ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              ✓ Password updated. Taking you to sign in…
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="rc-email">Email address</label>
                <input id="rc-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@gmail.com" required />
              </div>
              <div>
                <label className="label" htmlFor="rc-code">Recovery code</label>
                <input id="rc-code" className="input font-mono uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CILRM-XXXX-XXXX-XXXX" required />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="rc-pass">New password</label>
                  <input id="rc-pass" type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" minLength={8} required />
                </div>
                <div>
                  <label className="label" htmlFor="rc-confirm">Confirm</label>
                  <input id="rc-confirm" type="password" className="input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} minLength={8} required />
                </div>
              </div>
              {error ? <p className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">{error}</p> : null}
              <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy ? "Resetting…" : "Reset password"}</button>
              <p className="text-[11px] leading-relaxed text-stone-400">
                Lost the recovery code too? Any signed-in administrator can reset your password from Settings → Administrators.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
