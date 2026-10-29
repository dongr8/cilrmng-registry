import { sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public, unauthenticated register totals. Both the Home page and the Records
 * (guest) page read this single source, so the number always matches and
 * reflects every upload, edit or deletion immediately.
 */
export async function GET() {
  try {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${members.status} = 'Active')`,
        states: sql<number>`count(distinct nullif(${members.region}, ''))`,
        grades: sql<number>`count(distinct nullif(${members.grade}, ''))`,
        lastUpdated: sql<string | null>`max(${members.updatedAt})`,
      })
      .from(members);

    return Response.json(
      {
        ok: true,
        total: Number(row?.total ?? 0),
        active: Number(row?.active ?? 0),
        states: Number(row?.states ?? 0),
        grades: Number(row?.grades ?? 0),
        lastUpdated: row?.lastUpdated ?? null,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return Response.json({ ok: false, total: 0, active: 0, states: 0, grades: 0 }, { status: 503 });
  }
}
