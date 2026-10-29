import { desc, eq, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSessionAdmin, logAudit, unauthorized } from "@/lib/auth";
import { buildSearchConditions, generateMemberId, sanitizeRecord, toMemberColumns } from "@/lib/members";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const region = url.searchParams.get("region") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 25)));
  const sort = url.searchParams.get("sort") ?? "recent";

  const where = buildSearchConditions(q, { status, category, region });

  const [rows, totalRows, facets] = await Promise.all([
    db
      .select()
      .from(members)
      .where(where)
      .orderBy(sort === "name" ? members.name : sort === "memberId" ? members.memberId : desc(members.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)` }).from(members).where(where),
    db
      .select({ category: members.category, status: members.status, region: members.region })
      .from(members)
      .groupBy(members.category, members.status, members.region)
      .limit(5000),
  ]);

  const categories = [...new Set(facets.map((f) => f.category).filter(Boolean))].sort();
  const statuses = [...new Set(facets.map((f) => f.status).filter(Boolean))].sort();
  const regions = [...new Set(facets.map((f) => f.region).filter(Boolean))].sort();

  return Response.json({
    ok: true,
    records: rows,
    total: Number(totalRows[0]?.total ?? 0),
    page,
    pageSize,
    facets: { categories, statuses, regions },
  });
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { record?: Record<string, unknown>; clientRef?: string };
  const record = sanitizeRecord(body.record);
  if (!record.name && !record.firstName && !record.thirdName && !record.memberId) {
    return Response.json({ ok: false, error: "Provide at least a name or registration number" }, { status: 400 });
  }
  if (!record.memberId) record.memberId = generateMemberId(Math.floor(Math.random() * 99999));

  const duplicate = await db.select({ id: members.id }).from(members).where(eq(members.memberId, record.memberId)).limit(1);
  if (duplicate[0]) {
    return Response.json({ ok: false, error: `Member ID ${record.memberId} already exists`, conflict: true }, { status: 409 });
  }

  const inserted = await db
    .insert(members)
    .values({ memberId: record.memberId, ...toMemberColumns(record) })
    .returning();
  await logAudit(admin, "Created member record", record.memberId);
  return Response.json({ ok: true, record: inserted[0], clientRef: body.clientRef });
}

export async function DELETE(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { ids?: number[]; all?: boolean };
  // Any approved admin may delete records; clearing the whole register stays root-only.
  if (body.all && admin.role !== "root") {
    return Response.json({ ok: false, error: "Only the root admin can clear the entire register" }, { status: 403 });
  }
  if (body.all) {
    await db.delete(members);
    await logAudit(admin, "Cleared entire register");
    return Response.json({ ok: true, cleared: true });
  }
  const ids = (body.ids ?? []).map(Number).filter((id) => Number.isFinite(id));
  if (!ids.length) return Response.json({ ok: false, error: "No records selected" }, { status: 400 });
  await db.delete(members).where(inArray(members.id, ids));
  await logAudit(admin, "Deleted member records", `${ids.length} record(s)`);
  return Response.json({ ok: true, deleted: ids.length });
}
