"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Snapshot = {
  id: number;
  label: string;
  kind: string;
  rowCount: number;
  sizeBytes: number;
  checksum: string;
  location: string;
  createdByName: string | null;
  createdAt: string;
};

type BackupsResponse = {
  ok: boolean;
  error?: string;
  count: number;
  bytes: number;
  latestAt: string | null;
  recent: Snapshot[];
  engine: { autoBackup: boolean; backupFrequency: string; lastAutoBackupAt: string | null; storage: string };
};

const nf = new Intl.NumberFormat("en-US");

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function BackupsClient({ role }: { role: string }) {
  const [data, setData] = useState<BackupsResponse | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Snapshot | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/backups", { cache: "no-store" });
      const payload = (await response.json()) as BackupsResponse;
      if (payload.ok) setData(payload);
    } catch {
      setMessage({ tone: "error", text: "Cannot reach the vault right now. Snapshots remain stored on the server." });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  async function createSnapshot() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", label }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; backup?: Snapshot };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Snapshot failed");
      setLabel("");
      setMessage({ tone: "ok", text: `Snapshot stored in the vault · ${nf.format(payload.backup?.rowCount ?? 0)} rows · ${formatBytes(payload.backup?.sizeBytes ?? 0)}` });
      load();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Snapshot failed" });
    } finally {
      setBusy(false);
    }
  }

  async function restore(snapshot: Snapshot) {
    setConfirmRestore(null);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", id: snapshot.id }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; restored?: number };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Restore failed");
      setMessage({ tone: "ok", text: `Register restored from “${snapshot.label}” · ${nf.format(payload.restored ?? 0)} rows.` });
      load();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Restore failed" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(snapshot: Snapshot) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: snapshot.id }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Delete failed");
      setMessage({ tone: "ok", text: "Snapshot removed from the vault." });
      load();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Delete failed" });
    } finally {
      setBusy(false);
    }
  }

  const vaultCapacity = 512 * 1024 * 1024;
  const usedPct = data ? Math.min(100, Math.round((data.bytes / vaultCapacity) * 100)) : 0;

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Persistence</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-900">Vault & backups</h2>
          <p className="mt-1 text-sm text-stone-500">Checksummed snapshots · portable CSV/JSON copies · restore in one click</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/records/export" className="btn-secondary text-xs sm:text-sm">Download live register (CSV)</a>
          <button type="button" className="btn-primary text-xs sm:text-sm" onClick={createSnapshot} disabled={busy}>
            {busy ? "Working…" : "Create snapshot"}
          </button>
        </div>
      </div>

      {message ? (
        <p className={`rounded-xl px-4 py-2.5 text-xs font-medium ${message.tone === "ok" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-rose-100 bg-rose-50 text-rose-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          { label: "Snapshots stored", value: data ? nf.format(data.count) : "—", hint: "Retained in the encrypted vault" },
          { label: "Vault size", value: data ? formatBytes(data.bytes) : "—", hint: "Deduplicated snapshot payloads" },
          { label: "Latest snapshot", value: data?.latestAt ? new Date(data.latestAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "None", hint: data?.engine.lastAutoBackupAt ? `Auto · ${data.engine.backupFrequency}` : "Manual only" },
          { label: "Auto-backup", value: data?.engine.autoBackup ? "On" : "Off", hint: data?.engine.backupFrequency ? `${data.engine.backupFrequency} schedule` : "Configure in settings" },
        ].map((card) => (
          <div key={card.label} className="card card-pad">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{card.label}</p>
            <p className="mt-1.5 text-xl font-black tracking-tight text-stone-900 sm:text-2xl">{card.value}</p>
            <p className="mt-1 text-xs text-stone-500">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">Create a manual snapshot</h3>
              <p className="text-xs text-stone-500">Captures every record plus the register settings with a SHA-256 checksum.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Optional label — e.g. Before annual renewals" />
            <button type="button" className="btn-primary sm:w-40" onClick={createSnapshot} disabled={busy}>Store snapshot</button>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-3 text-[11px] leading-relaxed text-brand-900">
            <strong className="font-semibold">SanDisk / external drive mirror:</strong> download the live register or any snapshot as CSV/JSON and copy it to your
            external drive or NAS. Files are portable and reopen in Excel, Google Sheets or this registry. Snapshots can also be restored server-side in one click.
          </div>
        </div>

        <div className="rounded-2xl bg-stone-900 p-5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">Storage</p>
          <h3 className="mt-1 text-base font-bold">Encrypted vault</h3>
          <div className="mt-4 flex items-end justify-between text-xs text-stone-300">
            <span>{data ? formatBytes(data.bytes) : "—"} used</span>
            <span>512 MB quota</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, usedPct)}%` }} />
          </div>
          <ul className="mt-4 space-y-2 text-[11px] text-stone-300">
            <li>• Snapshots persist independently of browser storage.</li>
            <li>• Root can restore or delete; any admin can create.</li>
            <li>• Guest records stay read-only throughout.</li>
          </ul>
          <Link href="/admin/settings" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">
            Backup settings
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#f1e7df] bg-[#fffdfb] px-4 py-3">
          <h3 className="text-sm font-bold text-stone-900">Snapshot history</h3>
          <span className="text-[11px] text-stone-500">{data?.engine.storage ?? "Encrypted vault"}</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr><th className="th">Snapshot</th><th className="th">Rows</th><th className="th">Size</th><th className="th">Checksum</th><th className="th">Created</th><th className="th text-right">Actions</th></tr>
            </thead>
            <tbody>
              {(data?.recent ?? []).map((snapshot) => (
                <tr key={snapshot.id} className="border-t border-stone-100">
                  <td className="td">
                    <span className="block font-semibold text-stone-800">{snapshot.label}</span>
                    <span className="text-[11px] uppercase tracking-wide text-stone-400">{snapshot.kind} · {snapshot.location}</span>
                  </td>
                  <td className="td">{nf.format(snapshot.rowCount)}</td>
                  <td className="td">{formatBytes(snapshot.sizeBytes)}</td>
                  <td className="td font-mono text-[10px] text-stone-500">{snapshot.checksum.slice(0, 12)}…</td>
                  <td className="td text-xs">{new Date(snapshot.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    <span className="block text-[10px] text-stone-400">{snapshot.createdByName ?? "system"}</span>
                  </td>
                  <td className="td text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1">
                      <a href={`/api/admin/backups/${snapshot.id}/download?format=csv`} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100">CSV</a>
                      <a href={`/api/admin/backups/${snapshot.id}/download?format=json`} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100">JSON</a>
                      {role === "root" ? (
                        <>
                          <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100" onClick={() => setConfirmRestore(snapshot)}>Restore</button>
                          <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50" onClick={() => remove(snapshot)}>Delete</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {data && data.recent.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">No snapshots yet — create your first vault snapshot.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {confirmRestore ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Restore this snapshot?</h3>
            <p className="mt-1 text-sm text-stone-600">
              “{confirmRestore.label}” will replace all current member records with {nf.format(confirmRestore.rowCount)} snapshot rows. Create a fresh snapshot first if you are unsure.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmRestore(null)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" onClick={() => restore(confirmRestore)} disabled={busy}>Restore register</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
