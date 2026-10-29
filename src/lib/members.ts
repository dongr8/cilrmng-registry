import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { members, type MemberData } from "@/db/schema";
import { FIELD_KEYS, MEMBER_FIELDS, enrichRecord, fullNameOf, type MemberRecord } from "@/lib/member-schema";

export function sanitizeRecord(input: unknown): MemberRecord {
  const source = (input ?? {}) as Record<string, unknown>;
  const record: MemberRecord = {};
  for (const key of FIELD_KEYS) {
    const value = source[key];
    record[key] = typeof value === "string" ? value.slice(0, 1000) : value == null ? "" : String(value).slice(0, 1000);
  }
  // Tolerate older/alternate key names so historical payloads still land correctly.
  if (!record.thirdName && source.surname) record.thirdName = String(source.surname).slice(0, 1000);
  if (!record.secondName && source.otherNames) record.secondName = String(source.otherNames).slice(0, 1000);
  if (!record.contactAddress && source.address) record.contactAddress = String(source.address).slice(0, 1000);
  if (!record.yearOfReg && source.dateJoined) record.yearOfReg = String(source.dateJoined).slice(0, 1000);
  return enrichRecord(record);
}

export function toMemberColumns(record: MemberRecord) {
  return {
    name: record.name ?? "",
    firstName: record.firstName ?? "",
    secondName: record.secondName ?? "",
    thirdName: record.thirdName ?? "",
    fullName: fullNameOf(record),
    email: record.email ?? "",
    phone: record.phone ?? "",
    contactAddress: record.contactAddress ?? "",
    certificateCollected: record.certificateCollected ?? "",
    yearOfReg: record.yearOfReg ?? "",
    grade: record.grade ?? "",
    category: record.category ?? "",
    status: record.status || "Active",
    region: record.region ?? "",
    data: record as MemberData,
  };
}

export function generateMemberId(index: number): string {
  const stamp = Date.now().toString().slice(-5);
  return `NEW-${stamp}${String(index + 1).padStart(3, "0")}/CILRM`;
}

export function buildSearchConditions(query: string, extra: { status?: string; category?: string; region?: string }) {
  const conditions: SQL[] = [];
  const trimmed = query.trim();
  if (trimmed) {
    const parts = trimmed.split(/[\s,]+/).filter(Boolean).slice(0, 5);
    const tokenConditions = parts.map((token) => {
      const tokenPattern = `%${token.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      return or(
        ilike(members.memberId, tokenPattern),
        ilike(members.name, tokenPattern),
        ilike(members.fullName, tokenPattern),
        ilike(members.firstName, tokenPattern),
        ilike(members.secondName, tokenPattern),
        ilike(members.thirdName, tokenPattern),
        ilike(members.email, tokenPattern),
        ilike(members.phone, tokenPattern),
        ilike(members.contactAddress, tokenPattern),
        ilike(members.grade, tokenPattern),
        ilike(members.category, tokenPattern),
        ilike(members.region, tokenPattern),
        ilike(members.status, tokenPattern),
        ilike(members.yearOfReg, tokenPattern),
      ) as SQL;
    });
    conditions.push(and(...tokenConditions) as SQL);
  }
  if (extra.status) conditions.push(eq(members.status, extra.status));
  if (extra.category) conditions.push(eq(members.category, extra.category));
  if (extra.region) conditions.push(eq(members.region, extra.region));
  return conditions.length ? and(...conditions) : undefined;
}

const FIELD_LABELS: Record<string, string> = Object.fromEntries(MEMBER_FIELDS.map((field) => [field.key, field.label]));

const escapeCsv = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function recordToCsv(record: MemberRecord): string {
  const lines = ["Field,Value"];
  for (const key of FIELD_KEYS) {
    lines.push(`${escapeCsv(FIELD_LABELS[key] ?? key)},${escapeCsv(record[key] ?? "")}`);
  }
  return lines.join("\r\n");
}

export function membersToCsv(rows: { memberId: string; data: MemberData }[]): string {
  const lines = [MEMBER_FIELDS.map((field) => escapeCsv(field.label)).join(",")];
  for (const row of rows) {
    lines.push(MEMBER_FIELDS.map((field) => escapeCsv(row.data[field.key] ?? "")).join(","));
  }
  return lines.join("\r\n");
}

export async function getRegisterStats() {
  const [totals] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${members.status} = 'Active')`,
      pending: sql<number>`count(*) filter (where ${members.status} = 'Pending')`,
      expired: sql<number>`count(*) filter (where ${members.status} = 'Expired')`,
      newThisMonth: sql<number>`count(*) filter (where ${members.createdAt} > now() - interval '30 days')`,
      withEmail: sql<number>`count(*) filter (where ${members.email} <> '')`,
      withPhone: sql<number>`count(*) filter (where ${members.phone} <> '')`,
      withAddress: sql<number>`count(*) filter (where ${members.contactAddress} <> '')`,
      certificates: sql<number>`count(*) filter (where ${members.certificateCollected} <> '')`,
      regions: sql<number>`count(distinct nullif(${members.region}, ''))`,
    })
    .from(members);

  const byCategory = await db
    .select({ label: members.grade, value: count() })
    .from(members)
    .groupBy(members.grade)
    .orderBy(desc(count()))
    .limit(8);

  const byRegion = await db
    .select({ label: members.region, value: count() })
    .from(members)
    .groupBy(members.region)
    .orderBy(desc(count()))
    .limit(6);

  const byStatus = await db
    .select({ label: members.status, value: count() })
    .from(members)
    .groupBy(members.status)
    .orderBy(desc(count()));

  return {
    total: Number(totals?.total ?? 0),
    active: Number(totals?.active ?? 0),
    pending: Number(totals?.pending ?? 0),
    expired: Number(totals?.expired ?? 0),
    newThisMonth: Number(totals?.newThisMonth ?? 0),
    withEmail: Number(totals?.withEmail ?? 0),
    withPhone: Number(totals?.withPhone ?? 0),
    withAddress: Number(totals?.withAddress ?? 0),
    certificates: Number(totals?.certificates ?? 0),
    regions: Number(totals?.regions ?? 0),
    byCategory: byCategory.map((row) => ({ label: row.label || "Unspecified", value: Number(row.value) })),
    byRegion: byRegion.map((row) => ({ label: row.label || "Unspecified", value: Number(row.value) })),
    byStatus: byStatus.map((row) => ({ label: row.label || "Unspecified", value: Number(row.value) })),
  };
}
