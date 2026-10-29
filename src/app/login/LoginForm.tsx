"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";


export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Sign in failed");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Cannot reach the registry. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@gmail.com or you@office.org" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            className="input pr-16"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            required
          />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-500 hover:bg-stone-100" onClick={() => setShow((value) => !value)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {error ? <p className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">{error}</p> : null}
      <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
        {loading ? "Checking credentials…" : "Sign in to registry"}
      </button>
      <p className="rounded-lg bg-stone-50 px-3 py-2 text-[11px] leading-relaxed text-stone-500">
        Sign in with your <strong className="text-stone-700">personal or office email</strong> — whichever is registered on your account. If both are
        saved, either one works with the same password.
      </p>
      <div className="flex items-center justify-between text-[11px] text-stone-500">
        <a href="/recover" className="link">Forgot password?</a>
        <span>
          First time? <a href="/setup" className="link">Root sign-up</a>
        </span>
      </div>
    </form>
  );
}
