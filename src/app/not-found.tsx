import Link from "next/link";
import Brand from "@/components/Brand";

export default function NotFound() {
  return (
    <div className="mesh flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="card card-pad w-full max-w-lg text-center">
          <p className="text-5xl font-black tracking-tight text-brand-600">404</p>
          <h1 className="mt-2 text-xl font-bold text-stone-900">That page isn&apos;t in the registry</h1>
          <p className="mt-2 text-sm text-stone-600">The link may be outdated. Try the guest lookup or sign in to the admin dashboard.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/" className="btn-primary">Home</Link>
            <Link href="/guest" className="btn-secondary">Records</Link>
            <Link href="/login" className="btn-ghost">Admin sign in</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
