import { getSessionAdmin, getSettings, logAudit, unauthorized } from "@/lib/auth";
import { backupStats, createBackup, restoreBackup } from "@/lib/backups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const [stats, current] = await Promise.all([backupStats(), getSettings()]);
  return Response.json({
    ok: true,
    ...stats,
    engine: {
      autoBackup: current.autoBackup,
      backupFrequency: current.backupFrequency,
      lastAutoBackupAt: current.lastAutoBackupAt,
      storage: "Encrypted vault (PostgreSQL snapshots) + offline mirror",
    },
  });
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { action?: string; id?: number; label?: string };

  if (body.action === "restore") {
    if (admin.role !== "root") return Response.json({ ok: false, error: "Only the root admin can restore a snapshot" }, { status: 403 });
    if (!body.id) return Response.json({ ok: false, error: "Snapshot id is required" }, { status: 400 });
    try {
      const result = await restoreBackup(Number(body.id));
      await logAudit(admin, "Restored register from snapshot", `${result.label} · ${result.restored} rows`);
      return Response.json({ ok: true, ...result });
    } catch (error) {
      return Response.json({ ok: false, error: (error as Error).message }, { status: 400 });
    }
  }

  if (body.action === "delete") {
    if (admin.role !== "root") return Response.json({ ok: false, error: "Only the root admin can delete snapshots" }, { status: 403 });
    const { db } = await import("@/db");
    const { backups } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    if (!body.id) return Response.json({ ok: false, error: "Snapshot id is required" }, { status: 400 });
    await db.delete(backups).where(eq(backups.id, Number(body.id)));
    await logAudit(admin, "Deleted snapshot", `#${body.id}`);
    return Response.json({ ok: true });
  }

  const snapshot = await createBackup({
    kind: "manual",
    label: body.label,
    adminId: admin.id,
    adminName: admin.name,
  });
  await logAudit(admin, "Created manual snapshot", `${snapshot.rowCount} rows · ${(snapshot.sizeBytes / 1024).toFixed(1)} KB`);
  return Response.json({
    ok: true,
    backup: {
      id: snapshot.id,
      label: snapshot.label,
      rowCount: snapshot.rowCount,
      sizeBytes: snapshot.sizeBytes,
      checksum: snapshot.checksum,
      createdAt: snapshot.createdAt,
    },
  });
}
