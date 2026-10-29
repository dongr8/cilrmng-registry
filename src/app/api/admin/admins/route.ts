import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, admins } from "@/db/schema";
import { ONLINE_WINDOW_SECONDS, getSessionAdmin, hashPassword, logAudit, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000);
  const rows = await db.select().from(admins).orderBy(desc(admins.createdAt));
  const liveSessions = await db
    .select({ adminId: adminSessions.adminId })
    .from(adminSessions)
    .where(and(gt(adminSessions.lastSeenAt, cutoff), gt(adminSessions.expiresAt, new Date())));
  const online = new Set(liveSessions.map((row) => row.adminId));
  return Response.json({
    ok: true,
    onlineWindowSeconds: ONLINE_WINDOW_SECONDS,
    admins: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      position: row.position,
      role: row.role,
      status: row.status,
      lastLoginAt: row.lastLoginAt,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      online: online.has(row.id),
      isSelf: row.id === admin.id,
    })),
  });
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  // Any approved administrator may add a new administrator. Only root can mint another root.
  const body = (await request.json().catch(() => ({}))) as { name?: string; email?: string; phone?: string; position?: string; password?: string; role?: string };
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = (body.password ?? "").trim();
  const role = body.role === "root" && admin.role === "root" ? "root" : "admin";

  if (name.length < 2) return Response.json({ ok: false, error: "Enter the admin's full name" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ ok: false, error: "Enter a valid personal email (Gmail, Yahoo, Outlook…)" }, { status: 400 });
  if (password.length < 8) return Response.json({ ok: false, error: "Password must be at least 8 characters" }, { status: 400 });
  const phone = (body.phone ?? "").trim();
  const position = (body.position ?? "").trim();
  if (phone.replace(/\D/g, "").length < 7) return Response.json({ ok: false, error: "Enter a valid phone number" }, { status: 400 });
  if (position.length < 2) return Response.json({ ok: false, error: "Enter the position / title" }, { status: 400 });

  const clash = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
  if (clash[0]) return Response.json({ ok: false, error: "An account with that email already exists" }, { status: 409 });

  const inserted = await db
    .insert(admins)
    .values({ name, email, phone, position, passwordHash: hashPassword(password), role, status: "active", createdBy: admin.id })
    .returning();
  await logAudit(admin, "Registered administrator", `${name} (${email}) · ${position} · ${role}`);
  const created = inserted[0];
  return Response.json({
    ok: true,
    admin: { id: created.id, name: created.name, email: created.email, phone: created.phone, position: created.position, role: created.role, status: created.status },
  });
}
