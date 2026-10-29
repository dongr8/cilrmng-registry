import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { guestLinks, members } from "@/db/schema";
import { getSessionAdmin, logAudit, unauthorized } from "@/lib/auth";
import { fullNameOf } from "@/lib/member-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const rows = await db.select().from(guestLinks).orderBy(desc(guestLinks.createdAt)).limit(100);
  return Response.json({
    ok: true,
    links: rows.map((row) => ({
      id: row.id,
      token: row.token,
      url: `/r/${row.token}`,
      memberId: row.memberId,
      memberName: row.memberName,
      note: row.note,
      createdByName: row.createdByName,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      viewCount: row.viewCount,
      lastViewedAt: row.lastViewedAt,
      general: row.memberRecordId === 0,
      permanent: new Date(row.expiresAt).getFullYear() - new Date(row.createdAt).getFullYear() > 50,
      status: row.revokedAt ? "revoked" : new Date(row.expiresAt) < new Date() ? "expired" : "active",
    })),
  });
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as {
    recordId?: number;
    memberId?: string;
    note?: string;
    expiresInDays?: number;
  };

  // Member attachment is OPTIONAL. With no member, a general access link is
  // generated that opens the full searchable register for the guest.
  let member: { id: number; memberId: string; data: Record<string, string>; fullName: string } | undefined;
  if (body.recordId) {
    member = (await db.select().from(members).where(eq(members.id, Number(body.recordId))).limit(1))[0];
    if (!member) return Response.json({ ok: false, error: "That record no longer exists." }, { status: 404 });
  } else if (body.memberId?.trim()) {
    member = (await db.select().from(members).where(eq(members.memberId, body.memberId.trim())).limit(1))[0];
    if (!member) return Response.json({ ok: false, error: "That record no longer exists." }, { status: 404 });
  }

  // Links are unconditional: no expiry unless one is explicitly requested.
  const days = body.expiresInDays ? Math.min(36500, Math.max(1, Number(body.expiresInDays))) : 36500;
  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const name = member ? fullNameOf(member.data, member.fullName) : "Full register access";

  const inserted = await db
    .insert(guestLinks)
    .values({
      token,
      memberRecordId: member?.id ?? 0,
      memberId: member?.memberId ?? "REGISTER",
      memberName: name,
      note: (body.note ?? "").slice(0, 180),
      createdBy: admin.id,
      createdByName: admin.name,
      expiresAt,
    })
    .returning();

  const link = inserted[0];
  await logAudit(admin, "Generated guest link", member ? `${name} · ${member.memberId}` : "General register access link");

  return Response.json({
    ok: true,
    link: {
      id: link.id,
      token: link.token,
      url: `/r/${link.token}`,
      memberId: link.memberId,
      memberName: link.memberName,
      note: link.note,
      general: link.memberRecordId === 0,
      permanent: true,
      expiresAt: link.expiresAt,
      createdByName: link.createdByName,
      viewCount: 0,
      status: "active",
      createdAt: link.createdAt,
    },
  });
}
