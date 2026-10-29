import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSessionAdmin, logAudit, unauthorized } from "@/lib/auth";
import { sanitizeRecord, toMemberColumns } from "@/lib/members";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const { id } = await params;
  const rows = await db.select().from(members).where(eq(members.id, Number(id))).limit(1);
  if (!rows[0]) return Response.json({ ok: false, error: "Record not found" }, { status: 404 });
  return Response.json({ ok: true, record: rows[0] });
}

export async function PATCH(request: Request, { params }: Params) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { record?: Record<string, unknown> };
  const record = sanitizeRecord(body.record);
  if (!record.memberId) return Response.json({ ok: false, error: "Membership number is required" }, { status: 400 });

  const existing = await db.select({ id: members.id, memberId: members.memberId }).from(members).where(eq(members.id, Number(id))).limit(1);
  if (!existing[0]) return Response.json({ ok: false, error: "Record not found" }, { status: 404 });
  if (existing[0].memberId !== record.memberId) {
    if (admin.role !== "root") {
      return Response.json(
        { ok: false, error: "Only the root admin can change a membership/registration number.", field: "memberId" },
        { status: 403 },
      );
    }
    const clash = await db.select({ id: members.id }).from(members).where(eq(members.memberId, record.memberId)).limit(1);
    if (clash[0]) return Response.json({ ok: false, error: "Another member already uses that ID" }, { status: 409 });
  }

  const updated = await db
    .update(members)
    .set({ memberId: record.memberId, ...toMemberColumns(record), updatedAt: new Date() })
    .where(eq(members.id, Number(id)))
    .returning();
  await logAudit(admin, "Updated member record", record.memberId);
  return Response.json({ ok: true, record: updated[0] });
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const { id } = await params;
  const deleted = await db.delete(members).where(eq(members.id, Number(id))).returning({ memberId: members.memberId });
  if (!deleted[0]) return Response.json({ ok: false, error: "Record not found" }, { status: 404 });
  await logAudit(admin, "Deleted member record", deleted[0].memberId);
  return Response.json({ ok: true });
}
