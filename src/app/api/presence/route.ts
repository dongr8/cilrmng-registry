import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, admins, guestPresence } from "@/db/schema";
import { ONLINE_WINDOW_SECONDS } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Public presence endpoint.
 * - POST with a device token = guest heartbeat (anonymous, no login).
 * - Response always carries both live counters: admins + guests online.
 * Unlimited concurrent users — each browser tab heartbeats independently.
 */
async function counts() {
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000);
  const [adminRow] = await db
    .select({ online: sql<number>`count(distinct ${adminSessions.adminId})` })
    .from(adminSessions)
    .innerJoin(admins, eq(adminSessions.adminId, admins.id))
    .where(and(gt(adminSessions.lastSeenAt, cutoff), gt(adminSessions.expiresAt, new Date()), eq(admins.status, "active")));
  const [guestRow] = await db
    .select({ online: sql<number>`count(*)` })
    .from(guestPresence)
    .where(gt(guestPresence.lastSeenAt, cutoff));
  return { admins: Number(adminRow?.online ?? 0), guests: Number(guestRow?.online ?? 0) };
}

let lastCleanup = 0;

async function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 10 * 60 * 1000) return;
  lastCleanup = now;
  try {
    await db.execute(sql`delete from guest_presence where last_seen_at < now() - interval '1 hour'`);
  } catch {
    /* next cycle */
  }
}

export async function GET() {
  const result = await counts();
  return Response.json({ ok: true, windowSeconds: ONLINE_WINDOW_SECONDS, ...result });
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "presence"), 30, 60_000);
  if (!limit.allowed) return Response.json({ ok: true, admins: 0, guests: 0 });

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = (body.token ?? "").slice(0, 64);
  if (token && /^[A-Za-z0-9_-]{8,64}$/.test(token)) {
    await db
      .insert(guestPresence)
      .values({ token, lastSeenAt: new Date() })
      .onConflictDoUpdate({ target: guestPresence.token, set: { lastSeenAt: new Date() } });
  }
  void cleanup();
  const result = await counts();
  return Response.json({ ok: true, windowSeconds: ONLINE_WINDOW_SECONDS, ...result });
}
