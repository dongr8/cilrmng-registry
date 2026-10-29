import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, admins } from "@/db/schema";
import { hashPassword, logAudit, verifyPassword } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Self-service password reset using the recovery code issued at root sign-up.
 * No email service needed: email + recovery code + new password.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "recover"), 8, 10 * 60_000);
  if (!limit.allowed) {
    return Response.json(
      { ok: false, error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).` },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string; newPassword?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim().toUpperCase().replace(/\s/g, "");
  const newPassword = (body.newPassword ?? "").trim();

  if (!email || !code) return Response.json({ ok: false, error: "Enter your email and recovery code" }, { status: 400 });
  if (newPassword.length < 8) return Response.json({ ok: false, error: "New password must be at least 8 characters" }, { status: 400 });

  const admin = (await db.select().from(admins).where(eq(admins.email, email)).limit(1))[0];
  if (!admin || !admin.recoveryHash || !verifyPassword(code, admin.recoveryHash)) {
    return Response.json({ ok: false, error: "Email and recovery code do not match our records." }, { status: 403 });
  }

  await db.update(admins).set({ passwordHash: hashPassword(newPassword) }).where(eq(admins.id, admin.id));
  await db.delete(adminSessions).where(eq(adminSessions.adminId, admin.id));
  await logAudit(
    { id: admin.id, name: admin.name, email: admin.email, role: admin.role, status: admin.status, lastLoginAt: admin.lastLoginAt },
    "Password reset via recovery code",
    admin.email,
  );
  return Response.json({ ok: true, message: "Password updated. Sign in with your new password." });
}
