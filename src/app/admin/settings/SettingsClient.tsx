"use client";

import { useCallback, useEffect, useState } from "react";
import GuestLinksPanel from "./GuestLinksPanel";
import ProfilePanel from "./ProfilePanel";
import SignUpForm, { type SignUpValues } from "@/components/SignUpForm";
import { cacheGet, cacheSet } from "@/lib/offline-client";

type Settings = {
  orgName: string;
  feedbackEmail?: string;
  feedbackWhatsapp?: string;
  shortName: string;
  tagline: string;
  supportEmail: string;
  logoUrl: string;
  primaryColor: string;
  requireVerification: boolean;
  autoBackup: boolean;
  backupFrequency: string;
  lastAutoBackupAt: string | null;
};
type AuditRow = { id: number; actorName: string; action: string; detail: string; createdAt: string };
type AdminRow = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  role: string;
  status: string;
  online: boolean;
  isSelf: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const TABS = [
  { key: "profile", label: "My account" },
  { key: "organisation", label: "Organisation" },
  { key: "admins", label: "Administrators" },
  { key: "guestLinks", label: "Guest links" },
  { key: "guest", label: "Guest access" },
  { key: "offline", label: "Offline & sync" },
  { key: "activity", label: "Activity log" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsClient({
  initialSettings,
  initialAudit,
  role,
  admin,
}: {
  initialSettings: Settings;
  initialAudit: AuditRow[];
  role: string;
  admin: { name: string; email: string };
}) {
  const [tab, setTab] = useState<TabKey>("profile");
  const [form, setForm] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>(initialAudit);
  const [addError, setAddError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminRow | null>(null);
  const [offlineSaved, setOfflineSaved] = useState<{ count: number; savedAt: string } | null>(null);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState(0);
  const [resetPassword, setResetPassword] = useState("");
  const [emailTarget, setEmailTarget] = useState<AdminRow | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const isRoot = role === "root";

  const loadAdmins = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/admins", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { admins?: AdminRow[] };
      setAdmins(data.admins ?? []);
    } catch {
      /* offline */
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { audit?: AuditRow[]; settings?: Settings };
      if (data.audit) setAudit(data.audit);
      if (data.settings) setForm(data.settings);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    loadAdmins();
    cacheGet<{ records: unknown[]; savedAt: string }>("records:offline").then((pack) =>
      setOfflineSaved(pack ? { count: pack.records.length, savedAt: pack.savedAt } : null),
    );
    const timer = setInterval(loadAdmins, 30000);
    return () => clearInterval(timer);
  }, [loadAdmins]);

  async function downloadOfflinePack() {
    setSyncingOffline(true);
    setOfflineProgress(0);
    try {
      const collected: unknown[] = [];
      let offset = 0;
      let total = 0;
      for (;;) {
        const response = await fetch(`/api/admin/records/offline-pack?offset=${offset}&limit=1000`, { cache: "no-store" });
        if (!response.ok) throw new Error("Sync interrupted");
        const data = (await response.json()) as { records?: unknown[]; total?: number; hasMore?: boolean };
        total = data.total ?? 0;
        collected.push(...(data.records ?? []));
        setOfflineProgress(total ? Math.min(99, Math.round((collected.length / total) * 100)) : 50);
        if (!data.hasMore) break;
        offset += data.records?.length ?? 0;
      }
      const savedAt = new Date().toISOString();
      await cacheSet("records:offline", { records: collected, savedAt });
      setOfflineSaved({ count: collected.length, savedAt });
      setOfflineProgress(100);
      setToast({ tone: "ok", text: `${collected.length.toLocaleString()} records saved on this device for offline work.` });
    } catch {
      setToast({ tone: "error", text: "Could not finish the offline download. Check your connection and retry." });
    } finally {
      setSyncingOffline(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function saveSettings() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; settings?: Settings };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to save settings");
      if (data.settings) setForm(data.settings);
      setToast({ tone: "ok", text: "Registry settings saved." });
      loadAudit();
    } catch (err) {
      setToast({ tone: "error", text: err instanceof Error ? err.message : "Unable to save settings" });
    } finally {
      setSaving(false);
    }
  }

  async function addAdmin(values: SignUpValues) {
    setSaving(true);
    setAddError("");
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, email: values.email, phone: values.phone, position: values.position, password: values.password, role: values.role }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to add admin");
      setToast({ tone: "ok", text: `${values.name} can now sign in as ${values.role === "root" ? "root admin" : "administrator"}.` });
      setShowAdd(false);
      loadAdmins();
      loadAudit();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Unable to add admin");
    } finally {
      setSaving(false);
    }
  }

  async function adminAction(target: AdminRow, action: string, payload?: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/admins/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Action failed");
      setToast({ tone: "ok", text: "Administrator updated." });
      setResetTarget(null);
      setResetPassword("");
      loadAdmins();
      loadAudit();
    } catch (err) {
      setToast({ tone: "error", text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setSaving(false);
    }
  }

  async function removeAdmin(target: AdminRow) {
    if (!window.confirm(`Remove ${target.name} (${target.email})? Their sessions end immediately.`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/admins/${target.id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
      setToast({ tone: "ok", text: "Administrator removed." });
      loadAdmins();
      loadAudit();
    } catch (err) {
      setToast({ tone: "error", text: err instanceof Error ? err.message : "Delete failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Configuration</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-900">Settings</h2>
        <p className="mt-1 text-sm text-stone-500">
          Signed in as <span className="font-semibold text-stone-700">{admin.name}</span> · {isRoot ? "root admin — full control" : "administrator — read-only configuration"}
        </p>
      </div>

      {toast ? (
        <p className={`rounded-xl px-4 py-2.5 text-xs font-medium ${toast.tone === "ok" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-rose-100 bg-rose-50 text-rose-700"}`}>{toast.text}</p>
      ) : null}

      <div className="-mx-3 flex gap-1 overflow-x-auto scroll-thin px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:rounded-xl sm:border sm:border-[#f1e7df] sm:bg-white sm:px-1 sm:pb-1 sm:pt-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg border border-[#f1e7df] px-3 py-2 text-xs font-semibold transition sm:flex-1 sm:border-0 sm:text-sm ${tab === item.key ? "bg-brand-600 text-white" : "bg-white text-stone-600 hover:bg-brand-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "profile" ? <ProfilePanel /> : null}

      {tab === "organisation" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="card card-pad">
            <h3 className="text-base font-bold text-stone-900">Institute identity</h3>
            <p className="text-xs text-stone-500">Shown on the public site, guest records and printed member extracts.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label">Institute name</label><input className="input" value={form.orgName} disabled={!isRoot} onChange={(event) => setForm({ ...form, orgName: event.target.value })} /></div>
              <div><label className="label">Short name</label><input className="input" value={form.shortName} disabled={!isRoot} onChange={(event) => setForm({ ...form, shortName: event.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">Tagline</label><input className="input" value={form.tagline} disabled={!isRoot} onChange={(event) => setForm({ ...form, tagline: event.target.value })} /></div>
              <div><label className="label">Registry support email</label><input className="input" value={form.supportEmail} disabled={!isRoot} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} /></div>
              <div><label className="label">Feedback email (guest form)</label><input className="input" type="email" value={form.feedbackEmail ?? ""} disabled={!isRoot} onChange={(event) => setForm({ ...form, feedbackEmail: event.target.value })} placeholder="feedback@cilrmng.org" /></div>
              <div><label className="label">Feedback WhatsApp number</label><input className="input" value={form.feedbackWhatsapp ?? ""} disabled={!isRoot} onChange={(event) => setForm({ ...form, feedbackWhatsapp: event.target.value })} placeholder="2348031234567" /></div>
              <div><label className="label">Logo path</label><input className="input" value={form.logoUrl} disabled={!isRoot} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} /></div>
              <div>
                <label className="label">Brand colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-10 w-14 cursor-pointer rounded-lg border border-[#e6d9ce] bg-white p-1" value={form.primaryColor} disabled={!isRoot} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} />
                  <input className="input" value={form.primaryColor} disabled={!isRoot} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} />
                </div>
              </div>
              <div className="flex items-end">
                <div className="flex w-full items-center justify-between rounded-xl border border-[#f1e7df] bg-[#fffdfb] px-3 py-2.5">
                  <span className="text-xs font-semibold text-stone-600">Automatic vault snapshots</span>
                  <button
                    type="button"
                    disabled={!isRoot}
                    onClick={() => setForm({ ...form, autoBackup: !form.autoBackup })}
                    className={`relative h-6 w-11 rounded-full transition ${form.autoBackup ? "bg-brand-600" : "bg-stone-300"}`}
                    aria-pressed={form.autoBackup}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${form.autoBackup ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Snapshot frequency</label>
                <select className="input" value={form.backupFrequency} disabled={!isRoot} onChange={(event) => setForm({ ...form, backupFrequency: event.target.value })}>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className="label">Guest access</label>
                <div className="flex items-center justify-between rounded-xl border border-[#f1e7df] bg-[#fffdfb] px-3 py-2.5">
                  <span className="text-xs text-stone-600">Open directory · view, print &amp; download</span>
                  <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">Read-only</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-stone-500">Last automatic snapshot: {form.lastAutoBackupAt ? new Date(form.lastAutoBackupAt).toLocaleString("en-GB") : "not yet"}</p>
              <button type="button" className="btn-primary" onClick={saveSettings} disabled={!isRoot || saving}>{saving ? "Saving…" : "Save settings"}</button>
            </div>
            {!isRoot ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">Only the root admin can change registry settings.</p> : null}
          </div>

          <div className="space-y-4">
            <div className="card card-pad">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Brand preview</p>
              <div className="mt-3 rounded-xl border border-[#f1e7df] bg-gradient-to-br from-brand-50 to-white p-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoUrl} alt="Institute logo" className="h-12 w-12 rounded-full border border-brand-100 bg-white object-contain" />
                  <div><p className="text-sm font-bold text-stone-900">{form.orgName}</p><p className="text-[11px] uppercase tracking-wide text-brand-600">{form.tagline}</p></div>
                </div>
                <div className="mt-3 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${form.primaryColor}, #fb923c)` }} />
              </div>
              <p className="mt-3 text-[11px] text-stone-500">Drop your official institute logo into <code className="rounded bg-stone-100 px-1">public/images/</code> and set the path here. The orange/white palette is used across every screen and print view.</p>
            </div>
            <div className="card card-pad">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Registry capabilities</p>
              <ul className="mt-2 space-y-1.5 text-xs text-stone-600">
                <li>• 100,000 member rows · 20 columns</li>
                <li>• Excel, CSV and paste imports</li>
                <li>• Read-only guest lookup + print</li>
                <li>• Offline capture with queued sync</li>
                <li>• Root-controlled admin team</li>
                <li>• Checksummed vault snapshots</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "admins" ? (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1e7df] bg-[#fffdfb] px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Administrators</h3>
                <p className="text-[11px] text-stone-500">{admins.filter((row) => row.online).length} online right now · {admins.length} total accounts</p>
              </div>
              <button type="button" className="btn-primary text-xs" onClick={() => { setShowAdd((value) => !value); setAddError(""); }}>
                {showAdd ? "Close" : "+ Add administrator"}
              </button>
            </div>

            {showAdd ? (
              <div className="border-b border-[#f1e7df] bg-brand-50/40 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-700">Register a new administrator</p>
                <SignUpForm
                  mode="admin"
                  canGrantRoot={isRoot}
                  busy={saving}
                  error={addError}
                  onCancel={() => { setShowAdd(false); setAddError(""); }}
                  onSubmit={addAdmin}
                />
              </div>
            ) : null}

            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[780px]">
                <thead><tr><th className="th">Administrator</th><th className="th">Role</th><th className="th">Presence</th><th className="th">Last sign-in</th><th className="th text-right">Manage</th></tr></thead>
                <tbody>
                  {admins.map((row) => (
                    <tr key={row.id} className="border-t border-stone-100">
                      <td className="td">
                        <span className="block font-semibold text-stone-800">{row.name} {row.isSelf ? <span className="text-[10px] font-medium text-brand-600">(you)</span> : null}</span>
                        <span className="block text-[11px] text-stone-500">{row.email}</span>
                        {row.position ? <span className="block text-[11px] text-brand-600">{row.position}{row.phone ? ` · ${row.phone}` : ""}</span> : null}
                      </td>
                      <td className="td">
                        <span className={`badge ${row.role === "root" ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-stone-100 text-stone-600 ring-stone-200"}`}>{row.role === "root" ? "Root admin" : "Administrator"}</span>
                        {row.status !== "active" ? <span className="ml-1 badge bg-rose-50 text-rose-700 ring-rose-200">suspended</span> : null}
                      </td>
                      <td className="td text-xs">
                        {row.online ? <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />online</span> : <span className="text-stone-400">offline</span>}
                      </td>
                      <td className="td text-xs text-stone-500">{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"}</td>
                      <td className="td text-right">
                        {row.role === "root" && !isRoot ? (
                          <span className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">Root · protected</span>
                        ) : row.role === "root" ? (
                          <div className="inline-flex flex-wrap justify-end gap-1">
                            <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100" onClick={() => { setResetTarget(row); setResetPassword(""); }}>Password</button>
                            <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100" onClick={() => { setEmailTarget(row); setNewEmail(row.email); }}>Email</button>
                            <span className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">Permanent</span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-wrap justify-end gap-1">
                            <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100" onClick={() => { setResetTarget(row); setResetPassword(""); }}>Password</button>
                            <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100" onClick={() => { setEmailTarget(row); setNewEmail(row.email); }}>Email</button>
                            {isRoot ? (
                              <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100" onClick={() => adminAction(row, "make-root")} disabled={row.isSelf}>Make root</button>
                            ) : null}
                            <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50" onClick={() => adminAction(row, row.status === "active" ? "suspend" : "activate")} disabled={row.isSelf}>{row.status === "active" ? "Suspend" : "Activate"}</button>
                            <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50" onClick={() => removeAdmin(row)} disabled={row.isSelf}>Remove</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3 text-[11px] leading-relaxed text-brand-900">
            <strong>Who can do what:</strong> every approved administrator can register, suspend or remove another administrator, and can edit or delete member records.
            The <strong>root admin is permanent</strong> — it can never be removed, suspended or demoted by anyone, and only root can grant root access or change a
            registration / membership number. One email per account. Passwords use scrypt hashing with per-account salts; suspending an admin ends their sessions immediately.
          </div>
        </div>
      ) : null}

      {tab === "guestLinks" ? <GuestLinksPanel adminEmail={admin.email} /> : null}

      {tab === "offline" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card card-pad">
            <h3 className="text-base font-bold text-stone-900">This device&apos;s offline copy</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Download the register to this laptop, tablet or phone so you can search, capture and queue changes without a connection. Imports stay
              queued and replay automatically when the network returns.
            </p>
            <div className="mt-4 rounded-xl border border-[#f1e7df] bg-[#fffdfb] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-700">Records on this device</span>
                <span className="font-bold text-brand-700">{offlineSaved ? offlineSaved.count.toLocaleString() : "none yet"}</span>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                {offlineSaved ? `Last synced ${new Date(offlineSaved.savedAt).toLocaleString("en-GB")}` : "No offline register downloaded yet."}
              </p>
              {syncingOffline || offlineProgress ? (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.max(2, offlineProgress)}%` }} />
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-xs" onClick={downloadOfflinePack} disabled={syncingOffline}>
                {syncingOffline ? `Downloading… ${offlineProgress}%` : "Download register for offline"}
              </button>
              <a href="/admin/records" className="btn-secondary text-xs">Browse records offline</a>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
              For the full app offline, install it from your browser menu (“Add to Home screen” / “Install app”). The app shell, guest portal and
              previously opened records then open without a connection on Android, iOS, Windows and macOS.
            </p>
          </div>
          <div className="card card-pad">
            <h3 className="text-base font-bold text-stone-900">Offline behaviour</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-stone-600">
              <li><strong className="text-stone-800">Guest:</strong> can save the complete register for offline search; opened records stay readable and print in A4.</li>
              <li><strong className="text-stone-800">Admin:</strong> edits, new members and deletions persist in the device queue and sync automatically.</li>
              <li><strong className="text-stone-800">Imports:</strong> parsed locally, queued when offline and replayed on reconnect.</li>
              <li><strong className="text-stone-800">Conflicts:</strong> the register keeps the newest write; imports use your chosen duplicate strategy.</li>
              <li><strong className="text-stone-800">Presence:</strong> online teammate count updates every 25 seconds while connected.</li>
            </ul>
            <div className="mt-4 rounded-xl bg-stone-900 p-3 text-[11px] leading-relaxed text-stone-300">
              “Without being hosted” caveat: a browser app still needs the register server online for first load and syncing. Once installed and
              synced, each device keeps working offline; shared data syncs back when the server is reachable on your network or the internet.
            </div>
          </div>
        </div>
      ) : null}

      {tab === "guest" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card card-pad">
            <h3 className="text-base font-bold text-stone-900">Read-only guest portal</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Guests search the whole register by registration number, first, second or third name, address, e-mail or phone. Results are masked until they verify with any name on record plus the phone tail, DOB, email or national ID.
              one of: last four phone digits, the full phone number, e-mail address or registration number.
            </p>
            <div className="mt-4 space-y-2 text-xs">
              {[
                { label: "Record editing", value: "Blocked for guests" },
                { label: "View record", value: "Open — no code required" },
                { label: "Download & print", value: "Enabled (CSV / A4 PDF)" },
                { label: "Rate limiting", value: "120 record views / min" },
                { label: "Offline access", value: "Register copy + opened records" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg bg-[#fffdfb] px-3 py-2 ring-1 ring-[#f1e7df]">
                  <span className="text-stone-500">{row.label}</span>
                  <span className="font-semibold text-stone-800">{row.value}</span>
                </div>
              ))}
            </div>
            <a href="/guest" target="_blank" className="btn-secondary mt-4 text-xs">Open guest portal ↗</a>
          </div>
          <div className="card card-pad">
            <h3 className="text-base font-bold text-stone-900">Offline & sync policy</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-stone-600">
              <li><strong className="text-stone-800">App shell:</strong> cached by a service worker so the portal opens without a network.</li>
              <li><strong className="text-stone-800">Admin edits:</strong> stored in IndexedDB and replayed automatically when the connection returns.</li>
              <li><strong className="text-stone-800">File imports:</strong> parsed on-device; if the network drops, the batch is queued and resumes on sync.</li>
              <li><strong className="text-stone-800">Guest records:</strong> opened records are cached locally so members can present them offline.</li>
              <li><strong className="text-stone-800">Presence:</strong> heartbeat every 25s; the team list shows who is online in the last 90s.</li>
            </ul>
            <div className="mt-4 rounded-xl bg-stone-900 p-3 text-[11px] text-stone-300">
              Clearing browser data removes only the device cache — the register and vault remain on the server and can be re-synced.
            </div>
          </div>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#f1e7df] bg-[#fffdfb] px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Audit trail</h3>
              <p className="text-[11px] text-stone-400">Entries are kept for 30 days, then deleted automatically.</p>
            </div>
            <button type="button" className="text-[11px] font-semibold text-brand-700 hover:underline" onClick={loadAudit}>Refresh</button>
          </div>
          <ul className="divide-y divide-stone-100">
            {audit.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-800">{row.action}</p>
                  <p className="truncate text-xs text-stone-500">{row.detail || "—"}</p>
                </div>
                <div className="text-right text-[11px] text-stone-400">
                  <p className="font-semibold text-stone-600">{row.actorName}</p>
                  <p>{new Date(row.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </li>
            ))}
            {audit.length === 0 ? <li className="px-4 py-8 text-center text-sm text-stone-500">No activity logged yet.</li> : null}
          </ul>
        </div>
      ) : null}

      {emailTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Change login email</h3>
            <p className="mt-1 text-xs text-stone-500">{emailTarget.name} · currently {emailTarget.email}</p>
            <input
              className="input mt-3"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="you@gmail.com"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
              Any personal email works — Gmail, Yahoo, Outlook or an institute address. Use this to take over the root account with your own email.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setEmailTarget(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={saving || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)}
                onClick={() => adminAction(emailTarget, "change-email", { email: newEmail }).then(() => setEmailTarget(null))}
              >
                Save email
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Reset password</h3>
            <p className="mt-1 text-xs text-stone-500">{resetTarget.name} · {resetTarget.email}</p>
            <input className="input mt-3" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="New password (min. 8 characters)" />
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setResetTarget(null)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" disabled={resetPassword.length < 8 || saving} onClick={() => adminAction(resetTarget, "reset-password", { password: resetPassword })}>Reset password</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
