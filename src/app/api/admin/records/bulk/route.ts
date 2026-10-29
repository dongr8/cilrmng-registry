import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { imports, members } from "@/db/schema";
import { getSessionAdmin, logAudit, unauthorized } from "@/lib/auth";
import { generateMemberId, sanitizeRecord, toMemberColumns } from "@/lib/members";
import { DuplicateIndex, fingerprintOf, splitDuplicates } from "@/lib/duplicates";
import type { MemberRecord } from "@/lib/member-schema";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type BulkBody = {
  importId?: number | null;
  fileName?: string;
  fileType?: string;
  source?: string;
  rows?: MemberRecord[];
  batchIndex?: number;
  totalBatches?: number;
  rowsFailed?: number;
  startIndex?: number;
};

const INSERT_CHUNK = 400;
const SCAN_PAGE = 5000;

/** Build an index of every existing member so duplicates can be ignored. */
async function loadExistingIndex(): Promise<DuplicateIndex> {
  const index = new DuplicateIndex();
  let offset = 0;
  for (;;) {
    const page = await db
      .select({
        memberId: members.memberId,
        name: members.name,
        firstName: members.firstName,
        secondName: members.secondName,
        thirdName: members.thirdName,
        phone: members.phone,
        email: members.email,
      })
      .from(members)
      .orderBy(members.id)
      .limit(SCAN_PAGE)
      .offset(offset);
    for (const row of page) index.add(fingerprintOf(row));
    if (page.length < SCAN_PAGE) break;
    offset += SCAN_PAGE;
  }
  return index;
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  let body: BulkBody;
  try {
    body = (await request.json()) as BulkBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid batch payload" }, { status: 400 });
  }

  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  if (!rawRows.length) return Response.json({ ok: false, error: "Batch contains no rows" }, { status: 400 });
  const batchIndex = body.batchIndex ?? 0;
  const totalBatches = Math.max(1, body.totalBatches ?? 1);
  const startIndex = body.startIndex ?? 0;

  let importId = body.importId ?? null;
  if (!importId) {
    const created = await db
      .insert(imports)
      .values({
        fileName: body.fileName?.slice(0, 180) || "Untitled import",
        fileType: body.fileType ?? "csv",
        source: body.source ?? "upload",
        status: "processing",
        createdBy: admin.id,
        createdByName: admin.name,
      })
      .returning({ id: imports.id });
    importId = created[0].id;
  }

  // Normalise rows first.
  const prepared: MemberRecord[] = [];
  let failed = Number(body.rowsFailed ?? 0);
  for (let i = 0; i < rawRows.length; i += 1) {
    const record = sanitizeRecord(rawRows[i]);
    const hasName = record.name || record.firstName || record.thirdName;
    if (!hasName && !record.memberId) {
      failed += 1;
      continue;
    }
    if (!record.memberId) record.memberId = generateMemberId(startIndex + i);
    if (!record.status) record.status = "Active";
    prepared.push(record);
  }

  // Ignore anything that already exists (reg number, name, phone or e-mail),
  // and anything repeated inside this same file.
  const index = await loadExistingIndex();
  const { unique, duplicates } = splitDuplicates(prepared, index);

  const duplicateSamples = duplicates.slice(0, 20).map((entry) => ({
    memberId: entry.record.memberId,
    name: [entry.record.firstName, entry.record.secondName, entry.record.thirdName].filter(Boolean).join(" ") || entry.record.name,
    reason: entry.reason,
  }));

  let insertedCount = 0;
  for (let offset = 0; offset < unique.length; offset += INSERT_CHUNK) {
    const chunk = unique.slice(offset, offset + INSERT_CHUNK);
    const values = chunk.map((record) => ({ memberId: record.memberId, importId, ...toMemberColumns(record) }));
    if (!values.length) continue;
    // onConflictDoNothing is a final safety net for the unique member_id index.
    const inserted = await db.insert(members).values(values).onConflictDoNothing().returning({ id: members.id });
    insertedCount += inserted.length;
  }

  const skippedCount = duplicates.length + Math.max(0, unique.length - insertedCount);
  const isFinal = batchIndex + 1 >= totalBatches;

  await db
    .update(imports)
    .set({
      status: isFinal ? (failed > 0 ? "completed_with_errors" : "completed") : "processing",
      rowsTotal: sql`${imports.rowsTotal} + ${prepared.length}`,
      rowsImported: sql`${imports.rowsImported} + ${insertedCount}`,
      rowsSkipped: sql`${imports.rowsSkipped} + ${skippedCount}`,
      rowsFailed: sql`${imports.rowsFailed} + ${failed - Number(body.rowsFailed ?? 0)}`,
      columnCount: sql`greatest(${imports.columnCount}, 7)`,
    })
    .where(eq(imports.id, importId));

  if (isFinal) {
    await logAudit(
      admin,
      "Uploaded membership file",
      `${body.fileName ?? "import"} · ${insertedCount} new / ${skippedCount} duplicate(s) ignored / ${failed} invalid`,
    );
  }

  return Response.json({
    ok: true,
    importId,
    processed: prepared.length,
    inserted: insertedCount,
    updated: 0,
    skipped: skippedCount,
    failed,
    duplicates: duplicates.length,
    duplicateSamples,
    batchIndex,
    totalBatches,
    done: isFinal,
  });
}
