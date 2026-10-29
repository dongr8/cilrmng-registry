"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FILE_FIELD_KEYS, MEMBER_FIELDS, MEMBER_STATUSES, MEMBER_CATEGORIES, NIL, display, enrichRecord, fullNameOf, matchesQuery, splitName, type MemberRecord } from "@/lib/member-schema";
import { cacheGet, cacheSet, queueOperation } from "@/lib/offline-client";
import SearchAutocomplete, { type Suggestion } from "@/components/SearchAutocomplete";

type MemberRow = {
  id: number;
  memberId: string;
  name: string;
  firstName: string;
  secondName: string;
  thirdName: string;
  fullName: string;
  email: string;
  phone: string;
  contactAddress: string;
  certificateCollected: string;
  yearOfReg: string;
  grade: string;
  category: string;
  status: string;
  region: string;
  updatedAt: string;
  data: MemberRecord;
};

type ListResponse = {
  ok: boolean;
  error?: string;
  records: MemberRow[];
  total: number;
  page: number;
  pageSize: number;
  facets?: { categories: string[]; statuses: string[]; regions: string[] };
};

const emptyRecord = (): MemberRecord =>
  MEMBER_FIELDS.reduce((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {} as MemberRecord);

const statusTone = (status: string) => {
  switch (status.toLowerCase()) {
    case "active": return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "pending": return "bg-amber-50 text-amber-700 ring-amber-200";
    case "expired": return "bg-rose-50 text-rose-700 ring-rose-200";
    default: return "bg-stone-100 text-stone-600 ring-stone-200";
  }
};

const nf = new Intl.NumberFormat("en-US");

export default function RecordsClient({ role, adminName }: { role: string; adminName: string }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<{ categories: string[]; statuses: string[]; regions: string[] }>({ categories: [], statuses: [], regions: [] });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; row?: MemberRow; record: MemberRecord } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MemberRow | null>(null);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [offlineRows, setOfflineRows] = useState<MemberRow[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q: debounced, status, category, region, sort, page: String(page), pageSize: String(pageSize) });
    try {
      const response = await fetch(`/api/admin/records?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as ListResponse;
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to load records");
      setRows(data.records);
      setTotal(data.total);
      setOffline(false);
      if (data.facets) setFacets(data.facets);
      await cacheSet("records:list", data);
    } catch {
      const cached = await cacheGet<ListResponse>("records:list");
      const pack = await cacheGet<{ records: MemberRow[]; savedAt: string }>("records:offline");
      if (pack?.records?.length) {
        const filtered = pack.records
          .filter((row) => matchesQuery({ ...row.data, memberId: row.memberId }, debounced))
          .filter((row) => (status ? row.status === status : true))
          .filter((row) => (category ? row.category === category : true))
          .filter((row) => (region ? row.region === region : true));
        setRows(filtered.slice((page - 1) * pageSize, page * pageSize));
        setTotal(filtered.length);
        setOffline(true);
      } else if (cached) {
        const filtered = cached.records.filter((row) => matchesQuery(row.data, debounced)).filter((row) => (status ? row.status === status : true));
        setRows(filtered);
        setTotal(filtered.length);
        setFacets(cached.facets ?? facets);
      }
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [debounced, status, category, region, sort, page, pageSize, facets]);

  useEffect(() => {
    if (focusedId) return; // a picked suggestion pins one record until cleared
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, status, category, region, sort, page, pageSize, focusedId]);

  useEffect(() => {
    cacheGet<{ records: MemberRow[] }>("records:offline").then((pack) => setOfflineRows(pack?.records ?? []));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const offlineSuggest = useCallback(
    (needle: string): Suggestion[] => {
      const tokens = needle.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
      const digits = needle.replace(/\D/g, "");
      if (!tokens.length) return [];
      return offlineRows
        .filter((row) => {
          const hay = `${row.name} ${row.memberId} ${row.email} ${row.phone} ${row.contactAddress} ${row.region}`.toLowerCase();
          if (tokens.every((token) => hay.includes(token))) return true;
          return digits.length >= 3 && hay.replace(/\D/g, "").includes(digits);
        })
        .slice(0, 8)
        .map((row) => ({
          id: row.id,
          memberId: row.memberId,
          name: fullNameOf(row.data, row.fullName),
          grade: row.grade,
          status: row.status,
          region: row.region,
          yearOfReg: row.yearOfReg,
          email: row.email,
          phone: row.phone,
        }));
    },
    [offlineRows],
  );

  async function pickSuggestion(suggestion: Suggestion) {
    // Choosing a suggestion narrows the table to that one matched record.
    setFocusedId(suggestion.id);
    setPage(1);
    try {
      const response = await fetch(`/api/admin/records/${suggestion.id}`, { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; record?: MemberRow };
      if (data.ok && data.record) {
        setRows([data.record]);
        setTotal(1);
        setLoading(false);
        return;
      }
    } catch {
      const local = offlineRows.find((row) => row.id === suggestion.id);
      if (local) {
        setRows([local]);
        setTotal(1);
        setLoading(false);
        return;
      }
    }
    setQuery(suggestion.memberId);
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ q: debounced, status, category, region });
    return `/api/admin/records/export?${params.toString()}`;
  }, [debounced, status, category, region]);

  function openCreate() {
    setEditor({ mode: "create", record: emptyRecord() });
  }

  function openEdit(row: MemberRow) {
    const record = { ...emptyRecord(), ...row.data, memberId: row.memberId };
    setEditor({ mode: "edit", row, record });
  }

  async function saveRecord() {
    if (!editor) return;
    const record = enrichRecord({ ...editor.record });
    if (!record.name?.trim() && !record.firstName?.trim() && !record.thirdName?.trim()) {
      setToast({ tone: "error", text: "Enter a name (or first/third name) before saving." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(editor.mode === "create" ? "/api/admin/records" : `/api/admin/records/${editor.row!.id}`, {
        method: editor.mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; record?: MemberRow };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      setToast({ tone: "ok", text: `${record.memberId || record.name} saved to the register.` });
      setEditor(null);
      window.dispatchEvent(new Event("meridian:records-changed"));
      load();
    } catch (err) {
      if (!navigator.onLine || (err instanceof Error && err.message === "Failed to fetch")) {
        if (editor.mode === "create") {
          await queueOperation({ kind: "create", record, queuedAt: new Date().toISOString() });
          setToast({ tone: "warn", text: "Offline — new member saved on this device and queued for sync." });
          setEditor(null);
        } else {
          await queueOperation({ kind: "update", recordId: editor.row!.id, record, queuedAt: new Date().toISOString() });
          setRows((current) => current.map((row) => (row.id === editor.row!.id ? { ...row, data: record, memberId: record.memberId || row.memberId, fullName: fullNameOf(record), status: record.status || row.status } : row)));
          setToast({ tone: "warn", text: "Offline — changes saved on this device and queued for sync." });
          setEditor(null);
        }
      } else {
        setToast({ tone: "error", text: err instanceof Error ? err.message : "Save failed" });
      }
    } finally {
      setSaving(false);
    }
  }

  /** One click: create a permanent guest link for this record and copy it. */
  async function shareLink(row: MemberRow) {
    try {
      const response = await fetch("/api/admin/guest-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: row.id }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; link?: { url: string } };
      if (!response.ok || !data.ok || !data.link) throw new Error(data.error ?? "Could not create the link");
      const url = `${window.location.origin}${data.link.url}`;
      try {
        await navigator.clipboard.writeText(url);
        setToast({ tone: "ok", text: `Guest link for ${row.memberId} copied — paste it into WhatsApp, SMS or email.` });
      } catch {
        setToast({ tone: "ok", text: `Guest link created: ${url}` });
      }
    } catch (err) {
      setToast({
        tone: "error",
        text: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Go online to generate a guest link.",
      });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const row = pendingDelete;
    setPendingDelete(null);
    try {
      const response = await fetch(`/api/admin/records/${row.id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
      setToast({ tone: "ok", text: `${row.memberId} removed from the register.` });
      window.dispatchEvent(new Event("meridian:records-changed"));
      load();
    } catch (err) {
      if (!navigator.onLine || (err instanceof Error && err.message === "Failed to fetch")) {
        await queueOperation({ kind: "delete", recordId: row.id, queuedAt: new Date().toISOString() });
        setRows((current) => current.filter((item) => item.id !== row.id));
        setToast({ tone: "warn", text: "Offline — deletion queued; the record will be removed on sync." });
      } else {
        setToast({ tone: "error", text: err instanceof Error ? err.message : "Delete failed" });
      }
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Records menu</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-900">Membership directory</h2>
          <p className="mt-1 text-sm text-stone-500">
            {nf.format(total)} record{total === 1 ? "" : "s"} · signed in as {adminName} ({role === "root" ? "root admin" : "admin"})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={exportHref} className="btn-secondary text-xs sm:text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v4h16v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Export CSV
          </a>
          <Link href="/admin/import" className="btn-secondary text-xs sm:text-sm">Import file</Link>
          <button type="button" onClick={openCreate} className="btn-primary text-xs sm:text-sm">+ Add member</button>
        </div>
      </div>

      {focusedId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs text-brand-900">
          <span>Showing only the selected record. Clear to browse the full register again.</span>
          <button type="button" className="font-semibold underline" onClick={() => { setFocusedId(null); setQuery(""); load(); }}>
            Clear selection
          </button>
        </div>
      ) : null}

      {offline ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          Offline — showing the register copy saved on this device. Edits, deletions and additions are queued and sync automatically.
        </p>
      ) : null}
      {toast ? (
        <p className={`rounded-xl px-4 py-2.5 text-xs font-medium ${toast.tone === "ok" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : toast.tone === "warn" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-rose-100 bg-rose-50 text-rose-700"}`}>
          {toast.text}
        </p>
      ) : null}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#f1e7df] p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row">
            <SearchAutocomplete
              className="flex-1"
              value={query}
              onChange={(next) => { setQuery(next); setPage(1); setFocusedId(null); }}
              onPick={pickSuggestion}
              onSubmit={() => { setFocusedId(null); load(); }}
              offlineSource={offlineSuggest}
              endpoint="/api/admin/records/suggest"
              placeholder="Start typing a name, reg. number, phone, e-mail or address…"
              ariaLabel="Search member records"
            />
            <div className="grid grid-cols-2 gap-2 lg:flex">
              <select className="input lg:w-36" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                {(facets.statuses.length ? facets.statuses : [...MEMBER_STATUSES]).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="input lg:w-40" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
                <option value="">All grades</option>
                {(facets.categories.length ? facets.categories : [...MEMBER_CATEGORIES]).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="input lg:w-36" value={region} onChange={(event) => { setRegion(event.target.value); setPage(1); }}>
                <option value="">All regions</option>
                {facets.regions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="input lg:w-36" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="recent">Recently updated</option>
                <option value="name">Name A–Z</option>
                <option value="memberId">Reg. number</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
            <span>{loading ? "Loading register…" : `Showing ${rows.length ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, total)} of ${nf.format(total)}`}</span>
            <span className="flex items-center gap-2">
              Rows
              <select className="rounded-lg border border-[#e6d9ce] bg-white px-2 py-1 text-[11px]" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </span>
          </div>
        </div>

        <div className="hidden overflow-x-auto scroll-thin md:block">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead className="bg-[#fffdfb]">
              <tr>
                <th className="th">Name (First · Second · Third)</th>
                <th className="th">Reg. Number</th>
                <th className="th">Grade</th>
                <th className="th">Cert.</th>
                <th className="th">Year</th>
                <th className="th">Contact address</th>
                <th className="th">Tel / E-mail</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-stone-100 transition hover:bg-brand-50/40">
                  <td className="td">
                    <button type="button" onClick={() => openEdit(row)} className="text-left">
                      <span className="block font-semibold text-stone-900 hover:text-brand-700">{fullNameOf(row.data, row.fullName) || NIL}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-stone-400">{display(row.data.name)}</span>
                    </button>
                  </td>
                  <td className="td font-mono text-xs text-stone-600">{display(row.memberId)}</td>
                  <td className="td text-xs"><span className={`badge ${statusTone(row.status)}`}>{display(row.grade)}</span></td>
                  <td className="td text-xs">{display(row.certificateCollected)}</td>
                  <td className="td text-xs">{display(row.yearOfReg)}</td>
                  <td className="td text-xs"><span className="block max-w-[240px] truncate" title={row.contactAddress}>{display(row.contactAddress)}</span>
                    <span className="block text-[10px] text-stone-400">{display(row.region)}</span>
                  </td>
                  <td className="td text-xs">
                    <span className="block max-w-[190px] truncate">{display(row.phone)}</span>
                    <span className="block max-w-[190px] truncate text-[10px] text-stone-400">{display(row.email)}</span>
                  </td>
                  <td className="td text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => openEdit(row)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100">Edit</button>
                      <button type="button" onClick={() => shareLink(row)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">Link</button>
                      <a href={`/admin/records/${row.id}/print`} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100">Print</a>
                      <button type="button" onClick={() => setPendingDelete(row)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-stone-500">No records match these filters. Try clearing the search or import a file.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <ul className="divide-y divide-stone-100 md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="p-3">
              <button type="button" onClick={() => openEdit(row)} className="block w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-900">{fullNameOf(row.data, row.fullName) || NIL}</p>
                    <p className="truncate font-mono text-[11px] text-stone-500">{display(row.memberId)}</p>
                  </div>
                  <span className={`badge shrink-0 ${statusTone(row.status)}`}>{display(row.grade)}</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div className="col-span-2 min-w-0">
                    <dt className="text-stone-400">Address</dt>
                    <dd className="truncate text-stone-700">{display(row.contactAddress)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-stone-400">Tel</dt>
                    <dd className="truncate text-stone-700">{display(row.phone)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-stone-400">Year</dt>
                    <dd className="truncate text-stone-700">{display(row.yearOfReg)}</dd>
                  </div>
                </dl>
              </button>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => openEdit(row)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700">Edit</button>
                <button type="button" onClick={() => shareLink(row)} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">Link</button>
                <a href={`/admin/records/${row.id}/print`} target="_blank" rel="noreferrer" className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600">Print</a>
                <button type="button" onClick={() => setPendingDelete(row)} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600">Delete</button>
              </div>
            </li>
          ))}
          {!rows.length && !loading ? (
            <li className="px-4 py-10 text-center text-sm text-stone-500">No records match these filters.</li>
          ) : null}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f1e7df] bg-[#fffdfb] p-3 text-xs">
          <span className="text-stone-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
          </div>
        </div>
      </div>

      {editor ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-stone-900/40 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="flex max-h-screen w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[#f1e7df] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600">{editor.mode === "create" ? "New record" : "Edit record"}</p>
                <h3 className="text-lg font-bold text-stone-900">{editor.mode === "create" ? "Add a member" : `${editor.row?.memberId}`}</h3>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" onClick={() => setEditor(null)} aria-label="Close">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin px-4 py-4 sm:px-5">
              <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2 text-[11px] leading-relaxed text-brand-900">
                Editing the <strong>Name</strong> cell automatically refreshes First / Second / Third name. The original file value is kept in the
                Name field; blank fields display as <strong>Nil</strong>.
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[...MEMBER_FIELDS].sort((a, b) => {
                  const ai = FILE_FIELD_KEYS.indexOf(a.key);
                  const bi = FILE_FIELD_KEYS.indexOf(b.key);
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                }).map((field) => (
                  <div key={field.key}>
                    <label className="label" htmlFor={`field-${field.key}`}>
                      {field.label}
                      {field.key === "memberId" ? (role === "root" ? " (root editable)" : " (root admin only)") : ""}
                    </label>
                    {field.key === "status" ? (
                      <select id={`field-${field.key}`} className="input" value={editor.record[field.key] ?? ""} onChange={(event) => setEditor((current) => current ? { ...current, record: { ...current.record, [field.key]: event.target.value } } : current)}>
                        <option value="">Select status</option>
                        {MEMBER_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.key === "memberId" && role !== "root" ? (
                      <input id={`field-${field.key}`} className="input bg-stone-100 text-stone-500" value={editor.record[field.key] ?? ""} readOnly />
                    ) : field.key === "category" || field.key === "grade" ? (
                      <input id={`field-${field.key}`} list="category-options" className="input" value={editor.record[field.key] ?? ""} onChange={(event) => setEditor((current) => current ? { ...current, record: { ...current.record, [field.key]: event.target.value } } : current)} />
                    ) : (
                      <input
                        id={`field-${field.key}`}
                        className="input"
                        value={editor.record[field.key] ?? ""}
                        placeholder={field.sample}
                        onChange={(event) =>
                          setEditor((current) => {
                            if (!current) return current;
                            const value = event.target.value;
                            const next = { ...current.record, [field.key]: value };
                            if (field.key === "name") {
                              const parts = splitName(value);
                              next.firstName = parts.firstName;
                              next.secondName = parts.secondName;
                              next.thirdName = parts.thirdName;
                            }
                            if (["firstName", "secondName", "thirdName"].includes(field.key)) {
                              next.name = [next.firstName, next.secondName, next.thirdName].filter(Boolean).join(" ");
                            }
                            return { ...current, record: next };
                          })
                        }
                      />
                    )}
                  </div>
                ))}
                <datalist id="category-options">{MEMBER_CATEGORIES.map((option) => <option key={option} value={option} />)}</datalist>
              </div>
              <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[11px] text-brand-800">
                Preview: <strong>{display(editor.record.firstName)}</strong> · <strong>{display(editor.record.secondName)}</strong> · <strong>{display(editor.record.thirdName)}</strong>. All {MEMBER_FIELDS.length} fields are stored in the original import format. Membership / registration numbers can only be changed by the root admin — contact root if a number is wrong.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f1e7df] px-5 py-4">
              <span className="text-[11px] text-stone-400">Tip: paste a phone tail or email — guests verify with those.</span>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={saveRecord} disabled={saving}>{saving ? "Saving…" : "Save record"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Delete this record?</h3>
            <p className="mt-1 text-sm text-stone-600">{fullNameOf(pendingDelete.data, pendingDelete.fullName) || NIL} · {pendingDelete.memberId}. This is logged and cannot be undone from the app — restore from a vault snapshot if needed.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button type="button" className="btn-danger flex-1" onClick={confirmDelete}>Delete record</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
