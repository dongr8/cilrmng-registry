import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, admins } from "@/db/schema";
import { getSessionAdmin, hashPassword, logAudit, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Permissions
 * - Any approved administrator may manage *other administrators*.
 * - The root admin is untouchable: it cannot be removed, suspended, demoted
 *   or edited by anyone except root itself.
 * - Only root can promote someone to root.
 */
export async function PATCH(request: Request, { params }: Params) {
  const actor = await getSessionAdmin();
  if (!actor) return unauthorized();

  const { id } = await params;
  const targetId = Number(id);
  const target = (await db.select().from(admins).where(eq(admins.id, targetId)).limit(1))[0];
  if (!target) return Response.json({ ok: false, error: "Admin not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: "suspend" | "activate" | "reset-password" | "make-root" | "make-admin" | "rename" | "change-email";
    password?: string;
    name?: string;
    email?: string;
  };
  const action = body.action;

  // The root account is protected from every other administrator.
  if (target.role === "root" && actor.role !== "root") {
    return Response.json({ ok: false, error: "The root admin cannot be modified by other administrators." }, { status: 403 });
  }
  // Root can never be suspended or demoted, not even by itself.
  if (target.role === "root" && (action === "suspend" || action === "make-admin")) {
    return Response.json({ ok: false, error: "The root admin cannot be suspended or demoted." }, { status: 400 });
  }
  // Only root may grant root.
  if (action === "make-root" && actor.role !== "root") {
    return Response.json({ ok: false, error: "Only the root admin can grant root access." }, { status: 403 });
  }

  switch (action) {
    case "suspend":
      await db.update(admins).set({ status: "suspended" }).where(eq(admins.id, targetId));
      await db.delete(adminSessions).where(eq(adminSessions.adminId, targetId));
      await logAudit(actor, "Suspended administrator", target.email);
      break;
    case "activate":
      await db.update(admins).set({ status: "active" }).where(eq(admins.id, targetId));
      await logAudit(actor, "Activated administrator", target.email);
      break;
    case "make-root":
      await db.update(admins).set({ role: "root" }).where(eq(admins.id, targetId));
      await logAudit(actor, "Granted root access", target.email);
      break;
    case "make-admin":
      await db.update(admins).set({ role: "admin" }).where(eq(admins.id, targetId));
      await logAudit(actor, "Changed role to admin", target.email);
      break;
    case "reset-password": {
      if ((body.password ?? "").trim().length < 8) {
        return Response.json({ ok: false, error: "Password must be at least 8 characters" }, { status: 400 });
      }
      await db.update(admins).set({ passwordHash: hashPassword(body.password!.trim()) }).where(eq(admins.id, targetId));
      await db.delete(adminSessions).where(and(eq(adminSessions.adminId, targetId), ne(adminSessions.adminId, actor.id)));
      await logAudit(actor, "Reset administrator password", target.email);
      break;
    }
    case "change-email": {
      const email = (body.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return Response.json({ ok: false, error: "Enter a valid email address (any provider)" }, { status: 400 });
      }
      const clash = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
      if (clash[0] && clash[0].id !== targetId) {
        return Response.json({ ok: false, error: "Another account already uses that email" }, { status: 409 });
      }
      await db.update(admins).set({ email }).where(eq(admins.id, targetId));
      await logAudit(actor, "Changed administrator email", `${target.email} → ${email}`);
      break;
    }
    case "rename": {
      const name = (body.name ?? "").trim();
      if (name.length < 2) return Response.json({ ok: false, error: "Enter a valid name" }, { status: 400 });
      await db.update(admins).set({ name }).where(eq(admins.id, targetId));
      await logAudit(actor, "Renamed administrator", `${target.name} → ${name}`);
      break;
    }
    default:
      return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  const updated = (await db.select().from(admins).where(eq(admins.id, targetId)).limit(1))[0];
  return Response.json({
    ok: true,
    admin: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      lastLoginAt: updated.lastLoginAt,
      lastSeenAt: updated.lastSeenAt,
      createdAt: updated.createdAt,
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const actor = await getSessionAdmin();
  if (!actor) return unauthorized();

  const { id } = await params;
  const targetId = Number(id);
  const target = (await db.select().from(admins).where(eq(admins.id, targetId)).limit(1))[0];
  if (!target) return Response.json({ ok: false, error: "Admin not found" }, { status: 404 });

  // The root admin can never be removed — by anyone, including itself.
  if (target.role === "root") {
    return Response.json({ ok: false, error: "The root admin is permanent and cannot be removed." }, { status: 403 });
  }
  if (targetId === actor.id) {
    return Response.json({ ok: false, error: "You cannot remove your own account" }, { status: 400 });
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(admins);
  if (Number(total) <= 1) {
    return Response.json({ ok: false, error: "At least one administrator must remain" }, { status: 400 });
  }

  await db.delete(admins).where(eq(admins.id, targetId));
  await logAudit(actor, "Removed administrator", target.email);
  return Response.json({ ok: true });
}
