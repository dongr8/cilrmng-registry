import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { admins, auditLogs, imports } from "@/db/schema";
import { getSessionAdmin, getSettings, purgeOldAuditLogs, unauthorized } from "@/lib/auth";
import { backupStats, maybeAutoBackup } from "@/lib/backups";
import { getRegisterStats } from "@/lib/members";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  void purgeOldAuditLogs();

  const [stats, currentSettings, recentImports, audit, vault, teamRows] = await Promise.all([
    getRegisterStats(),
    getSettings(),
    db.select().from(imports).orderBy(desc(imports.createdAt)).limit(5),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8),
    backupStats(),
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${admins.status} = 'active')`,
        root: sql<number>`count(*) filter (where ${admins.role} = 'root')`,
      })
      .from(admins),
  ]);

  if (currentSettings.autoBackup) {
    try {
      await maybeAutoBackup();
    } catch {
      /* snapshot in progress or vault unavailable — dashboard still renders */
    }
  }

  return Response.json({
    ok: true,
    stats,
    team: {
      total: Number(teamRows[0]?.total ?? 0),
      active: Number(teamRows[0]?.active ?? 0),
      root: Number(teamRows[0]?.root ?? 0),
    },
    settings: {
      orgName: currentSettings.orgName,
      shortName: currentSettings.shortName,
      autoBackup: currentSettings.autoBackup,
      backupFrequency: currentSettings.backupFrequency,
      lastAutoBackupAt: currentSettings.lastAutoBackupAt,
    },
    imports: recentImports,
    audit,
    vault: { count: vault.count, bytes: vault.bytes, latestAt: vault.latestAt },
  });
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action === "refresh") {
    const [stats, vault] = await Promise.all([getRegisterStats(), backupStats()]);
    return Response.json({ ok: true, stats, vault });
  }
  const [row] = await db.select({ total: sql<number>`count(*)` }).from(imports);
  return Response.json({ ok: true, imports: Number(row?.total ?? 0) });
}

export async function PUT() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  await db.update(admins).set({ lastSeenAt: new Date() }).where(eq(admins.id, admin.id));
  return Response.json({ ok: true });
}
