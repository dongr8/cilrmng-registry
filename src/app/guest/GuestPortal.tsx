"use client";

import { useCallback, useEffect, useState } from "react";
import { display } from "@/lib/member-schema";
import { cacheGet, cacheSet } from "@/lib/offline-client";
import RecordSheet from "@/components/RecordSheet";
import PrintButton from "@/components/PrintButton";
import DownloadRecordButton from "@/components/DownloadRecordButton";
import DatabaseTotal, { type RegisterTotals } from "@/components/DatabaseTotal";
import OnlineCounter from "@/components/OnlineCounter";
import FeedbackForm from "@/components/FeedbackForm";
import SearchAutocomplete, { type Suggestion } from "@/components/SearchAutocomplete";

type GuestResult = {
  id: number;
  memberId: string;
  name: string;
  firstName?: string;
  secondName?: string;
  thirdName?: string;
  grade?: string;
  category: string;
  status: string;
  region: string;
  yearOfReg?: string;
  certificateCollected?: string;
  email: string;
  phone: string;
  contactAddress?: string;
  searchText?: string;
};

type OpenRecord = {
  recordId: number;
  memberId: string;
  record: Record<string, string>;
  viewedAt: string;
};

type SavedRecords = Record<string, OpenRecord>;
type OfflineIndex = { records: GuestResult[]; savedAt: string; total: number };

type SearchResponse = {
  ok: boolean;
  error?: string;
  totalMatches?: number;
  results?: GuestResult[];
};

type Org = { orgName: string; shortName: string; tagline: string; logoUrl: string; supportEmail: string; feedbackEmail: string; feedbackWhatsapp: string };

const statusTone = (status: string) => {
  switch (status.toLowerCase()) {
    case "active": return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "pending": return "bg-amber-50 text-amber-700 ring-amber-200";
    case "expired": return "bg-rose-50 text-rose-700 ring-rose-200";
    default: return "bg-stone-100 text-stone-600 ring-stone-200";
  }
};

export default function GuestPortal({ org, totals }: { org: Org; totals: RegisterTotals }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuestResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [opening, setOpening] = useState(false);
  const [active, setActive] = useState<OpenRecord | null>(null);
  const [saved, setSaved] = useState<SavedRecords>({});
  const [online, setOnline] = useState(true);
  const [offlineIndex, setOfflineIndex] = useState<OfflineIndex | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) { void refreshOfflineIndex(); void refreshSavedRecords(); }
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    cacheGet<SavedRecords>("guest:saved").then((records) => setSaved(records ?? {}));
    if (navigator.onLine) void refreshSavedRecords();
    // Keep every open guest in sync: re-pull register + saved records every 30s.
    const live = setInterval(() => {
      if (!navigator.onLine) return;
      void refreshOfflineIndex();
      void refreshSavedRecords();
    }, 30000);
    cacheGet<OfflineIndex>("guest:offline-index").then((index) => {
      setOfflineIndex(index ?? null);
      // On every load/refresh with a connection, pull the latest register so
      // all devices converge on the same data, then keep it for offline use.
      if (index && navigator.onLine) void refreshOfflineIndex();
    });
    return () => {
      clearInterval(live);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistSaved(next: SavedRecords) {
    setSaved(next);
    await cacheSet("guest:saved", next);
  }

  const offlineSuggest = useCallback(
    (needle: string): Suggestion[] => {
      if (!offlineIndex) return [];
      const tokens = needle.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
      const digits = needle.replace(/\D/g, "");
      if (!tokens.length) return [];
      return offlineIndex.records
        .filter((record) => {
          const hay = record.searchText ?? "";
          if (tokens.every((token) => hay.includes(token))) return true;
          return digits.length >= 3 && hay.replace(/\D/g, "").includes(digits);
        })
        .slice(0, 8)
        .map((record) => ({
          id: record.id,
          memberId: record.memberId,
          name: record.name,
          grade: record.grade,
          status: record.status,
          region: record.region,
          yearOfReg: record.yearOfReg,
          email: record.email,
          phone: record.phone,
        }));
    },
    [offlineIndex],
  );

  const searchOfflineIndex = useCallback(
    (needle: string): GuestResult[] => {
      if (!offlineIndex) return [];
      const tokens = needle.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
      if (!tokens.length) return [];
      return offlineIndex.records.filter((record) => tokens.every((token) => record.searchText?.includes(token))).slice(0, 25);
    },
    [offlineIndex],
  );

  /** Silent background refresh of the saved register copy. */
  async function refreshOfflineIndex() {
    try {
      const collected: GuestResult[] = [];
      let offset = 0;
      let total = 0;
      for (;;) {
        const response = await fetch(`/api/guest/offline-index?offset=${offset}&limit=2000`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { records?: GuestResult[]; total?: number; hasMore?: boolean };
        total = data.total ?? 0;
        collected.push(...(data.records ?? []));
        if (!data.hasMore) break;
        offset += data.records?.length ?? 0;
      }
      const index: OfflineIndex = { records: collected, savedAt: new Date().toISOString(), total };
      await cacheSet("guest:offline-index", index);
      setOfflineIndex(index);
    } catch {
      /* stay on the previously saved copy */
    }
  }

  /** Refresh every record saved on this device so edits made by admins
   *  propagate to guests automatically whenever there is a connection. */
  async function refreshSavedRecords() {
    const current = await cacheGet<SavedRecords>("guest:saved");
    if (!current || !Object.keys(current).length || !navigator.onLine) return;
    const next: SavedRecords = { ...current };
    let changed = false;
    for (const key of Object.keys(current)) {
      try {
        const response = await fetch("/api/guest/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: current[key].recordId }),
        });
        if (response.status === 404) {
          delete next[key]; // record removed by an admin
          changed = true;
          continue;
        }
        const data = (await response.json()) as { ok?: boolean; record?: Record<string, string>; memberId?: string };
        if (data.ok && data.record) {
          const fresh = JSON.stringify(data.record);
          if (fresh !== JSON.stringify(current[key].record)) {
            next[key] = { ...current[key], record: data.record, memberId: data.memberId ?? current[key].memberId, viewedAt: new Date().toISOString() };
            changed = true;
          }
        }
      } catch {
        return; // connection dropped mid-way — try again on next cycle
      }
    }
    if (changed) {
      await cacheSet("guest:saved", next);
      setSaved(next);
      setActive((open) => (open && next[String(open.recordId)] ? next[String(open.recordId)] : open));
    }
  }

  async function syncOfflineRegister() {
    setSyncing(true);
    setSyncProgress(0);
    setError("");
    try {
      const collected: GuestResult[] = [];
      let offset = 0;
      let total = 0;
      for (;;) {
        const response = await fetch(`/api/guest/offline-index?offset=${offset}&limit=2000`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not reach the register");
        const data = (await response.json()) as { records?: GuestResult[]; total?: number; hasMore?: boolean };
        total = data.total ?? 0;
        collected.push(...(data.records ?? []));
        setSyncProgress(total ? Math.min(99, Math.round((collected.length / total) * 100)) : 50);
        if (!data.hasMore) break;
        offset += data.records?.length ?? 0;
      }
      const index: OfflineIndex = { records: collected, savedAt: new Date().toISOString(), total };
      await cacheSet("guest:offline-index", index);
      setOfflineIndex(index);
      setSyncProgress(100);
      setNotice(`${collected.length.toLocaleString()} records saved for offline search on this device.`);
    } catch {
      setError("Offline sync needs a connection once. Try again when you are online.");
    } finally {
      setSyncing(false);
    }
  }

  function pickSuggestion(suggestion: Suggestion) {
    // A chosen suggestion narrows the page down to that single matched record.
    setError("");
    setNotice("");
    const match: GuestResult = {
      id: suggestion.id,
      memberId: suggestion.memberId,
      name: suggestion.name,
      grade: suggestion.grade,
      category: suggestion.grade ?? "",
      status: suggestion.status ?? "",
      region: suggestion.region ?? "",
      yearOfReg: suggestion.yearOfReg,
      email: suggestion.email ?? "",
      phone: suggestion.phone ?? "",
    };
    setResults([match]);
    setTotalMatches(1);
    void openRecord(match);
  }

  async function handleSearch(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    setNotice("");
    if (query.trim().length < 3) {
      setError("Enter at least 3 characters — your membership number, name, email or phone.");
      return;
    }
    setSearching(true);
    try {
      const response = await fetch("/api/guest/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await response.json()) as SearchResponse;
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results ?? []);
      setTotalMatches(data.totalMatches ?? 0);
      if (data.results?.length) {
        await cacheSet("guest:last-search", { results: data.results, query });
      } else {
        setError("No record matched that search. Check the spelling or contact the registry office.");
      }
    } catch (err) {
      const offlineResults = searchOfflineIndex(query);
      if (offlineResults.length) {
        setResults(offlineResults);
        setTotalMatches(offlineResults.length);
        setNotice("You are offline — searching the register copy saved on this device.");
      } else {
        const cached = await cacheGet<{ results: GuestResult[]; query: string }>("guest:last-search");
        if (cached?.results?.length) {
          setResults(cached.results);
          setTotalMatches(cached.results.length);
          setNotice(`You are offline. Showing the last search saved on this device for “${cached.query}”.`);
        } else {
          setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "You are offline and no register copy is saved on this device yet.");
        }
      }
    } finally {
      setSearching(false);
    }
  }

  /** Open a record straight away — guests view, print or download, never edit. */
  async function openRecord(result: GuestResult) {
    setError("");
    const existing = saved[String(result.id)];
    if (existing) {
      setActive(existing);
      return;
    }
    setOpening(true);
    try {
      const response = await fetch("/api/guest/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.id, memberId: result.memberId }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string; record?: Record<string, string>; recordId?: number; memberId?: string };
      if (!response.ok || !data.ok || !data.record) throw new Error(data.error ?? "Unable to open that record");
      const opened: OpenRecord = {
        recordId: data.recordId ?? result.id,
        memberId: data.memberId ?? result.memberId,
        record: data.record,
        viewedAt: new Date().toISOString(),
      };
      await persistSaved({ ...saved, [String(opened.recordId)]: opened });
      setActive(opened);
    } catch (err) {
      const cached = saved[String(result.id)];
      if (cached) {
        setActive(cached);
        setNotice("Offline — showing the copy saved on this device.");
      } else {
        setError(
          err instanceof Error && err.message !== "Failed to fetch"
            ? err.message
            : "You are offline and this record has not been saved on this device yet.",
        );
      }
    } finally {
      setOpening(false);
    }
  }

  if (active) {
    return (
      <div className="mx-auto max-w-[900px] px-2 py-4 sm:px-6 sm:py-6 print-full">
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="btn-ghost px-2 text-sm" onClick={() => setActive(null)}>← Back</button>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-1 sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-initial">
            <DownloadRecordButton memberId={active.memberId} record={active.record} org={org} source="Guest portal · certified copy" />
            <PrintButton />
          </div>
        </div>
        {notice ? <p className="no-print mb-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">{notice}</p> : null}
        <RecordSheet
          org={{ orgName: org.orgName, shortName: org.shortName, tagline: org.tagline, logoUrl: org.logoUrl, supportEmail: org.supportEmail }}
          record={active.record}
          memberId={active.memberId}
          verifiedAt={active.viewedAt}
          source="Guest portal · public register view"
        />
        <p className="no-print mt-3 text-center text-[11px] text-stone-400">
          Read-only copy · corrections: {org.supportEmail}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10">
      <div className="text-center">
        <span className="eyebrow">Membership Database</span>
        <h1 className="mt-3 text-[1.45rem] font-black leading-tight tracking-tight text-stone-900 sm:text-4xl">Find your CILRMNG membership record</h1>
        <p className="mx-auto mt-2 max-w-2xl text-[11px] font-semibold uppercase leading-relaxed tracking-[0.06em] text-brand-700 sm:text-xs">
          Established by the act of Parliament of the Federal Republic of Nigeria Gazetted Bill No. SB 220 Vol. 9 of 2012
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-stone-600">
          Search by name, registration number, phone or e-mail — then view, print or download. Read-only.
        </p>
      </div>

      <div className="mx-auto mt-5 max-w-2xl">
        <DatabaseTotal initial={totals} variant="banner" />
        <div className="mt-2 flex justify-center">
          <OnlineCounter heartbeatAsGuest />
        </div>
      </div>

      <form onSubmit={handleSearch} className="mx-auto mt-5 flex max-w-2xl flex-col gap-2 sm:flex-row">
        <SearchAutocomplete
          className="flex-1"
          value={query}
          onChange={(next) => { setQuery(next); setError(""); }}
          onPick={pickSuggestion}
          onSubmit={() => handleSearch()}
          offlineSource={offlineSuggest}
          placeholder="Start typing a name, 3932/SILRM, phone or e-mail…"
          ariaLabel="Search the membership register"
        />
        <button type="submit" className="btn-primary sm:w-auto" disabled={searching}>{searching ? "Searching…" : "Search register"}</button>
      </form>
      <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-stone-400">
        Suggestions appear as you type — pick one to open the record.
      </p>

      <div className="mx-auto mt-3 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-[11px]">
        {offlineIndex ? (
          <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">
            Offline copy ready · {offlineIndex.records.length.toLocaleString()} records · synced {new Date(offlineIndex.savedAt).toLocaleDateString("en-GB")}
          </span>
        ) : (
          <span className="badge bg-stone-100 text-stone-600 ring-stone-200">Offline copy not yet saved on this device</span>
        )}
        <button type="button" className="btn-ghost px-2 py-1 text-[11px]" onClick={syncOfflineRegister} disabled={syncing || !online}>
          {syncing ? `Saving… ${syncProgress}%` : "Save all records for offline"}
        </button>
      </div>

      {error ? <p className="mx-auto mt-3 max-w-2xl rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">{error}</p> : null}
      {notice ? <p className="mx-auto mt-3 max-w-2xl rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700">{notice}</p> : null}
      {!online ? (
        <p className="mx-auto mt-3 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          You are offline. Search works across the saved register copy, and records you already opened stay readable, printable and downloadable.
        </p>
      ) : null}

      {results.length ? (
        <div className="mx-auto mt-6 max-w-2xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{totalMatches} match{totalMatches === 1 ? "" : "es"} found</p>
            <span className="text-[11px] text-stone-400">Open a record to view, print or download it.</span>
          </div>
          {results.map((result) => (
            <div key={result.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-stone-900">{display(result.name)}</p>
                  <span className={`badge ${statusTone(result.status)}`}>{display(result.grade || result.category)}</span>
                  {saved[String(result.id)] ? <span className="badge bg-brand-50 text-brand-700 ring-brand-200">saved offline</span> : null}
                </div>
                <p className="mt-0.5 font-mono text-xs text-stone-500">{display(result.memberId)}</p>
                <p className="mt-1 text-xs text-stone-500">
                  Year {display(result.yearOfReg)} · {display(result.region)} · {display(result.contactAddress)}
                </p>
                <p className="text-xs text-stone-400">{display(result.email)} · {display(result.phone)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 max-sm:w-full [&>*]:max-sm:flex-1">
                <button type="button" className="btn-primary text-xs" onClick={() => openRecord(result)} disabled={opening}>
                  View record
                </button>
                {saved[String(result.id)] ? (
                  <>
                    <DownloadRecordButton
                      memberId={result.memberId}
                      record={saved[String(result.id)].record}
                      org={org}
                      label="Download"
                      className="btn-secondary text-xs"
                    />
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setActive(saved[String(result.id)]);
                        setTimeout(() => window.print(), 350);
                      }}
                    >
                      Print
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}



      <FeedbackForm orgShortName={org.shortName} feedbackEmail={org.feedbackEmail} feedbackWhatsapp={org.feedbackWhatsapp} />

      <p className="mx-auto mt-8 max-w-2xl text-center text-[11px] text-stone-400">
        Need help? <a className="link" href={`mailto:${org.supportEmail}`}>{org.supportEmail}</a>
      </p>

    </div>
  );
}
