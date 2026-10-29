"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Brand from "@/components/Brand";
import ConnectionBadge from "@/components/ConnectionBadge";
import OnlineCounter from "@/components/OnlineCounter";
import { PUBLIC_NAV, isActive } from "@/components/nav-items";

export default function PublicHeader({ orgName, logoUrl }: { orgName: string; logoUrl: string }) {
  const pathname = usePathname();

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#f1e7df] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="min-w-0 flex-1 lg:flex-none"><Brand name={orgName} logoUrl={logoUrl} size="sm" /></div>

        {/* Desktop / tablet menu */}
        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {PUBLIC_NAV.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-50 hover:text-brand-700"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <OnlineCounter compact className="hidden md:inline-flex" />
          <ConnectionBadge className="hidden lg:inline-flex" />
          <Link href="/login" className="btn-primary px-3 py-2 text-xs sm:px-3.5 sm:text-sm">
            <span className="hidden sm:inline">Admin sign in</span>
            <span className="sm:hidden">Sign in</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
