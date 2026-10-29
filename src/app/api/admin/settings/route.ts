import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, settings } from "@/db/schema";
import { getSessionAdmin, getSettings, logAudit, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const current = await getSettings();
  const audit = await db.select().from(auditLogs).orderBy(sql`${auditLogs.createdAt} desc`).limit(25);
  return Response.json({ ok: true, settings: current, audit });
}

export async function PATCH(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  if (admin.role !== "root") {
    return Response.json({ ok: false, error: "Only the root admin can change registry settings" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const current = await getSettings();

  const orgName = typeof body.orgName === "string" && body.orgName.trim() ? body.orgName.trim().slice(0, 120) : current.orgName;
  const shortName = typeof body.shortName === "string" && body.shortName.trim() ? body.shortName.trim().slice(0, 60) : current.shortName;
  const tagline = typeof body.tagline === "string" ? body.tagline.slice(0, 160) : current.tagline;
  const supportEmail = typeof body.supportEmail === "string" ? body.supportEmail.slice(0, 160) : current.supportEmail;
  const logoUrl = typeof body.logoUrl === "string" && body.logoUrl.startsWith("/") ? body.logoUrl.slice(0, 300) : current.logoUrl;
  const primaryColor = typeof body.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primaryColor) ? body.primaryColor : current.primaryColor;
  const requireVerification = typeof body.requireVerification === "boolean" ? body.requireVerification : current.requireVerification;
  const autoBackup = typeof body.autoBackup === "boolean" ? body.autoBackup : current.autoBackup;
  const feedbackEmail = typeof body.feedbackEmail === "string" ? body.feedbackEmail.trim().slice(0, 160) : current.feedbackEmail;
  const feedbackWhatsapp = typeof body.feedbackWhatsapp === "string" ? body.feedbackWhatsapp.trim().slice(0, 32) : current.feedbackWhatsapp;
  const backupFrequency =
    typeof body.backupFrequency === "string" && ["hourly", "daily", "weekly"].includes(body.backupFrequency)
      ? body.backupFrequency
      : current.backupFrequency;
  const guestSearchFields = Array.isArray(body.guestSearchFields)
    ? (body.guestSearchFields as unknown[]).filter((key): key is string => typeof key === "string").slice(0, 6)
    : current.guestSearchFields;

  const updated = await db
    .update(settings)
    .set({ orgName, shortName, tagline, supportEmail, logoUrl, primaryColor, requireVerification, feedbackEmail, feedbackWhatsapp, autoBackup, backupFrequency, guestSearchFields, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();

  await logAudit(admin, "Updated registry settings", orgName);
  return Response.json({ ok: true, settings: updated[0] });
}
