import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { backups, members, settings, type MemberData } from "@/db/schema";
import { getSettings } from "@/lib/auth";

const SNAPSHOT_BATCH = 2000;

export async function createBackup(input: {
  label?: string;
  kind?: "manual" | "auto";
  adminId?: number | null;
  adminName?: string | null;
}) {
  const data: MemberData[] = [];
  let offset = 0;
  // Read in pages so 100k-row registers do not hold a single giant query open.
  for (;;) {
    const page = await db
      .select({ data: members.data })
      .from(members)
      .orderBy(members.id)
      .limit(SNAPSHOT_BATCH)
      .offset(offset);
    for (const row of page) data.push(row.data);
    if (page.length < SNAPSHOT_BATCH) break;
    offset += SNAPSHOT_BATCH;
  }

  const currentSettings = await getSettings();
  const serialized = JSON.stringify({ members: data, settings: { orgName: currentSettings.orgName } });
  const checksum = createHash("sha256").update(serialized).digest("hex");
  const label =
    input.label?.trim() ||
    `${input.kind === "auto" ? "Scheduled" : "Manual"} snapshot · ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;

  const inserted = await db
    .insert(backups)
    .values({
      label,
      kind: input.kind ?? "manual",
      location: "encrypted-vault",
      rowCount: data.length,
      sizeBytes: Buffer.byteLength(serialized),
      checksum,
      payload: { members: data, settings: { orgName: currentSettings.orgName } },
      createdBy: input.adminId ?? null,
      createdByName: input.adminName ?? "system",
    })
    .returning();

  await db.update(settings).set({ lastAutoBackupAt: new Date() }).where(eq(settings.id, 1));
  return inserted[0];
}

export async function maybeAutoBackup() {
  const current = await getSettings();
  if (!current.autoBackup) return null;
  if (!current.lastAutoBackupAt) return createBackup({ kind: "auto", label: "Scheduled snapshot · first run" });
  const ageMs = Date.now() - new Date(current.lastAutoBackupAt).getTime();
  const windowMs =
    current.backupFrequency === "hourly"
      ? 60 * 60 * 1000
      : current.backupFrequency === "weekly"
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;
  if (ageMs < windowMs) return null;
  return createBackup({ kind: "auto" });
}

export async function restoreBackup(id: number) {
  const rows = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
  const snapshot = rows[0];
  if (!snapshot?.payload?.members) throw new Error("Snapshot payload is missing");
  const payload = snapshot.payload.members;
  await db.delete(members);
  const chunkSize = 500;
  let restored = 0;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const values = chunk.map((record) => ({
      memberId: record.memberId,
      name: record.name ?? "",
      firstName: record.firstName ?? "",
      secondName: record.secondName ?? "",
      thirdName: record.thirdName ?? "",
      fullName: [record.firstName, record.secondName, record.thirdName].filter(Boolean).join(" ") || (record.name ?? ""),
      email: record.email ?? "",
      phone: record.phone ?? "",
      contactAddress: record.contactAddress ?? "",
      certificateCollected: record.certificateCollected ?? "",
      yearOfReg: record.yearOfReg ?? "",
      grade: record.grade ?? "",
      category: record.category ?? "",
      status: record.status || "Active",
      region: record.region ?? "",
      data: record,
    }));
    if (!values.length) continue;
    await db.insert(members).values(values).onConflictDoNothing();
    restored += values.length;
  }
  return { restored, label: snapshot.label };
}

export async function backupStats() {
  const rows = await db
    .select({
      count: sql<number>`count(*)`,
      bytes: sql<number>`coalesce(sum(${backups.sizeBytes}), 0)`,
      latestAt: sql<string | null>`max(${backups.createdAt})`,
    })
    .from(backups);
  const recent = await db
    .select({
      id: backups.id,
      label: backups.label,
      kind: backups.kind,
      rowCount: backups.rowCount,
      sizeBytes: backups.sizeBytes,
      checksum: backups.checksum,
      location: backups.location,
      createdByName: backups.createdByName,
      createdAt: backups.createdAt,
    })
    .from(backups)
    .orderBy(desc(backups.createdAt))
    .limit(20);
  return {
    count: Number(rows[0]?.count ?? 0),
    bytes: Number(rows[0]?.bytes ?? 0),
    latestAt: rows[0]?.latestAt ?? null,
    recent,
  };
}
