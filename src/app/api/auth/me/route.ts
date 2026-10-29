import { getSessionAdmin, rootExists } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSessionAdmin();
  return Response.json({ ok: true, admin, setupComplete: await rootExists() });
}
