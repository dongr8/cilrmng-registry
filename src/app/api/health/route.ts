import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, status: "healthy", database: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      { ok: false, status: "degraded", database: "unreachable", error: (error as Error).message },
      { status: 503 },
    );
  }
}
