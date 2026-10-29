"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushQueue, queueSize } from "@/lib/offline-client";
import ConnectionBadge from "@/components/ConnectionBadge";
import Watermark from "@/components/Watermark";
import MobileTabBar from "@/components/MobileTabBar";
import OnlineCounter from "@/components/OnlineCounter";
import { ADMIN_NAV, isActive } from "@/components/nav-items";

type AdminInfo = { id: number; name: string; email: string; role: string };
type PresenceAdmin = { id: number; name: string; email: string; role: string; isSelf?: boolean };
type PresenceResponse = { ok?: boolean; count?: number; admins?: PresenceAdmin[] };

const NAV = ADMIN_NAV;

const SUB_NAV: Record<string, { href: string; label: string }[]> = {
  "/admin/import": [
    { href: "/admin/import", label: "Upload file / paste" },
    { href: "/admin/backups", label: "Vault & backups" },
  ],
};

export default function AdminShell({
  admin,
  org,
  children,
}: {
  admin: AdminInfo;
  org: { name: string; logoUrl: string; shortName: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [presence, setPresence] = useState<PresenceResponse>({ count: 0, admins: [] });
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [online, setOnline] = useState(true);
  const mounted = useRef(false);

  const refreshQueue = useCallback(() => {
    queueSize().then(setPending).catch(() => undefined);
  }, []);

  const doFlush = useCallback(
    async (announce: boolean) => {
      if (!navigator.onLine) return;
      const size = await queueSize();
      if (!size) {
        if (announce) setSyncMessage("Everything is already in sync.");
        return;
      }
      setSyncing(true);
      try {
        const result = await flushQueue();
        refreshQueue();
        if (announce || result.synced) {
          setSyncMessage(
            result.remaining
              ? `${result.synced} change(s) synced · ${result.remaining} still queued`
              : `${result.synced} offline change(s) synced to the register`,
          );
        }
        if (result.synced) router.refresh();
      } catch {
        setSyncMessage("Sync paused — the register is unreachable. Changes stay queued on this device.");
      } finally {
        setSyncing(false);
      }
    },
    [refreshQueue, router],
  );

  const loadPresence = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/presence", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as PresenceResponse;
      setPresence({ count: data.count ?? 0, admins: data.admins ?? [] });
    } catch {
      /* offline — keep last known presence */
    }
  }, []);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    loadPresence();
    refreshQueue();
    doFlush(false);
    const heartbeat = setInterval(() => {
      if (navigator.onLine) loadPresence();
    }, 25000);
    const onOnline = () => {
      setOnline(true);
      loadPresence();
      doFlush(false);
    };
    const onOffline = () => setOnline(false);
    const onQueue = () => refreshQueue();
    setOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("meridian:queue-changed", onQueue);
    const queuePoll = setInterval(() => {
      queueSize()
        .then((size) => {
          setPending(size);
          if (size && navigator.onLine) doFlush(false);
        })
        .catch(() => undefined);
    }, 45000);
    return () => {
      clearInterval(heartbeat);
      clearInterval(queuePoll);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("meridian:queue-changed", onQueue);
    };
  }, [doFlush, loadPresence, refreshQueue]);

  useEffect(() => {
    if (!syncMessage) return;
    const timer = setTimeout(() => setSyncMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [syncMessage]);

  const initials = admin.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen bg-[#fdfbf9]">
      <Watermark logoUrl={org.logoUrl} />
      {mobileOpen ? <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-stone-900/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[268px] shrink-0 flex-col border-r border-[#f1e7df] bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#f6eee7] px-4 py-4">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={org.logoUrl} alt={`${org.name} logo`} className="h-10 w-10 rounded-xl border border-brand-100 bg-white object-contain" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight text-stone-900">{org.shortName}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">Membership registry</span>
            </span>
          </Link>
          <button className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">✕</button>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Workspace</p>
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active = isActive(item, pathname);
              const subs = SUB_NAV[item.href] ?? [];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      active ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20" : "text-stone-600 hover:bg-brand-50 hover:text-brand-700"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/admin/import" && pending > 0 ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{pending}</span>
                    ) : null}
                  </Link>
                  {active && subs.length ? (
                    <ul className="mt-1 space-y-0.5 border-l border-[#f1e7df] pl-3">
                      {subs.map((sub) => (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            onClick={() => setMobileOpen(false)}
                            className={`block rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                              pathname === sub.href ? "bg-brand-50 text-brand-700" : "text-stone-500 hover:bg-stone-50 hover:text-brand-700"
                            }`}
                          >
                            {sub.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-6 px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Shortcuts</p>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/guest" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-stone-600 hover:bg-brand-50 hover:text-brand-700">
                <span className="text-base">👤</span> Guest portal
              </Link>
            </li>
            <li>
              <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-stone-600 hover:bg-brand-50 hover:text-brand-700">
                <span className="text-base">🏠</span> Public home
              </Link>
            </li>
            <li>
              <a href="/api/admin/records/export" className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-stone-600 hover:bg-brand-50 hover:text-brand-700">
                <span className="text-base">⬇️</span> Export register
              </a>
            </li>
          </ul>

          <div className="mt-6 rounded-2xl border border-[#f1e7df] bg-[#fffdfb] p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Team online</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                {presence.count ?? 0}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(presence.admins ?? []).slice(0, 4).map((person) => (
                <span key={person.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-stone-600 ring-1 ring-[#f1e7df]" title={person.email}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-[8px] font-bold text-brand-700">
                    {person.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}
                  </span>
                  {person.name.split(" ")[0]}
                </span>
              ))}
              {(presence.count ?? 0) === 0 ? <span className="text-[11px] text-stone-400">Reconnecting…</span> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => doFlush(true)}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#f1e7df] px-3 py-2.5 text-xs font-semibold text-stone-600 transition hover:border-brand-200 hover:text-brand-700"
          >
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 12a8 8 0 0114-5m2 3a8 8 0 01-14 5M4 5v4h4m12 10v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sync now
            </span>
            <span className="text-[10px] text-stone-400">{syncing ? "…" : pending > 0 ? `${pending} queued` : "Up to date"}</span>
          </button>
        </nav>

        <div className="border-t border-[#f6eee7] p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{initials || "AD"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-900">{admin.name}</p>
              <p className="truncate text-[11px] uppercase tracking-wide text-brand-600">{admin.role === "root" ? "Root admin" : "Administrator"}</p>
            </div>
          </div>
          <button type="button" onClick={signOut} className="mt-1 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-stone-500 hover:bg-rose-50 hover:text-rose-600">
            Sign out
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {!online ? (
          <div className="no-print bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white">
            Offline mode · you can still search saved records, capture changes and queue imports. Everything syncs automatically when the network returns.
          </div>
        ) : null}
        {syncMessage ? (
          <div className="no-print border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-center text-xs font-medium text-emerald-700">{syncMessage}</div>
        ) : null}
        <header className="app-header sticky top-0 z-20 border-b border-[#f1e7df] bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button className="shrink-0 rounded-lg border border-[#f1e7df] p-2 text-stone-500 hover:bg-brand-50 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
              </button>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600">{admin.role === "root" ? "Root workspace" : "Administrator workspace"}</p>
                <h1 className="truncate text-sm font-bold text-stone-900 sm:text-base">{NAV.find((item) => isActive(item, pathname))?.label ?? "Membership registry"}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ConnectionBadge className="hidden md:inline-flex" />
              <OnlineCounter compact className="hidden sm:inline-flex" />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  className="flex items-center gap-2 rounded-full border border-[#f1e7df] bg-white py-1 pl-1 pr-3 text-xs font-semibold text-stone-700 hover:border-brand-200"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{initials || "AD"}</span>
                  <span className="hidden max-w-[120px] truncate sm:block">{admin.name}</span>
                  <span className="text-stone-400">▾</span>
                </button>
                {profileOpen ? (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[#f1e7df] bg-white p-2 shadow-lg">
                    <div className="px-2 py-1.5">
                      <p className="truncate text-sm font-semibold text-stone-900">{admin.name}</p>
                      <p className="truncate text-[11px] text-stone-500">{admin.email}</p>
                      <span className="badge mt-1 bg-brand-50 text-brand-700 ring-brand-200">{admin.role === "root" ? "Root admin" : "Admin"}</span>
                    </div>
                    <Link href="/admin/settings" onClick={() => setProfileOpen(false)} className="mt-1 block rounded-lg px-2 py-2 text-xs font-semibold text-stone-600 hover:bg-brand-50">Settings</Link>
                    <button type="button" onClick={signOut} className="mt-1 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50">Sign out</button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-3 py-4 pb-24 sm:px-6 sm:py-7 lg:pb-7 print-full">{children}</main>
      </div>

      <MobileTabBar items={NAV} badges={{ "/admin/import": pending }} />
    </div>
  );
}
