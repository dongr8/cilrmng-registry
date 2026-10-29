"use client";

import type { MemberRecord } from "@/lib/member-schema";

export type DuplicateSample = { memberId: string; name: string; reason: string };

export type ImportSummary = {
  importId: number | null;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  processed: number;
  duplicates: number;
  duplicateSamples: DuplicateSample[];
  done: boolean;
};

export type RunImportOptions = {
  rows: MemberRecord[];
  fileName: string;
  fileType: string;
  source: string;
  batchSize?: number;
  onProgress?: (progress: { batch: number; totalBatches: number; processed: number; inserted: number; skipped: number; duplicates: number; failed: number }) => void;
};

export async function runImport({
  rows,
  fileName,
  fileType,
  source,
  batchSize = 500,
  onProgress,
}: RunImportOptions): Promise<ImportSummary> {
  const totalBatches = Math.max(1, Math.ceil(rows.length / batchSize));
  let importId: number | null = null;
  const totals: ImportSummary = {
    importId: null,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    processed: 0,
    duplicates: 0,
    duplicateSamples: [],
    done: false,
  };

  for (let batch = 0; batch < totalBatches; batch += 1) {
    const slice = rows.slice(batch * batchSize, (batch + 1) * batchSize);
    const response = await fetch("/api/admin/records/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importId,
        fileName,
        fileType,
        source,
        rows: slice,
        batchIndex: batch,
        totalBatches,
        startIndex: batch * batchSize,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      importId?: number;
      inserted?: number;
      updated?: number;
      skipped?: number;
      failed?: number;
      processed?: number;
      duplicates?: number;
      duplicateSamples?: DuplicateSample[];
      done?: boolean;
    };
    if (!response.ok || !data.ok) throw new Error(data.error ?? "Import batch failed");
    if (importId === null) importId = data.importId ?? null;
    totals.inserted += data.inserted ?? 0;
    totals.skipped += data.skipped ?? 0;
    totals.failed += data.failed ?? 0;
    totals.processed += data.processed ?? slice.length;
    totals.duplicates += data.duplicates ?? 0;
    if (data.duplicateSamples?.length && totals.duplicateSamples.length < 20) {
      totals.duplicateSamples.push(...data.duplicateSamples.slice(0, 20 - totals.duplicateSamples.length));
    }
    totals.done = Boolean(data.done);
    onProgress?.({
      batch: batch + 1,
      totalBatches,
      processed: totals.processed,
      inserted: totals.inserted,
      skipped: totals.skipped,
      duplicates: totals.duplicates,
      failed: totals.failed,
    });
  }

  totals.importId = importId;
  totals.done = true;
  return totals;
}
