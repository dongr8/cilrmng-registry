import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSettings } from "@/lib/auth";
import { buildSearchConditions } from "@/lib/members";
import { fullNameOf } from "@/lib/member-schema";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "guest-search"), 40, 60_000);
  if (!limit.allowed) {
    return Response.json({ ok: false, error: `Please wait ${limit.retryAfter}s before searching again.` }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const query = (body.query ?? "").trim();
  if (query.length < 3) {
    return Response.json({ ok: false, error: "Enter at least 3 characters — member ID, name, email or phone." }, { status: 400 });
  }

  const current = await getSettings();
  const where = buildSearchConditions(query, {});
  const rows = await db
    .select()
    .from(members)
    .where(where)
    .orderBy(desc(members.updatedAt))
    .limit(8);

  const [countRow] = await db.select({ total: sql<number>`count(*)` }).from(members).where(where);

  return Response.json({
    ok: true,
    query,
    totalMatches: Number(countRow?.total ?? 0),
    results: rows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      name: fullNameOf(row.data, row.fullName),
      grade: row.grade,
      category: row.category,
      status: row.status,
      region: row.region,
      yearOfReg: row.yearOfReg,
      certificateCollected: row.certificateCollected,
      email: row.email || row.data.email || "",
      phone: row.phone || row.data.phone || "",
      contactAddress: row.contactAddress || "",
    })),
    orgName: current.orgName,
  });
}
