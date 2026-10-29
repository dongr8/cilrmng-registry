"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cacheGet, cacheSet, requestPersistentStorage, storageEstimate } from "@/lib/offline-client";

type OfflineIndex = { records: unknown[]; savedAt: string; total: number };

const nf = new Intl.NumberFormat("en-US");

export default function SyncClient({ orgName }: { orgName: string }) {
  const [index, setIndex] = useState<OfflineIndex | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [installable, setInstallable] = useState(false);
  const [storage, setStorage] = useState({ usage: 0, quota: 0, persisted: false });

  const refresh = useCallback(() => {
    cacheGet<OfflineIndex>("guest:offline-index").then((value) => setIndex(value ?? null));
    cacheGet<Record<string, unknown>>("guest:saved").then((value) => setSavedCount(Object.keys(value ?? {}).length));
  }, []);

  useEffect(() => {
    refresh();
    const update = () => setOnline(navigator.onLine);
    update();
    setInstallable(!window.matchMedia("(display-mode: standalone)").matches);
    storageEstimate().then(setStorage);
    // Auto-refresh the saved copy on every visit while online, so every device
    // converges on the same data and then keeps working without internet.
    if (navigator.onLine) void autoRefresh();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [refresh]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  async function autoRefresh() {
    try {
      const existing = await cacheGet<OfflineIndex>("guest:offline-index");
      if (!existing) return;
      await syncNow(true);
    } catch {
      /* keep the saved copy */
    }
  }

  async function makePersistent() {
    const granted = await requestPersistentStorage();
    setStorage(await storageEstimate());
    setMessage(
      granted
        ? { tone: "ok", text: "This device will now keep the registry permanently — it survives restarts and low-storage cleanups." }
        : { tone: "error", text: "The browser declined permanent storage. Install the app to the home screen and try again." },
    );
  }

  async function syncNow(silent = false) {
    if (!silent) {
      setSyncing(true);
      setProgress(0);
    }
    try {
      const collected: unknown[] = [];
      let offset = 0;
      let total = 0;
      for (;;) {
        const response = await fetch(`/api/guest/offline-index?offset=${offset}&limit=2000`, { cache: "no-store" });
        if (!response.ok) throw new Error("unreachable");
        const data = (await response.json()) as { records?: unknown[]; total?: number; hasMore?: boolean };
        total = data.total ?? 0;
        collected.push(...(data.records ?? []));
        if (!silent) setProgress(total ? Math.min(99, Math.round((collected.length / total) * 100)) : 50);
        if (!data.hasMore) break;
        offset += data.records?.length ?? 0;
      }
      const next: OfflineIndex = { records: collected, savedAt: new Date().toISOString(), total };
      await cacheSet("guest:offline-index", next);
      setIndex(next);
      setStorage(await storageEstimate());
      if (!silent) {
        setProgress(100);
        setMessage({ tone: "ok", text: `${nf.format(collected.length)} records saved on this device.` });
      }
    } catch {
      if (!silent) setMessage({ tone: "error", text: "Could not reach the register. Connect to the internet and try again." });
    } finally {
      if (!silent) setSyncing(false);
    }
  }

  async function clearOffline() {
    await cacheSet("guest:offline-index", null);
    setIndex(null);
    setMessage({ tone: "ok", text: "Offline register copy removed from this device." });
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-7 sm:px-6 sm:py-10">
      <div className="max-w-2xl">
        <span className="eyebrow">Sync / Upload</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">Work online or offline</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Save the {orgName} register to this device so you can search and open records without a network. Administrators upload Excel and CSV files
          from the admin workspace.
        </p>
      </div>

      {message ? (
        <p
          className={`mt-4 rounded-xl px-4 py-2.5 text-xs font-medium ${
            message.tone === "ok" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-rose-100 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-stone-900">Offline register copy</h2>
            <span
              className={`badge ${online ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
              {online ? "Online" : "Offline"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#f1e7df] bg-[#fffdfb] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Records on this device</p>
              <p className="mt-1 text-2xl font-black text-brand-700">{index ? nf.format(index.records.length) : "0"}</p>
              <p className="text-[11px] text-stone-500">
                {index ? `Synced ${new Date(index.savedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : "Not saved yet"}
              </p>
            </div>
            <div className="rounded-xl border border-[#f1e7df] bg-[#fffdfb] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Records you opened</p>
              <p className="mt-1 text-2xl font-black text-stone-800">{nf.format(savedCount)}</p>
              <p className="text-[11px] text-stone-500">Viewable, printable and downloadable offline</p>
            </div>
          </div>

          {syncing || progress ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.max(3, progress)}%` }} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={() => syncNow()} disabled={syncing || !online}>
              {syncing ? `Syncing… ${progress}%` : index ? "Re-sync register" : "Save register offline"}
            </button>
            <Link href="/guest" className="btn-secondary text-sm">
              Search records
            </Link>
            {index ? (
              <button type="button" className="btn-ghost text-sm" onClick={clearOffline}>
                Clear offline copy
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card card-pad">
            <h2 className="text-base font-bold text-stone-900">Upload a register</h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Excel (.xlsx/.xls), CSV and clipboard uploads are handled by approved administrators. Your sheet&apos;s columns — NAME, Registration
              Number, Certificate Collected, Year of Reg, Contact Address, Tel. No and E-mail — map automatically.
            </p>
            <Link href="/login" className="btn-secondary mt-3 w-full text-sm">
              Sign in to upload
            </Link>
          </div>

          <div className="card card-pad">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-stone-900">Device storage</h2>
              <span className={`badge ${storage.persisted ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
                {storage.persisted ? "Permanent" : "Best-effort"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              {storage.persisted
                ? "This device keeps the registry permanently — it survives refreshes, restarts and low-storage cleanups until you remove it."
                : "Grant permanent storage so the browser never clears your saved records when space runs low."}
            </p>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-[#fffdfb] px-3 py-2 text-[11px] ring-1 ring-[#f1e7df]">
              <span className="text-stone-500">Used on this device</span>
              <span className="font-semibold text-stone-800">
                {(storage.usage / 1024 / 1024).toFixed(1)} MB{storage.quota ? ` of ${(storage.quota / 1024 / 1024).toFixed(0)} MB` : ""}
              </span>
            </div>
            {!storage.persisted ? (
              <button type="button" className="btn-secondary mt-3 w-full text-xs" onClick={makePersistent}>
                Keep data permanently on this device
              </button>
            ) : null}
          </div>

          {installable ? (
            <div className="rounded-2xl bg-stone-900 p-5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">Install the app</p>
              <p className="mt-2 text-xs leading-relaxed text-stone-300">
                Add this registry to your home screen for full-screen, offline access on Android, iPhone, Windows and macOS.
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-stone-400">
                <li>• Android / Chrome: menu ⋮ → “Install app”</li>
                <li>• iPhone / Safari: Share → “Add to Home Screen”</li>
                <li>• Desktop: install icon in the address bar</li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
