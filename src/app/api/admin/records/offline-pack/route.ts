import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSessionAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Paginated full register download used to prepare an admin device for offline work. */
export async function GET(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const limit = Math.min(2000, Math.max(100, Number(url.searchParams.get("limit") ?? 1000)));

  const [rows, totals] = await Promise.all([
    db.select().from(members).orderBy(asc(members.id)).limit(limit).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(members),
  ]);
  const total = Number(totals[0]?.total ?? 0);

  return Response.json({
    ok: true,
    total,
    offset,
    hasMore: offset + rows.length < total,
    records: rows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      name: row.name,
      firstName: row.firstName,
      secondName: row.secondName,
      thirdName: row.thirdName,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      contactAddress: row.contactAddress,
      certificateCollected: row.certificateCollected,
      yearOfReg: row.yearOfReg,
      grade: row.grade,
      category: row.category,
      status: row.status,
      region: row.region,
      updatedAt: row.updatedAt,
      data: row.data,
    })),
  });
}
