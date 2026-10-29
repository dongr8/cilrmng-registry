import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { getSessionAdmin, hashPassword, logAudit, unauthorized, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** An administrator managing their own sign-in details. One email per account. */
export async function GET() {
  const session = await getSessionAdmin();
  if (!session) return unauthorized();
  const rows = await db
    .select({ id: admins.id, name: admins.name, email: admins.email, role: admins.role, lastLoginAt: admins.lastLoginAt })
    .from(admins)
    .where(eq(admins.id, session.id))
    .limit(1);
  return Response.json({ ok: true, profile: rows[0] ?? null });
}

export async function PATCH(request: Request) {
  const session = await getSessionAdmin();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as {
    action?: "change-email" | "change-password" | "rename";
    email?: string;
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const me = (await db.select().from(admins).where(eq(admins.id, session.id)).limit(1))[0];
  if (!me) return unauthorized();

  switch (body.action) {
    case "change-email": {
      const email = (body.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return Response.json({ ok: false, error: "Enter a valid email address (Gmail, Yahoo, Outlook, office — any provider)" }, { status: 400 });
      }
      const clash = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
      if (clash[0] && clash[0].id !== me.id) {
        return Response.json({ ok: false, error: "Another account already uses that email" }, { status: 409 });
      }
      await db.update(admins).set({ email }).where(eq(admins.id, me.id));
      await logAudit(session, "Changed own sign-in email", `${me.email} → ${email}`);
      break;
    }
    case "change-password": {
      if (!verifyPassword((body.currentPassword ?? "").trim(), me.passwordHash)) {
        return Response.json({ ok: false, error: "Current password is incorrect" }, { status: 403 });
      }
      if ((body.newPassword ?? "").trim().length < 8) {
        return Response.json({ ok: false, error: "New password must be at least 8 characters" }, { status: 400 });
      }
      await db.update(admins).set({ passwordHash: hashPassword(body.newPassword!.trim()) }).where(eq(admins.id, me.id));
      await logAudit(session, "Changed own password", me.email);
      break;
    }
    case "rename": {
      const name = (body.name ?? "").trim();
      if (name.length < 2) return Response.json({ ok: false, error: "Enter a valid name" }, { status: 400 });
      await db.update(admins).set({ name }).where(eq(admins.id, me.id));
      await logAudit(session, "Updated own profile name", `${me.name} → ${name}`);
      break;
    }
    default:
      return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  const updated = (await db
    .select({ id: admins.id, name: admins.name, email: admins.email, role: admins.role })
    .from(admins)
    .where(eq(admins.id, me.id))
    .limit(1))[0];
  return Response.json({ ok: true, profile: updated });
}
