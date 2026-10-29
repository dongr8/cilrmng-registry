import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Brand from "@/components/Brand";
import ConnectionBadge from "@/components/ConnectionBadge";
import LoginForm from "./LoginForm";
import { DEFAULT_SETTINGS, getSettings, rootExists } from "@/lib/auth";

export const metadata: Metadata = { title: "Administrator sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let settings = { ...DEFAULT_SETTINGS };
  let hasRoot = true;
  try {
    settings = await getSettings();
    hasRoot = await rootExists();
  } catch {
    hasRoot = false;
  }
  if (!hasRoot) redirect("/setup");

  return (
    <div className="mesh flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="min-w-0 flex-1"><Brand name={settings.orgName} logoUrl={settings.logoUrl} /></div>
        <div className="flex items-center gap-3">
          <ConnectionBadge />
          <Link href="/guest" className="hidden text-xs font-semibold text-brand-700 hover:underline sm:block">Guest lookup</Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-[#f1e7df] bg-white shadow-[0_30px_80px_-50px_rgba(154,52,18,0.5)] lg:grid-cols-2">
          <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-600 to-brand-800 p-8 text-white lg:flex">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 10%, white 0, transparent 45%)" }} aria-hidden />
            <div className="relative">
              <span className="badge bg-white/15 text-white ring-white/30">Administrator access</span>
              <h1 className="mt-5 text-3xl font-black leading-tight">Run the register with confidence.</h1>
              <p className="mt-3 text-sm leading-relaxed text-brand-50/90">
                Import Excel or CSV registers, manage 100,000 members, send guest record links, monitor who is online and keep encrypted vault backups.
              </p>
            </div>
            <ul className="relative mt-8 space-y-2.5 text-sm text-brand-50">
              {["Sign in with personal or office email", "Online presence across the team", "Offline capture with automatic sync", "Checksummed vault snapshots"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="relative mt-8 text-[11px] text-brand-100/80">Root admin controls team access from Settings → Administrators.</p>
          </div>
          <div className="min-w-0 p-5 sm:p-9">
            <div className="lg:hidden">
              <Brand name={settings.orgName} logoUrl={settings.logoUrl} />
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-tight text-stone-900 lg:mt-0">Welcome back</h2>
            <p className="mt-1 text-sm text-stone-500">Sign in to the membership dashboard.</p>
            <div className="mt-6">
              <LoginForm />
            </div>
            <p className="mt-5 text-center text-[11px] leading-relaxed text-stone-400">
              Guest? <Link href="/guest" className="link">View your record instead</Link> — no sign-in required.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
