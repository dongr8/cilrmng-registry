import { eq } from "drizzle-orm";
import { db } from "@/db";
import { backups } from "@/db/schema";
import { getSessionAdmin, unauthorized } from "@/lib/auth";
import { membersToCsv } from "@/lib/members";
import type { MemberData } from "@/db/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const { id } = await params;
  const rows = await db.select().from(backups).where(eq(backups.id, Number(id))).limit(1);
  const snapshot = rows[0];
  if (!snapshot?.payload) return Response.json({ ok: false, error: "Snapshot not found" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  const stamp = new Date(snapshot.createdAt).toISOString().slice(0, 10);
  if (format === "json") {
    const payload = {
      meta: {
        label: snapshot.label,
        rows: snapshot.rowCount,
        checksum: snapshot.checksum,
        createdAt: snapshot.createdAt,
        exportedBy: admin.name,
      },
      members: snapshot.payload.members,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="registry-snapshot-${snapshot.id}-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = membersToCsv(
    (snapshot.payload.members ?? []).map((record: MemberData) => ({
      memberId: record.memberId ?? "",
      data: record,
    })),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registry-snapshot-${snapshot.id}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
