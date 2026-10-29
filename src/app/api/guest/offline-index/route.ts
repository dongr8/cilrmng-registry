import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSettings } from "@/lib/auth";
import { fullNameOf } from "@/lib/member-schema";

export const dynamic = "force-dynamic";

/**
 * Masked search index for guests. The whole synced register is available to a
 * guest offline (contact data stays masked) so lookups keep working without a
 * connection; unlocking a full record still needs one online verification.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const limit = Math.min(5000, Math.max(200, Number(url.searchParams.get("limit") ?? 2000)));

  const [rows, totals, current] = await Promise.all([
    db
      .select()
      .from(members)
      .orderBy(asc(members.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(members),
    getSettings(),
  ]);

  const total = Number(totals[0]?.total ?? 0);
  return Response.json({
    ok: true,
    total,
    offset,
    limit,
    hasMore: offset + rows.length < total,
    orgName: current.orgName,
    updatedAt: new Date().toISOString(),
    records: rows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      name: fullNameOf(row.data, row.fullName),
      firstName: row.data.firstName ?? row.firstName,
      secondName: row.data.secondName ?? row.secondName,
      thirdName: row.data.thirdName ?? row.thirdName,
      grade: row.grade,
      category: row.category,
      status: row.status,
      region: row.region,
      yearOfReg: row.yearOfReg,
      certificateCollected: row.certificateCollected,
      email: row.email || row.data.email || "",
      phone: row.phone || row.data.phone || "",
      contactAddress: row.contactAddress || "",
      searchText: [
        row.memberId,
        row.name,
        row.firstName,
        row.secondName,
        row.thirdName,
        row.email,
        row.phone,
        row.contactAddress,
        row.grade,
        row.category,
        row.status,
        row.region,
        row.yearOfReg,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    })),
  });
}
