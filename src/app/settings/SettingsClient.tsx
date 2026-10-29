"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/offline-client";
import { display } from "@/lib/member-schema";

type SavedRecord = { recordId: number; memberId: string; record: Record<string, string>; viewedAt: string };
type SavedRecords = Record<string, SavedRecord>;

export default function GuestSettingsClient({
  orgName,
  supportEmail,
  tagline,
}: {
  orgName: string;
  supportEmail: string;
  tagline: string;
}) {
  const [saved, setSaved] = useState<SavedRecords>({});
  const [offlineCount, setOfflineCount] = useState(0);
  const [message, setMessage] = useState("");
  const [standalone, setStandalone] = useState(false);

  const refresh = useCallback(() => {
    cacheGet<SavedRecords>("guest:saved").then((value) => setSaved(value ?? {}));
    cacheGet<{ records: unknown[] }>("guest:offline-index").then((value) => setOfflineCount(value?.records.length ?? 0));
  }, []);

  useEffect(() => {
    refresh();
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, [refresh]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  async function clearSaved() {
    await cacheSet("guest:saved", {});
    setSaved({});
    setMessage("Saved records cleared from this device.");
  }

  async function clearEverything() {
    await cacheSet("guest:saved", {});
    await cacheSet("guest:offline-index", null);
    await cacheSet("guest:last-search", null);
    setSaved({});
    setOfflineCount(0);
    setMessage("All registry data removed from this device.");
  }

  const savedList = Object.values(saved);

  return (
    <div className="mx-auto max-w-5xl px-3 py-7 sm:px-6 sm:py-10">
      <div className="max-w-2xl">
        <span className="eyebrow">Settings</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">Your device &amp; privacy</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          These settings apply to this device only. Registry configuration and member data are managed by approved administrators.
        </p>
      </div>

      {message ? <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700">{message}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <h2 className="text-base font-bold text-stone-900">Data saved on this device</h2>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-[#fffdfb] px-3 py-2 ring-1 ring-[#f1e7df]">
              <span className="text-stone-500">Offline register copy</span>
              <span className="font-semibold text-stone-800">{offlineCount ? `${offlineCount.toLocaleString()} records` : "Not saved"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#fffdfb] px-3 py-2 ring-1 ring-[#f1e7df]">
              <span className="text-stone-500">Records you opened</span>
              <span className="font-semibold text-stone-800">{savedList.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#fffdfb] px-3 py-2 ring-1 ring-[#f1e7df]">
              <span className="text-stone-500">Installed as app</span>
              <span className="font-semibold text-stone-800">{standalone ? "Yes" : "Running in browser"}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/sync" className="btn-secondary text-xs">
              Manage sync
            </Link>
            {savedList.length ? (
              <button type="button" className="btn-ghost text-xs" onClick={clearSaved}>
                Clear opened records
              </button>
            ) : null}
            <button type="button" className="btn-danger text-xs" onClick={clearEverything}>
              Remove all local data
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
            Clearing only affects this device. The register itself stays safely on the server and can be re-synced any time.
          </p>
        </div>

        <div className="card card-pad">
          <h2 className="text-base font-bold text-stone-900">Access &amp; permissions</h2>
          <div className="mt-3 space-y-2 text-xs">
            {[
              { label: "View records", value: "Allowed — no login" },
              { label: "Print / download", value: "Allowed (A4 certified copy)" },
              { label: "Edit or delete", value: "Administrators only" },
              { label: "Registration number", value: "Root admin only" },
              { label: "Upload files", value: "Administrators only" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg bg-[#fffdfb] px-3 py-2 ring-1 ring-[#f1e7df]">
                <span className="text-stone-500">{row.label}</span>
                <span className="text-right font-semibold text-stone-800">{row.value}</span>
              </div>
            ))}
          </div>
          <Link href="/login" className="btn-primary mt-4 w-full text-sm">
            Administrator sign in
          </Link>
        </div>
      </div>

      {savedList.length ? (
        <div className="mt-4 card card-pad">
          <h2 className="text-base font-bold text-stone-900">Records stored on this device</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {savedList.map((item) => (
              <li key={item.recordId} className="flex items-center justify-between gap-3 rounded-xl border border-[#f1e7df] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">{display(item.memberId)}</p>
                  <p className="truncate text-[11px] text-stone-500">
                    {[item.record.firstName, item.record.secondName, item.record.thirdName].filter(Boolean).join(" ")}
                  </p>
                </div>
                <Link href="/guest" className="btn-ghost shrink-0 text-xs">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl bg-stone-900 p-5 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">About</p>
        <p className="mt-2 text-sm font-semibold">{orgName}</p>
        <p className="text-xs text-stone-300">{tagline}</p>
        <a href={`mailto:${supportEmail}`} className="mt-2 inline-block break-all text-xs font-semibold text-brand-300 hover:underline">
          {supportEmail}
        </a>
      </div>
    </div>
  );
}
