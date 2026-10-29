"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SignUpForm, { type SignUpValues } from "@/components/SignUpForm";

export default function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(values: SignUpValues) {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, email: values.email, phone: values.phone, position: values.position, password: values.password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; recoveryCode?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Sign up failed");
      if (data.recoveryCode) {
        setRecoveryCode(data.recoveryCode);
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Cannot reach the registry. Connect to the internet and retry.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (recoveryCode) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-800">✓ Root account created</p>
          <p className="mt-1 text-xs text-emerald-700">Save your recovery code before continuing — it is shown only once.</p>
        </div>
        <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/60 p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">Your recovery code</p>
          <p className="mt-2 font-mono text-xl font-black tracking-wider text-stone-900">{recoveryCode}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
            If you ever forget your password, reset it at <span className="font-semibold">/recover</span> using this code.
            Write it down or save it somewhere safe — it cannot be shown again.
          </p>
          <button
            type="button"
            className="btn-secondary mt-3 text-xs"
            onClick={() => {
              navigator.clipboard?.writeText(recoveryCode).then(() => setCopied(true)).catch(() => undefined);
            }}
          >
            {copied ? "Copied ✓" : "Copy code"}
          </button>
        </div>
        <button
          type="button"
          className="btn-primary w-full py-3"
          onClick={() => {
            router.push("/admin");
            router.refresh();
          }}
        >
          I have saved it — continue to dashboard
        </button>
      </div>
    );
  }

  return <SignUpForm mode="root" busy={loading} error={error} onSubmit={handleSubmit} submitLabel="Sign up as root admin" />;
}
