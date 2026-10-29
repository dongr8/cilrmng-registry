import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import SettingsClient from "./SettingsClient";
import { getSessionAdmin, getSettings } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await getSessionAdmin();
  const settings = await getSettings();
  const audit = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(30);

  return (
    <SettingsClient
      role={admin?.role ?? "admin"}
      admin={{ name: admin?.name ?? "Administrator", email: admin?.email ?? "" }}
      initialSettings={{
        orgName: settings.orgName,
        shortName: settings.shortName,
        tagline: settings.tagline,
        supportEmail: settings.supportEmail,
        logoUrl: settings.logoUrl,
        primaryColor: settings.primaryColor,
        requireVerification: settings.requireVerification,
        feedbackEmail: settings.feedbackEmail,
        feedbackWhatsapp: settings.feedbackWhatsapp,
        autoBackup: settings.autoBackup,
        backupFrequency: settings.backupFrequency,
        lastAutoBackupAt: settings.lastAutoBackupAt ? new Date(settings.lastAutoBackupAt).toISOString() : null,
      }}
      initialAudit={audit.map((row) => ({
        id: row.id,
        actorName: row.actorName,
        action: row.action,
        detail: row.detail,
        createdAt: new Date(row.createdAt).toISOString(),
      }))}
    />
  );
}
