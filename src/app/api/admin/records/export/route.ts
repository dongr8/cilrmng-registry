import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSessionAdmin, unauthorized } from "@/lib/auth";
import { buildSearchConditions, membersToCsv } from "@/lib/members";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const url = new URL(request.url);
  const where = buildSearchConditions(url.searchParams.get("q") ?? "", {
    status: url.searchParams.get("status") ?? "",
    category: url.searchParams.get("category") ?? "",
    region: url.searchParams.get("region") ?? "",
  });

  const csvParts: string[] = [];
  let offset = 0;
  const pageSize = 5000;
  for (;;) {
    const page = await db
      .select({ memberId: members.memberId, data: members.data })
      .from(members)
      .where(where)
      .orderBy(asc(members.id))
      .limit(pageSize)
      .offset(offset);
    if (!page.length) break;
    const csv = membersToCsv(page);
    csvParts.push(offset === 0 ? csv : csv.split("\r\n").slice(1).join("\r\n"));
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  void sql;

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csvParts.join("\r\n") || "No records", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="membership-register-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
