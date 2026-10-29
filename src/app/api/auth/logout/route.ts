import { destroySession, getSessionAdmin, logAudit } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const admin = await getSessionAdmin();
  if (admin) await logAudit(admin, "Signed out");
  await destroySession();
  return Response.json({ ok: true });
}
