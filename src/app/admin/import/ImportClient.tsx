"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MAX_COLUMNS,
  MAX_ROWS,
  MEMBER_FIELDS,
  autoMapHeaders,
  buildRecord,
  fullNameOf,
  generateSampleCsv,
  type FieldKey,
  type MemberRecord,
} from "@/lib/member-schema";
import { queueOperation, queueSize } from "@/lib/offline-client";
import { runImport, type ImportSummary } from "@/lib/import-client";

type ParsedData = {
  fileName: string;
  fileType: string;
  source: "upload" | "paste";
  headers: string[];
  rows: Record<string, unknown>[];
  truncatedColumns: number;
};

type Progress = { batch: number; totalBatches: number; processed: number; inserted: number; skipped: number; duplicates: number; failed: number };

const nf = new Intl.NumberFormat("en-US");

function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const candidates = ["\t", ",", ";", "|"];
  const delimiter = candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value); rows.push(row); row = []; value = ""; }
    else if (char === "\r") continue;
    else value += char;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export default function ImportClient({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<Record<string, FieldKey | "">>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [queuedImports, setQueuedImports] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshQueue = useCallback(() => {
    queueSize().then(setQueuedImports).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshQueue();
    window.addEventListener("meridian:queue-changed", refreshQueue);
    return () => window.removeEventListener("meridian:queue-changed", refreshQueue);
  }, [refreshQueue]);

  const mappedKeys = useMemo(() => Object.values(mapping).filter(Boolean) as FieldKey[], [mapping]);
  const mappedCount = mappedKeys.length;

  const previewRecords = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.slice(0, 6).map((row) => buildRecord(row, mapping));
  }, [parsed, mapping]);

  const validCount = useMemo(() => {
    if (!parsed) return 0;
    return parsed.rows.reduce((total, row) => {
      const record = buildRecord(row, mapping);
      return record.name || record.firstName || record.thirdName || record.memberId ? total + 1 : total;
    }, 0);
  }, [parsed, mapping]);

  const duplicateIds = useMemo(() => {
    if (!parsed) return 0;
    const seen = new Set<string>();
    let duplicates = 0;
    for (const row of parsed.rows) {
      const record = buildRecord(row, mapping);
      if (!record.memberId) continue;
      if (seen.has(record.memberId)) duplicates += 1;
      else seen.add(record.memberId);
    }
    return duplicates;
  }, [parsed, mapping]);

  function ingest(headers: string[], rows: Record<string, unknown>[], meta: { fileName: string; fileType: string; source: "upload" | "paste"; truncatedColumns: number }) {
    setSummary(null);
    setProgress(null);
    if (!headers.length || !rows.length) {
      setError("That file did not contain any data rows. Check the sheet and try again.");
      return;
    }
    if (rows.length > MAX_ROWS) {
      setError(`This file has ${nf.format(rows.length)} rows. The register accepts up to ${nf.format(MAX_ROWS)} rows per import — split the file and import in parts.`);
      return;
    }
    const cleanHeaders = headers.map((header, index) => String(header || `Column ${index + 1}`).trim());
    const uniqueHeaders = cleanHeaders.map((header, index) => (cleanHeaders.indexOf(header) === index ? header : `${header} (${index + 1})`));
    setError("");
    setParsed({ ...meta, headers: uniqueHeaders.slice(0, MAX_COLUMNS), rows });
    setMapping(autoMapHeaders(uniqueHeaders));
  }

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "csv";
      if (!["xlsx", "xls", "csv", "txt", "tsv"].includes(extension)) {
        throw new Error("Unsupported file. Upload an .xlsx, .xls, .csv, .tsv or .txt file.");
      }
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("The workbook has no sheets.");
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", blankrows: false, raw: false });
      if (!matrix.length) throw new Error("The first sheet is empty.");
      const rawHeaders = (matrix[0] as unknown[]).map((cell) => String(cell ?? "").trim());
      const headers = rawHeaders.filter(Boolean);
      const truncated = Math.max(0, headers.length - MAX_COLUMNS);
      const rows = matrix.slice(1).map((cells) => {
        const raw: Record<string, unknown> = {};
        (cells as unknown[]).forEach((cell, index) => {
          const header = rawHeaders[index];
          if (header && index < MAX_COLUMNS) raw[header] = cell;
        });
        return raw;
      });
      ingest(truncated ? headers.slice(0, MAX_COLUMNS) : headers, rows, {
        fileName: file.name,
        fileType: extension === "xlsx" || extension === "xls" ? "xlsx" : "csv",
        source: "upload",
        truncatedColumns: truncated,
      });
    } catch (err) {
      setParsed(null);
      setError(err instanceof Error ? err.message : "Unable to read that file.");
    } finally {
      setBusy(false);
    }
  }

  function handlePaste() {
    if (!pasteText.trim()) {
      setError("Paste rows copied from Excel, Google Sheets or a CSV before continuing.");
      return;
    }
    const matrix = parseDelimited(pasteText);
    if (matrix.length < 2) {
      setError("Paste at least a header row and one data row.");
      return;
    }
    const rawHeaders = matrix[0].map((cell) => cell.trim());
    const headers = rawHeaders.filter(Boolean);
    const truncated = Math.max(0, headers.length - MAX_COLUMNS);
    const rows = matrix.slice(1).map((cells) => {
      const raw: Record<string, unknown> = {};
      cells.forEach((cell, index) => {
        if (rawHeaders[index] && index < MAX_COLUMNS) raw[rawHeaders[index]] = cell;
      });
      return raw;
    });
    ingest(truncated ? headers.slice(0, MAX_COLUMNS) : headers, rows, {
      fileName: `Pasted batch · ${new Date().toLocaleDateString("en-GB")}`,
      fileType: "paste",
      source: "paste",
      truncatedColumns: truncated,
    });
  }

  function downloadSample(format: "csv" | "xlsx") {
    const csv = generateSampleCsv();
    if (format === "csv") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "membership-import-template.csv";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    import("xlsx").then((XLSX) => {
      const workbook = XLSX.read(csv, { type: "string" });
      XLSX.writeFile(workbook, "membership-import-template.xlsx");
    });
  }

  async function startImport() {
    if (!parsed) return;
    if (!mappedCount) {
      setError("Map at least one column before importing.");
      return;
    }
    const records: MemberRecord[] = [];
    for (const row of parsed.rows) {
      const record = buildRecord(row, mapping);
      if (record.memberId || record.name || record.firstName || record.thirdName) records.push(record);
    }
    if (!records.length) {
      setError("None of the rows contain a name or registration number — check your column mapping.");
      return;
    }
    setBusy(true);
    setError("");
    setSummary(null);
    setProgress({ batch: 0, totalBatches: Math.ceil(records.length / 500), processed: 0, inserted: 0, skipped: 0, duplicates: 0, failed: 0 });
    try {
      const result = await runImport({
        rows: records,
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        source: parsed.source,
        onProgress: setProgress,
      });
      setSummary(result);
      setParsed(null);
      window.dispatchEvent(new Event("meridian:records-changed"));
    } catch (err) {
      if (!navigator.onLine || (err instanceof Error && err.message === "Failed to fetch")) {
        await queueOperation({
          kind: "import",
          fileName: parsed.fileName,
          fileType: parsed.fileType,
          source: parsed.source,
          rows: records,
          queuedAt: new Date().toISOString(),
        });
        setSummary({ importId: null, inserted: 0, updated: 0, skipped: 0, failed: 0, processed: 0, duplicates: 0, duplicateSamples: [], done: false });
        setError(`Offline — ${nf.format(records.length)} rows were saved on this device and will sync automatically when the network returns.`);
        setParsed(null);
        refreshQueue();
      } else {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Records menu · ingest</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-stone-900 sm:text-2xl">Import members</h2>
          <p className="mt-1 text-sm text-stone-500">Excel, CSV or clipboard · matches your NAME / Registration Number / Certificate / Year / Address / Tel / E-mail sheet · up to {nf.format(MAX_ROWS)} rows and {MAX_COLUMNS} columns</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => downloadSample("xlsx")}>Download Excel template</button>
          <button type="button" className="btn-secondary text-xs" onClick={() => downloadSample("csv")}>Download CSV template</button>
        </div>
      </div>

      {queuedImports ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <span>{queuedImports} operation(s) queued on this device. They replay automatically when online — or press “Sync now” in the sidebar.</span>
          <Link href="/admin/records" className="font-semibold underline">View register</Link>
        </div>
      ) : null}

      {summary ? (
        <div className={`card card-pad ${summary.importId ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
          <h3 className="text-base font-bold text-stone-900">{summary.importId ? "Import complete" : "Import queued offline"}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "New records added", value: summary.inserted },
              { label: "Duplicates ignored", value: summary.duplicates },
              { label: "Invalid rows", value: summary.failed },
              { label: "Rows processed", value: summary.processed },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white p-3 ring-1 ring-[#f1e7df]">
                <p className="text-[10px] uppercase tracking-wide text-stone-400">{item.label}</p>
                <p className="text-xl font-black text-stone-900">{nf.format(item.value)}</p>
              </div>
            ))}
          </div>
          {summary.duplicateSamples.length ? (
            <details className="mt-3 rounded-xl border border-[#f1e7df] bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold text-stone-700">
                View ignored duplicates ({summary.duplicates})
              </summary>
              <ul className="mt-2 space-y-1 text-[11px] text-stone-600">
                {summary.duplicateSamples.map((item, index) => (
                  <li key={`${item.memberId}-${index}`} className="flex flex-wrap justify-between gap-2 border-b border-stone-100 pb-1">
                    <span className="font-medium text-stone-800">{item.name || item.memberId}</span>
                    <span className="font-mono text-stone-500">{item.memberId}</span>
                    <span className="text-amber-700">matched existing {item.reason}</span>
                  </li>
                ))}
                {summary.duplicates > summary.duplicateSamples.length ? (
                  <li className="pt-1 text-stone-400">…and {summary.duplicates - summary.duplicateSamples.length} more</li>
                ) : null}
              </ul>
            </details>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/records" className="btn-primary text-xs">Open directory</Link>
            <button type="button" className="btn-secondary text-xs" onClick={() => setSummary(null)}>Import another file</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">{error}</p> : null}

      {!parsed ? (
        <div className="card overflow-hidden">
          <div className="flex border-b border-[#f1e7df]">
            {[
              { key: "upload" as const, label: "Upload file" },
              { key: "paste" as const, label: "Paste from spreadsheet" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => { setTab(item.key); setError(""); }}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition ${tab === item.key ? "border-b-2 border-brand-600 bg-brand-50/50 text-brand-700" : "text-stone-500 hover:bg-stone-50"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="p-4 sm:p-6">
            {tab === "upload" ? (
              <div
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${dragging ? "border-brand-500 bg-brand-50" : "border-[#e6d9ce] bg-[#fffdfb]"}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 17V3m0 0l-4 4m4-4l4 4M4 17v4h16v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <p className="mt-3 text-sm font-bold text-stone-900">Drop your Excel or CSV file here</p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-stone-500">
                  .xlsx, .xls, .csv, .tsv and .txt · first sheet is imported · header row required · up to {nf.format(MAX_ROWS)} rows and {MAX_COLUMNS} columns.
                  Parsing happens on this device before rows are sent to the register.
                </p>
                <button type="button" className="btn-primary mt-4 text-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
                  {busy ? "Reading file…" : "Choose a file"}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFile(file);
                    event.target.value = "";
                  }}
                />
                <div className="mt-6 grid grid-cols-1 w-full max-w-lg gap-2 text-left text-[11px] text-stone-500 sm:grid-cols-3">
                  <span className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#f1e7df]">1. File parsed locally</span>
                  <span className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#f1e7df]">2. NAME auto-splits into 3</span>
                  <span className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#f1e7df]">3. Batched to the register</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="paste-area">Paste rows including the header</label>
                <textarea
                  id="paste-area"
                  className="input min-h-[220px] font-mono text-xs"
                  placeholder={"NAME\tRegistration Number\tCertificate Collected\tYear of Reg\tCONTACT ADDRESS\tTEL. NO\tE-MAIL ADDRESS\nOLOWOOKERE OLUWASEYI ISAAC\t3932/SILRM\t\t\t10, OLABIRORO STREET, IKEJA LAGOS\t8034297656\tlincolm202@yahoo.com"}
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-stone-500">Comma, tab, semicolon and pipe delimiters are detected automatically. Copy directly from Excel or Google Sheets.</p>
                  <button type="button" className="btn-primary text-sm" onClick={handlePaste}>Parse pasted rows</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">{parsed.fileName}</h3>
                <p className="text-xs text-stone-500">
                  {nf.format(parsed.rows.length)} data rows · {parsed.headers.length} columns · {mappedCount} mapped
                  {parsed.truncatedColumns ? ` · ${parsed.truncatedColumns} extra column(s) ignored (20 max)` : ""}
                </p>
              </div>
              <button type="button" className="btn-ghost text-xs" onClick={() => { setParsed(null); setProgress(null); }}>Choose another file</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-brand-50 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-brand-700/70">Rows detected</p><p className="text-sm font-bold text-stone-900">{nf.format(parsed.rows.length)}</p></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-stone-400">Importable</p><p className="text-sm font-bold text-stone-900">{nf.format(validCount)}</p></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-stone-400">Duplicate IDs in file</p><p className="text-sm font-bold text-stone-900">{nf.format(duplicateIds)}</p></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-stone-400">Source</p><p className="text-sm font-bold capitalize text-stone-900">{parsed.source}</p></div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1e7df] bg-[#fffdfb] px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Map columns to the membership schema</h3>
                <p className="text-[11px] text-stone-500">Auto-matched headers are pre-selected (NAME, Registration Number, Certificate Collected, Year of Reg, Contact Address, Tel. No, E-mail). Adjust anything that looks wrong.</p>
              </div>
              <span className="badge bg-brand-50 text-brand-700 ring-brand-200">{mappedCount} / {parsed.headers.length} mapped</span>
            </div>
            <div className="max-h-[340px] overflow-y-auto scroll-thin">
              <table className="w-full min-w-[560px] border-separate border-spacing-0">
                <thead className="sticky top-0 bg-white">
                  <tr><th className="th">Your column</th><th className="th">Sample value</th><th className="th">Maps to field</th></tr>
                </thead>
                <tbody>
                  {parsed.headers.map((header) => (
                    <tr key={header} className="border-t border-stone-100">
                      <td className="td font-medium text-stone-800">{header}</td>
                      <td className="td max-w-[220px] truncate text-xs text-stone-500">{String(parsed.rows[0]?.[header] ?? "—")}</td>
                      <td className="td">
                        <select
                          className="input max-w-[260px] py-1.5 text-xs"
                          value={mapping[header] ?? ""}
                          onChange={(event) => setMapping((current) => ({ ...current, [header]: event.target.value as FieldKey | "" }))}
                        >
                          <option value="">— ignore column —</option>
                          {MEMBER_GROUPS.map((group) => (
                            <optgroup key={group.group} label={group.group}>
                              {group.fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-[#f1e7df] bg-[#fffdfb] px-4 py-3">
              <h3 className="text-sm font-bold text-stone-900">Preview (first 6 rows)</h3>
              <p className="text-[11px] text-stone-500">Nothing is written to the register until you press Import.</p>
            </div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[700px]">
                <thead><tr><th className="th">Member</th><th className="th">Member ID</th><th className="th">Category</th><th className="th">Status</th><th className="th">Contact</th><th className="th">Region</th></tr></thead>
                <tbody>
                  {previewRecords.map((record, index) => (
                    <tr key={index} className="border-t border-stone-100">
                      <td className="td font-medium text-stone-800">
                        {fullNameOf(record) || <span className="text-rose-500">missing name</span>}
                        <span className="block text-[10px] text-stone-400">{record.firstName || "Nil"} · {record.secondName || "Nil"} · {record.thirdName || "Nil"}</span>
                      </td>
                      <td className="td font-mono text-xs">{record.memberId || <span className="text-stone-400">auto-generate</span>}</td>
                      <td className="td text-xs">{record.grade || "Nil"}</td>
                      <td className="td text-xs">{record.yearOfReg || "Nil"}</td>
                      <td className="td max-w-[220px] truncate text-xs">{record.contactAddress || "Nil"}</td>
                      <td className="td text-xs">{record.phone || "Nil"}<span className="block text-[10px] text-stone-400">{record.email || "Nil"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="text-sm font-bold text-stone-900">Duplicate protection</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Rows that already exist are <strong>ignored automatically</strong> — nothing in the register is overwritten. A row counts as a duplicate when
              its <strong>registration number</strong>, <strong>name</strong>, <strong>phone number</strong> or <strong>e-mail</strong> matches an existing member,
              or an earlier row in this same file. Only new records are uploaded.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
              {["Registration number", "Name", "Phone number", "E-mail"].map((label) => (
                <span key={label} className="rounded-lg bg-brand-50 px-2.5 py-2 text-center text-[11px] font-semibold text-brand-800">{label}</span>
              ))}
            </div>

            {progress ? (
              <div className="mt-4 rounded-xl border border-[#f1e7df] p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                  <span>{summary ? "Finished" : `Uploading batch ${progress.batch} of ${progress.totalBatches}`}</span>
                  <span>{nf.format(progress.processed)} rows</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round((progress.batch / Math.max(1, progress.totalBatches)) * 100)}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-stone-500">New {progress.inserted} · Duplicates ignored {progress.duplicates} · Invalid {progress.failed}</p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-stone-500">Imported by {adminName}. {nf.format(validCount)} importable rows will be sent in batches of 500.</p>
              <button type="button" className="btn-primary" onClick={startImport} disabled={busy}>
                {busy ? "Uploading…" : `Upload ${nf.format(validCount)} rows`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MEMBER_GROUPS = ["Name", "Registration", "Contact", "Membership", "Location", "Other"].map((group) => ({
  group,
  fields: MEMBER_FIELDS.filter((field) => field.group === group),
}));
