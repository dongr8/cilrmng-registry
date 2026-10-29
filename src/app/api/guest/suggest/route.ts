import { and, asc, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { fullNameOf } from "@/lib/member-schema";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Type-ahead suggestions. Fires on every keystroke (from 1 character) and
 * matches anywhere inside a name, registration number, phone or e-mail — so
 * partial words and partial phone numbers both surface results immediately.
 */
export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "suggest"), 240, 60_000);
  if (!limit.allowed) return Response.json({ ok: true, suggestions: [] });

  const url = new URL(request.url);
  const raw = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(12, Math.max(3, Number(url.searchParams.get("limit") ?? 8)));
  if (raw.length < 1) return Response.json({ ok: true, suggestions: [], query: raw });

  const tokens = raw.split(/[\s,]+/).filter(Boolean).slice(0, 4);
  const digits = raw.replace(/\D/g, "");

  const tokenConditions: SQL[] = tokens.map((token) => {
    const pattern = `%${token.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    return or(
      ilike(members.name, pattern),
      ilike(members.firstName, pattern),
      ilike(members.secondName, pattern),
      ilike(members.thirdName, pattern),
      ilike(members.memberId, pattern),
      ilike(members.email, pattern),
      ilike(members.phone, pattern),
      ilike(members.region, pattern),
      ilike(members.grade, pattern),
      ilike(members.yearOfReg, pattern),
    ) as SQL;
  });

  // Digits typed anywhere in the phone cell, ignoring spaces/leading zeros.
  if (digits.length >= 3) {
    const digitPattern = `%${digits}%`;
    tokenConditions.push(
      or(
        sql`regexp_replace(${members.phone}, '[^0-9]', '', 'g') like ${digitPattern}`,
        sql`regexp_replace(${members.phone}, '[^0-9]', '', 'g') like ${`%${digits.replace(/^0+/, "")}%`}`,
        ilike(members.memberId, digitPattern),
      ) as SQL,
    );
  }

  const where = tokenConditions.length ? (or(...tokenConditions) as SQL) : undefined;

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
    .where(where)
    .orderBy(asc(members.name))
    .limit(take * 3);

  const needle = raw.toLowerCase();
  const scored = rows
    .map((row) => {
      const name = fullNameOf({ firstName: row.firstName, secondName: row.secondName, thirdName: row.thirdName, name: row.name }, row.fullName);
      const haystack = `${name} ${row.memberId}`.toLowerCase();
      const phoneDigits = row.phone.replace(/\D/g, "");
      let score = 0;
      if (haystack.startsWith(needle)) score += 100;
      if (row.memberId.toLowerCase().startsWith(needle)) score += 80;
      if (name.toLowerCase().split(/\s+/).some((part) => part.startsWith(needle))) score += 60;
      if (digits.length >= 3 && phoneDigits.includes(digits)) score += 50;
      if (haystack.includes(needle)) score += 20;
      return { row, name, score };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, take);

  return Response.json({
    ok: true,
    query: raw,
    suggestions: scored.map(({ row, name }) => ({
      id: row.id,
      memberId: row.memberId,
      name,
      nameAsFiled: row.name,
      firstName: row.firstName,
      secondName: row.secondName,
      thirdName: row.thirdName,
      grade: row.grade,
      status: row.status,
      region: row.region,
      yearOfReg: row.yearOfReg,
      email: row.email,
      phone: row.phone,
    })),
  });
}
