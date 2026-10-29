import { asc, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { fullNameOf } from "@/lib/member-schema";
import { getSessionAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin type-ahead — unmasked, matches partial names, reg numbers and phone digits. */
export async function GET(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const url = new URL(request.url);
  const raw = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(12, Math.max(3, Number(url.searchParams.get("limit") ?? 8)));
  if (!raw) return Response.json({ ok: true, suggestions: [] });

  const tokens = raw.split(/[\s,]+/).filter(Boolean).slice(0, 4);
  const digits = raw.replace(/\D/g, "");
  const conditions: SQL[] = tokens.map((token) => {
    const pattern = `%${token.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    return or(
      ilike(members.name, pattern),
      ilike(members.firstName, pattern),
      ilike(members.secondName, pattern),
      ilike(members.thirdName, pattern),
      ilike(members.memberId, pattern),
      ilike(members.email, pattern),
      ilike(members.phone, pattern),
      ilike(members.contactAddress, pattern),
      ilike(members.region, pattern),
      ilike(members.grade, pattern),
      ilike(members.yearOfReg, pattern),
    ) as SQL;
  });
  if (digits.length >= 3) {
    conditions.push(sql`regexp_replace(${members.phone}, '[^0-9]', '', 'g') like ${`%${digits}%`}` as SQL);
  }

  const rows = await db
    .select({
      id: members.id,
      memberId: members.memberId,
      name: members.name,
      fullName: members.fullName,
      firstName: members.firstName,
      secondName: members.secondName,
      thirdName: members.thirdName,
      grade: members.grade,
      status: members.status,
      region: members.region,
      yearOfReg: members.yearOfReg,
      email: members.email,
      phone: members.phone,
    })
    .from(members)
    .where(conditions.length ? (or(...conditions) as SQL) : undefined)
    .orderBy(asc(members.name))
    .limit(take * 3);

  const needle = raw.toLowerCase();
  const suggestions = rows
    .map((row) => {
      const name = fullNameOf(
        { firstName: row.firstName, secondName: row.secondName, thirdName: row.thirdName, name: row.name },
        row.fullName,
      );
      let score = 0;
      if (name.toLowerCase().startsWith(needle)) score += 100;
      if (row.memberId.toLowerCase().startsWith(needle)) score += 80;
      if (name.toLowerCase().split(/\s+/).some((part) => part.startsWith(needle))) score += 60;
      if (digits.length >= 3 && row.phone.replace(/\D/g, "").includes(digits)) score += 50;
      return { row, name, score };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, take)
    .map(({ row, name }) => ({
      id: row.id,
      memberId: row.memberId,
      name,
      nameAsFiled: row.name,
      grade: row.grade,
      status: row.status,
      region: row.region,
      yearOfReg: row.yearOfReg,
      email: row.email,
      phone: row.phone,
    }));

  return Response.json({ ok: true, query: raw, suggestions });
}
