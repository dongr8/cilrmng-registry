import { db } from "@/db";
import { admins } from "@/db/schema";
import { hashPassword, createSession, logAudit, rootExists } from "@/lib/auth";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, setupComplete: await rootExists() });
}

export async function POST(request: Request) {
  if (await rootExists()) {
    return Response.json({ ok: false, error: "Root admin already configured. Sign in instead." }, { status: 409 });
  }
  let body: { name?: string; email?: string; phone?: string; position?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = (body.password ?? "").trim();
  if (name.length < 2) return Response.json({ ok: false, error: "Enter the root admin's full name" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ ok: false, error: "Enter a valid personal email address (Gmail, Yahoo, Outlook…)" }, { status: 400 });
  if (password.length < 8) return Response.json({ ok: false, error: "Password must be at least 8 characters" }, { status: 400 });
  const phone = (body.phone ?? "").trim();
  const position = (body.position ?? "").trim();
  if (phone.replace(/\D/g, "").length < 7) return Response.json({ ok: false, error: "Enter a valid phone number" }, { status: 400 });
  if (position.length < 2) return Response.json({ ok: false, error: "Enter the position / title" }, { status: 400 });

  const existing = await db.select({ id: admins.id }).from(admins).limit(1);
  if (existing[0]) {
    return Response.json({ ok: false, error: "This registry has already been claimed." }, { status: 409 });
  }
  // One-time recovery code: lets root reset a forgotten password from /recover.
  const recoveryCode = `CILRM-${randomBytes(2).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const inserted = await db
    .insert(admins)
    .values({
      name,
      email,
      phone,
      position,
      passwordHash: hashPassword(password),
      recoveryHash: hashPassword(recoveryCode),
      role: "root",
      status: "active",
    })
    .returning();
  const root = inserted[0];
  await createSession(root.id, request.headers.get("user-agent"));
  await logAudit(
    { id: root.id, name: root.name, email: root.email, role: root.role, status: root.status, lastLoginAt: null },
    "Root admin signed up",
    `${root.name} · ${position}`,
  );
  return Response.json({ ok: true, recoveryCode, admin: { id: root.id, name: root.name, email: root.email, role: root.role } });
}
