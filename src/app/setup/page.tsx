import type { Metadata } from "next";
import Link from "next/link";
import Brand from "@/components/Brand";
import SetupForm from "./SetupForm";
import { DEFAULT_SETTINGS, getSettings, rootExists } from "@/lib/auth";

export const metadata: Metadata = { title: "Claim root admin" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  let settings = { ...DEFAULT_SETTINGS };
  let hasRoot = false;
  try {
    settings = await getSettings();
    hasRoot = await rootExists();
  } catch {
    hasRoot = false;
  }

  return (
    <div className="mesh min-h-screen">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand name={settings.orgName} logoUrl={settings.logoUrl} />
        <Link href="/login" className="text-xs font-semibold text-brand-700 hover:underline">Administrator sign in</Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-7 text-white sm:px-8">
            <span className="badge bg-white/15 text-white ring-white/30">One-time sign-up</span>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              {hasRoot ? "Root sign-up already completed" : "Root admin sign-up"}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-50/90">
              {hasRoot
                ? "The root administrator already exists. Sign in to manage the register, or ask an administrator to register you from Settings → Administrators."
                : "Sign up once to create the permanent root administrator. Use any email — personal or office, one per account. Root can then register other administrators using this same form."}
            </p>
          </div>
          <div className="p-6 sm:p-8">
            {hasRoot ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Root sign-up is a one-time action and has already been completed. New administrators are registered from Settings → Administrators.
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/login" className="btn-primary">Sign in as administrator</Link>
                  <Link href="/guest" className="btn-secondary">Guest lookup</Link>
                </div>
              </div>
            ) : (
              <SetupForm />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
