import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guestLinks } from "@/db/schema";
import { getSessionAdmin, logAudit, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  const { id } = await params;
  const rows = await db.select().from(guestLinks).where(eq(guestLinks.id, Number(id))).limit(1);
  const link = rows[0];
  if (!link) return Response.json({ ok: false, error: "Link not found" }, { status: 404 });
  if (link.revokedAt) return Response.json({ ok: true, alreadyRevoked: true });
  await db.update(guestLinks).set({ revokedAt: new Date() }).where(eq(guestLinks.id, link.id));
  await logAudit(admin, "Revoked guest record link", `${link.memberName} · ${link.memberId}`);
  return Response.json({ ok: true });
}
