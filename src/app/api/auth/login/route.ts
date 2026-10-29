import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, admins } from "@/db/schema";
import { createSession, logAudit, rootExists, verifyPassword, ONLINE_WINDOW_SECONDS } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "login"), 10, 60_000);
  if (!limit.allowed) {
    return Response.json({ ok: false, error: `Too many attempts. Try again in ${limit.retryAfter}s.` }, { status: 429 });
  }
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  // Trim to defeat invisible spaces added by mobile keyboards/autocorrect.
  const password = (body.password ?? "").trim();
  if (!email || !password) {
    return Response.json({ ok: false, error: "Email and password are required" }, { status: 400 });
  }
  const rows = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  const admin = rows[0];
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    return Response.json({ ok: false, error: "Invalid credentials. Check your email and password." }, { status: 401 });
  }
  if (admin.status !== "active") {
    return Response.json({ ok: false, error: "This account has been suspended. Contact the root admin." }, { status: 403 });
  }
  await createSession(admin.id, request.headers.get("user-agent"));
  await db
    .update(adminSessions)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(adminSessions.adminId, admin.id), gt(adminSessions.expiresAt, new Date())));
  await logAudit(
    { id: admin.id, name: admin.name, email: admin.email, role: admin.role, status: admin.status, lastLoginAt: admin.lastLoginAt },
    "Signed in",
    `Session started from ${request.headers.get("user-agent")?.slice(0, 80) ?? "unknown device"}`,
  );
  return Response.json({
    ok: true,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    setupComplete: await rootExists(),
    onlineWindowSeconds: ONLINE_WINDOW_SECONDS,
  });
}

export async function GET() {
  const [row] = await db.select({ total: sql<number>`count(*)` }).from(admins);
  return Response.json({ ok: true, adminCount: Number(row?.total ?? 0), setupComplete: await rootExists() });
}
