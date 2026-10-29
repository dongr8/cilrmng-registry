import Link from "next/link";
import Brand from "@/components/Brand";
import ConnectionBadge from "@/components/ConnectionBadge";

export const metadata = { title: "Offline mode" };

export default function OfflinePage() {
  return (
    <div className="mesh flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        <ConnectionBadge />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="card card-pad w-full max-w-lg text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 12a8 8 0 0114-5m2 3a8 8 0 01-14 5M4 5v4h4m12 10v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-stone-900">You&apos;re offline</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            This page needs the registry server. Pages you visited before are cached on this device, and admin changes are queued until the
            network returns.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/" className="btn-primary">Home</Link>
            <Link href="/guest" className="btn-secondary">Records</Link>
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-stone-400">
            Records you verified in the guest portal stay readable offline. Administrator sessions resume automatically once the connection is restored.
          </p>
        </div>
      </main>
    </div>
  );
}
