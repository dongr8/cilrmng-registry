import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, admins, auditLogs, settings, type Admin, type SettingsRow } from "@/db/schema";

export const SESSION_COOKIE = "meridian_session";
/** A signed-in admin stays online for 30 days per sign-in, and every visit
 *  renews the full 30 days — so an active admin never sees a login prompt
 *  (always ≥ 20 days of runway). Only a deliberate sign-out ends the session
 *  immediately; a fresh login is then required. */
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_HOURS = SESSION_TTL_DAYS * 24;
/** Renew whenever fewer than this many days remain (i.e. on every visit). */
const SESSION_RENEW_WITHIN_DAYS = 29;
export const ONLINE_WINDOW_SECONDS = 90;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  try {
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(digest, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export type SessionAdmin = Pick<Admin, "id" | "name" | "email" | "role" | "status" | "lastLoginAt">;

export async function createSession(adminId: number, userAgent?: string | null): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await db.insert(adminSessions).values({ token, adminId, userAgent: userAgent ?? null, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
  await db.update(admins).set({ lastLoginAt: new Date(), lastSeenAt: new Date() }).where(eq(admins.id, adminId));
  return token;
}

/** Deliberate sign-out: the session token is destroyed server-side at once,
 *  so the device is fully logged out until the admin signs in again. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(adminSessions).where(eq(adminSessions.token, token));
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
}

export async function getSessionAdmin(): Promise<SessionAdmin | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      status: admins.status,
      lastLoginAt: admins.lastLoginAt,
      sessionToken: adminSessions.token,
      expiresAt: adminSessions.expiresAt,
    })
    .from(adminSessions)
    .innerJoin(admins, eq(adminSessions.adminId, admins.id))
    .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== "active") return null;

  // Rolling expiry: every visit pushes the session a full year forward.
  const renewAfter = new Date(Date.now() + SESSION_RENEW_WITHIN_DAYS * 24 * 60 * 60 * 1000);
  if (!row.expiresAt || row.expiresAt < renewAfter) {
    const nextExpiry = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    await db.update(adminSessions).set({ expiresAt: nextExpiry }).where(eq(adminSessions.token, token));
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires: nextExpiry,
    });
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt,
  };
}

export async function touchPresence(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const now = new Date();
  const rows = await db
    .update(adminSessions)
    .set({ lastSeenAt: now })
    .where(eq(adminSessions.token, token))
    .returning({ adminId: adminSessions.adminId });
  if (rows[0]) await db.update(admins).set({ lastSeenAt: now }).where(eq(admins.id, rows[0].adminId));
}

let lastAuditPurge = 0;

/** Monthly retention: activity-log entries older than 30 days are deleted.
 *  Runs opportunistically, throttled to once per hour per server process. */
export async function purgeOldAuditLogs(): Promise<void> {
  const now = Date.now();
  if (now - lastAuditPurge < 60 * 60 * 1000) return;
  lastAuditPurge = now;
  try {
    await db.execute(sql`delete from audit_logs where created_at < now() - interval '30 days'`);
  } catch {
    /* retried next cycle */
  }
}

export async function logAudit(actor: SessionAdmin | null, action: string, detail = ""): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "system",
    action,
    detail,
  });
  void purgeOldAuditLogs();
}

export const DEFAULT_SETTINGS = {
  id: 1,
  orgName: "Chartered Institute of Loan & Risk Management of Nigeria",
  shortName: "CILRMNG",
  tagline: "Minimizing Risks, Maximizing Opportunities",
  logoUrl: "/images/cilrm-logo.png",
  supportEmail: "info@cilrmng.org",
  primaryColor: "#EA580C",
  requireVerification: true,
  feedbackEmail: "",
  feedbackWhatsapp: "",
  guestSearchFields: ["memberId", "firstName", "secondName", "thirdName", "email", "phone"],
  autoBackup: true,
  backupFrequency: "daily",
};

export async function getSettings(): Promise<SettingsRow> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db.insert(settings).values(DEFAULT_SETTINGS).onConflictDoNothing().returning();
  if (inserted[0]) return inserted[0];
  const again = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return again[0];
}

export async function rootExists(): Promise<boolean> {
  const rows = await db.select({ id: admins.id }).from(admins).where(eq(admins.role, "root")).limit(1);
  return Boolean(rows[0]);
}

export function unauthorized(message = "Authentication required") {
  return Response.json({ ok: false, error: message }, { status: 401 });
}

export function forbidden(message = "Root admin access required") {
  return Response.json({ ok: false, error: message }, { status: 403 });
}
