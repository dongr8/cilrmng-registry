"use client";

import { useCallback, useEffect, useState } from "react";

type LinkRow = {
  id: number;
  token: string;
  url: string;
  memberId: string;
  memberName: string;
  note: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  general?: boolean;
  permanent?: boolean;
  status: "active" | "expired" | "revoked";
};

type SearchRow = { id: number; memberId: string; fullName: string; status: string; category: string };

export default function GuestLinksPanel({ adminEmail }: { adminEmail: string }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchRow[]>([]);
  const [selected, setSelected] = useState<SearchRow | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(null);
  const [copied, setCopied] = useState<string>("");
  const [lastLink, setLastLink] = useState<LinkRow | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/guest-links", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { links?: LinkRow[] };
      setLinks(data.links ?? []);
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

  useEffect(() => {
    if (query.trim().length < 3) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/records?q=${encodeURIComponent(query)}&pageSize=6`, { cache: "no-store" });
        const data = (await response.json()) as { records?: Array<{ id: number; memberId: string; fullName: string; status: string; category: string }> };
        setMatches(data.records ?? []);
      } catch {
        setMatches([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  function absoluteUrl(path: string) {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }

  /** Create a link instantly — member optional, no conditions at all. */
  async function createLink(member?: SearchRow) {
    const target = member ?? selected ?? null;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/guest-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: target?.id, note: note || undefined }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; link?: LinkRow };
      if (!response.ok || !data.ok || !data.link) throw new Error(data.error ?? "Could not create the link");
      setLinks((current) => [data.link!, ...current]);
      setLastLink(data.link);
      try {
        await navigator.clipboard.writeText(absoluteUrl(data.link.url));
        setMessage({ tone: "ok", text: "Link generated and copied — paste it anywhere, or use the WhatsApp button below." });
      } catch {
        setMessage({ tone: "ok", text: "Link generated. Use Copy or WhatsApp below to share it." });
      }
      setSelected(null);
      setQuery("");
      setNote("");
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not create the link" });
    } finally {
      setBusy(false);
    }
  }

  async function copy(path: string, id: string) {
    const url = absoluteUrl(path);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(""), 2500);
    } catch {
      setMessage({ tone: "warn", text: `Copy manually: ${url}` });
    }
  }

  async function revoke(row: LinkRow) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/guest-links/${row.id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Revoke failed");
      setMessage({ tone: "ok", text: `Link for ${row.memberName} revoked.` });
      load();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Revoke failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className={`rounded-xl px-4 py-2.5 text-xs font-medium ${message.tone === "ok" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : message.tone === "warn" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-rose-100 bg-rose-50 text-rose-700"}`}>{message.text}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card card-pad">
          <h3 className="text-base font-bold text-stone-900">Link options</h3>
          <p className="text-xs text-stone-500">Two kinds of reusable, permanent links — generate either in one click.</p>

          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
            <p className="text-xs font-bold text-stone-900">Option 1 · Guest Portal Link</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
              Opens the full Membership Database portal — guests can <strong>search, view, download and print</strong> any record. One link serves everyone.
            </p>
            <button type="button" className="btn-primary mt-2 w-full py-2.5 text-sm" onClick={() => createLink()} disabled={busy}>
              {busy ? "Generating…" : "⚡ Generate Guest Portal Link"}
            </button>
          </div>

          {lastLink ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                {lastLink.general ? "Guest Portal Link ready" : `Direct record link · ${lastLink.memberName}`}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-stone-700">{absoluteUrl(lastLink.url)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => copy(lastLink.url, "last")}>
                  {copied === "last" ? "Copied ✓" : "Copy link"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    lastLink.general
                      ? `CILRMNG Membership Database — search and view your record here: ${absoluteUrl(lastLink.url)}`
                      : `${lastLink.memberName} — your CILRMNG membership record: ${absoluteUrl(lastLink.url)}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: "#25D366" }}
                >
                  Send to WhatsApp
                </a>
                <a href={lastLink.url} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">Open</a>
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-xl border border-[#eadfd5] bg-[#fffdfb] p-3">
            <p className="text-xs font-bold text-stone-900">Option 2 · Direct record link</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
              Opens one member&apos;s certified A4 record only — ideal for sending a member their personal copy.
            </p>
            <label className="label mt-2">Find the member — picking one generates the link</label>
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a name — picking one generates that member’s record link" />
            {matches.length ? (
              <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-[#f1e7df]">
                {matches.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => { setSelected(row); setQuery(`${row.memberId} · ${row.fullName}`); setMatches([]); void createLink(row); }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-brand-50 ${selected?.id === row.id ? "bg-brand-50" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-stone-800">{row.fullName}</span>
                        <span className="block font-mono text-[10px] text-stone-500">{row.memberId}</span>
                      </span>
                      <span className="badge bg-stone-100 text-stone-600 ring-stone-200">{row.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected ? (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
                Selected: {selected.fullName} · {selected.memberId}
              </p>
            ) : null}
          </div>

          <div className="mt-3">
            <label className="label">Note for the guest (optional)</label>
            <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Your 2026 renewal is due in March." />
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
            Both options are <strong>reusable and multi-user</strong>: one link can be shared with your whole membership — hundreds of guests can open it at
            the same time, repeatedly, from any device. Every open always shows the latest data; updates you make here reach them instantly while
            online, or the moment their internet returns. Permanent until revoked.
          </p>
        </div>

        <div className="card card-pad">
          <h3 className="text-base font-bold text-stone-900">How to send it</h3>
          <ol className="mt-3 space-y-2 text-xs text-stone-600">
            <li><span className="font-semibold text-stone-800">1.</span> Press “Generate link now” — it is copied automatically.</li>
            <li><span className="font-semibold text-stone-800">2.</span> Send it by WhatsApp, SMS or email — the recipient only needs the link.</li>
            <li><span className="font-semibold text-stone-800">3.</span> One link serves everyone — forward it to a group; unlimited guests can use it simultaneously and repeatedly.</li>
            <li><span className="font-semibold text-stone-800">4.</span> Track views and expiry here; revoke at any time.</li>
          </ol>
          <div className="mt-4 rounded-xl bg-stone-900 p-3 text-[11px] leading-relaxed text-stone-300">
            Links are long random tokens. Never share a link in a public group — anyone holding it can view that one member&apos;s record until it expires or is revoked.
            <span className="mt-2 block text-stone-400">Signed in as {adminEmail}.</span>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#f1e7df] bg-[#fffdfb] px-4 py-3">
          <h3 className="text-sm font-bold text-stone-900">Guest links issued</h3>
          <span className="text-[11px] text-stone-500">{links.filter((row) => row.status === "active").length} active · {links.length} total</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[860px]">
            <thead><tr><th className="th">Member</th><th className="th">Link</th><th className="th">Issued by</th><th className="th">Validity</th><th className="th">Views</th><th className="th text-right">Actions</th></tr></thead>
            <tbody>
              {links.map((row) => (
                <tr key={row.id} className="border-t border-stone-100">
                  <td className="td">
                    <span className="block font-semibold text-stone-800">{row.general ? "Guest Portal Link" : row.memberName}</span>
                    <span className="font-mono text-[10px] text-stone-500">{row.general ? "search · view · download · print" : row.memberId}</span>
                  </td>
                  <td className="td text-xs">
                    <span className={`badge ${row.status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : row.status === "expired" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{row.status}</span>
                    <span className="mt-1 block font-mono text-[10px] text-stone-400">/r/{row.token.slice(0, 10)}…</span>
                  </td>
                  <td className="td text-xs text-stone-600">{row.createdByName}</td>
                  <td className="td text-xs text-stone-500">{row.permanent ? <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">Permanent</span> : new Date(row.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="td text-xs">{row.viewCount}</td>
                  <td className="td text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1">
                      <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100" onClick={() => copy(row.url, String(row.id))}>{copied === String(row.id) ? "Copied!" : "Copy"}</button>
                      <a href={row.url} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100">Open</a>
                      <a href={`https://wa.me/?text=${encodeURIComponent(row.general ? `CILRMNG Membership Database — search and view your record: ${absoluteUrl(row.url)}` : `${row.memberName} — your CILRMNG membership record: ${absoluteUrl(row.url)}`)}`} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">WhatsApp</a>
                      <a href={`mailto:?subject=Your CILRMNG membership record&body=${encodeURIComponent(`Hello ${row.memberName},\n\nYour membership record is available here: ${absoluteUrl(row.url)}\n\nThis link is read-only and expires on ${new Date(row.expiresAt).toLocaleDateString("en-GB")}.`)}`} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100">Email</a>
                      {row.status === "active" ? (
                        <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50" onClick={() => revoke(row)} disabled={busy}>Revoke</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!links.length ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">No guest links issued yet — create the first one above.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
