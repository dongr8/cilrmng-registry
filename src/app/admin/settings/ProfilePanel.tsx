"use client";

import { useCallback, useEffect, useState } from "react";

type Profile = { id: number; name: string; email: string; altEmail: string; role: string };

export default function ProfilePanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [altEmail, setAltEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/profile", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { profile?: Profile };
      if (data.profile) {
        setProfile(data.profile);
        setAltEmail(data.profile.altEmail ?? "");
      }
    } catch {
      /* offline */
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

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; profile?: Profile };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not save");
      if (data.profile) {
        setProfile(data.profile);
        setAltEmail(data.profile.altEmail ?? "");
      }
      return true;
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not save" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveAlt() {
    if (await act("set-alt-email", { email: altEmail })) {
      setMessage({ tone: "ok", text: `You can now sign in with ${altEmail.trim().toLowerCase()} as well.` });
    }
  }

  async function removeAlt() {
    if (await act("remove-alt-email")) setMessage({ tone: "ok", text: "Alternate email removed." });
  }

  async function swap() {
    if (await act("swap-emails")) setMessage({ tone: "ok", text: "Primary and alternate emails swapped." });
  }

  async function changePassword() {
    if (passwords.next !== passwords.confirm) {
      setMessage({ tone: "error", text: "New passwords do not match" });
      return;
    }
    if (await act("change-password", { currentPassword: passwords.current, newPassword: passwords.next })) {
      setPasswords({ current: "", next: "", confirm: "" });
      setMessage({ tone: "ok", text: "Password updated." });
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p
          className={`rounded-xl px-4 py-2.5 text-xs font-medium ${
            message.tone === "ok" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-rose-100 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <h3 className="text-base font-bold text-stone-900">Your sign-in emails</h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            Use <strong>either</strong> address with the same password — a personal one (Gmail, Yahoo, Outlook) and an office one. No provider is
            required.
          </p>

          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f1e7df] bg-[#fffdfb] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Primary email</p>
                <p className="truncate text-sm font-semibold text-stone-800">{profile?.email ?? "—"}</p>
              </div>
              <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">Sign-in ✓</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f1e7df] bg-[#fffdfb] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Alternate email</p>
                <p className="truncate text-sm font-semibold text-stone-800">{profile?.altEmail || "Not set"}</p>
              </div>
              {profile?.altEmail ? (
                <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">Sign-in ✓</span>
              ) : (
                <span className="badge bg-stone-100 text-stone-500 ring-stone-200">Optional</span>
              )}
            </div>
          </div>

          <label className="label mt-4" htmlFor="alt-email">
            Add / update alternate email
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="alt-email"
              type="email"
              className="input"
              value={altEmail}
              onChange={(event) => setAltEmail(event.target.value)}
              placeholder="you@office.org or you@gmail.com"
            />
            <button type="button" className="btn-primary sm:w-auto" onClick={saveAlt} disabled={busy || !altEmail.trim()}>
              Save
            </button>
          </div>

          {profile?.altEmail ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={swap} disabled={busy}>
                Make alternate the primary
              </button>
              <button type="button" className="btn-ghost text-xs" onClick={removeAlt} disabled={busy}>
                Remove alternate
              </button>
            </div>
          ) : null}
        </div>

        <div className="card card-pad">
          <h3 className="text-base font-bold text-stone-900">Change your password</h3>
          <p className="mt-1 text-xs text-stone-600">The same password works for both of your sign-in emails.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="pw-current">
                Current password
              </label>
              <input
                id="pw-current"
                type="password"
                className="input"
                value={passwords.current}
                onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pw-next">
                  New password
                </label>
                <input
                  id="pw-next"
                  type="password"
                  className="input"
                  value={passwords.next}
                  onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="label" htmlFor="pw-confirm">
                  Confirm
                </label>
                <input
                  id="pw-confirm"
                  type="password"
                  className="input"
                  value={passwords.confirm}
                  onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={changePassword}
              disabled={busy || passwords.next.length < 8 || !passwords.current}
            >
              Update password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
