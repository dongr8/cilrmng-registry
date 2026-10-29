import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, admins } from "@/db/schema";
import { ONLINE_WINDOW_SECONDS, getSessionAdmin, touchPresence, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function onlineAdmins() {
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000);
  const rows = await db
    .select({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      lastSeenAt: adminSessions.lastSeenAt,
    })
    .from(adminSessions)
    .innerJoin(admins, eq(adminSessions.adminId, admins.id))
    .where(and(gt(adminSessions.lastSeenAt, cutoff), gt(adminSessions.expiresAt, new Date()), eq(admins.status, "active")))
    .orderBy(sql`${adminSessions.lastSeenAt} desc`);

  const unique = new Map<number, (typeof rows)[number]>();
  for (const row of rows) if (!unique.has(row.id)) unique.set(row.id, row);
  return [...unique.values()];
}

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const online = await onlineAdmins();
  return Response.json({
    ok: true,
    windowSeconds: ONLINE_WINDOW_SECONDS,
    count: online.length,
    admins: online.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      lastSeenAt: row.lastSeenAt,
      isSelf: row.id === admin.id,
    })),
  });
}

export async function POST() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  await touchPresence();
  const online = await onlineAdmins();
  return Response.json({ ok: true, count: online.length, online });
}
