import type { ReactNode } from "react";
import ConnectionBadge from "@/components/ConnectionBadge";
import OnlineCounter from "@/components/OnlineCounter";
import Watermark from "@/components/Watermark";
import type { ShellSettings } from "@/components/PublicShell";

/**
 * Bare shell for the Guest Portal: no app menus, no bottom tab bar, no
 * admin sign-in — guests only see the institute brand and the register.
 */
export default function PortalShell({ settings, children }: { settings: ShellSettings; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Watermark logoUrl={settings.logoUrl} />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-[#f1e7df] bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-100 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logoUrl} alt={`${settings.orgName} crest`} className="h-full w-full object-contain" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight text-stone-900">{settings.shortName}</span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">Membership Database</span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <OnlineCounter heartbeatAsGuest compact />
              <ConnectionBadge className="hidden sm:inline-flex" />
            </div>
          </div>
        </header>
        <main className="mesh flex-1">{children}</main>
        <footer className="no-print border-t border-[#f1e7df] bg-white px-4 py-4 text-center text-[11px] text-stone-400">
          © {new Date().getFullYear()} {settings.orgName} · Read-only guest access · {settings.supportEmail}
        </footer>
      </div>
    </div>
  );
}
