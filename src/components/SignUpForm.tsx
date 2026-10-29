"use client";

import { useState } from "react";

export type SignUpValues = {
  name: string;
  email: string;
  phone: string;
  position: string;
  password: string;
  confirm: string;
  role: "admin" | "root";
};

/**
 * One sign-up form, used twice:
 *  - /setup       → the one-time root admin registration
 *  - Settings     → an administrator registering another administrator
 */
export default function SignUpForm({
  mode,
  canGrantRoot = false,
  busy = false,
  error = "",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  mode: "root" | "admin";
  canGrantRoot?: boolean;
  busy?: boolean;
  error?: string;
  submitLabel?: string;
  onSubmit: (values: SignUpValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<SignUpValues>({
    name: "",
    email: "",
    phone: "",
    position: "",
    password: "",
    confirm: "",
    role: "admin",
  });
  const [localError, setLocalError] = useState("");
  const [show, setShow] = useState(false);

  const set =
    (key: keyof SignUpValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    if (form.name.trim().length < 2) {
      setLocalError("Enter the full name");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      setLocalError("Enter a valid email address");
      return;
    }
    if (form.phone.replace(/\D/g, "").length < 7) {
      setLocalError("Enter a valid phone number");
      return;
    }
    if (form.position.trim().length < 2) {
      setLocalError("Enter the position / title");
      return;
    }
    if (form.password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirm) {
      setLocalError("Passwords do not match");
      return;
    }
    void onSubmit({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), position: form.position.trim() });
  }

  const shown = error || localError;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="su-name">
            Full name
          </label>
          <input id="su-name" className="input" value={form.name} onChange={set("name")} placeholder="Dr. Harriet Akubuiro" required />
        </div>
        <div>
          <label className="label" htmlFor="su-email">
            Email address
          </label>
          <input
            id="su-email"
            type="email"
            autoComplete="email"
            className="input"
            value={form.email}
            onChange={set("email")}
            placeholder="you@gmail.com or you@office.org"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="su-phone">
            Phone number
          </label>
          <input
            id="su-phone"
            type="tel"
            autoComplete="tel"
            className="input"
            value={form.phone}
            onChange={set("phone")}
            placeholder="08031234567"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="su-position">
            Position
          </label>
          <input
            id="su-position"
            className="input"
            value={form.position}
            onChange={set("position")}
            placeholder={mode === "root" ? "Registrar / Director" : "Membership Officer"}
            list="position-suggestions"
            required
          />
          <datalist id="position-suggestions">
            {["Registrar", "Director", "President", "Secretary General", "Membership Officer", "Records Officer", "Chapter Coordinator", "IT Administrator"].map(
              (option) => (
                <option key={option} value={option} />
              ),
            )}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="su-password">
            Password
          </label>
          <div className="relative">
            <input
              id="su-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className="input pr-16"
              value={form.password}
              onChange={set("password")}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-500 hover:bg-stone-100"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="su-confirm">
            Confirm password
          </label>
          <input
            id="su-confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className="input"
            value={form.confirm}
            onChange={set("confirm")}
            required
            minLength={8}
          />
        </div>
      </div>

      {mode === "admin" && canGrantRoot ? (
        <div>
          <label className="label" htmlFor="su-role">
            Role
          </label>
          <select id="su-role" className="input" value={form.role} onChange={set("role")}>
            <option value="admin">Administrator</option>
            <option value="root">Root admin</option>
          </select>
        </div>
      ) : null}

      {shown ? <p className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">{shown}</p> : null}

      <div className="flex flex-wrap gap-2">
        {onCancel ? (
          <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn-primary flex-1 py-3" disabled={busy}>
          {busy ? "Creating account…" : submitLabel ?? (mode === "root" ? "Create root admin account" : "Create administrator account")}
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-stone-400">
        One email per account — personal (Gmail, Yahoo, Outlook) or office. {mode === "root"
          ? "This one-time registration creates the permanent root admin, which can never be removed."
          : "Administrators can add or remove other administrators, but never the root admin."}
      </p>
    </form>
  );
}
