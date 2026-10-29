import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, members } from "@/db/schema";
import { getSettings } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Open a member record for a guest — view / print / download only.
 * No verification step: the register is a public directory, and guests can
 * never edit, update or delete anything through this route.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "guest-record"), 120, 60_000);
  if (!limit.allowed) {
    return Response.json({ ok: false, error: `Please wait ${limit.retryAfter}s before opening more records.` }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { id?: number; memberId?: string };
  const id = Number(body.id);

  let member;
  if (Number.isFinite(id) && id > 0) {
    member = (await db.select().from(members).where(eq(members.id, id)).limit(1))[0];
  } else if (body.memberId?.trim()) {
    member = (await db.select().from(members).where(eq(members.memberId, body.memberId.trim())).limit(1))[0];
  }
  if (!member) return Response.json({ ok: false, error: "Record not found." }, { status: 404 });

  const current = await getSettings();
  await db.insert(auditLogs).values({
    actorId: null,
    actorName: "guest",
    action: "Guest viewed record",
    detail: member.memberId,
  });

  return Response.json({
    ok: true,
    record: member.data,
    recordId: member.id,
    memberId: member.memberId,
    org: {
      name: current.orgName,
      shortName: current.shortName,
      tagline: current.tagline,
      logoUrl: current.logoUrl,
      supportEmail: current.supportEmail,
    },
    viewedAt: new Date().toISOString(),
  });
}

/** Convenience GET so a record can be opened directly by registration number. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const memberId = url.searchParams.get("memberId");
  const id = url.searchParams.get("id");
  return POST(
    new Request(url.origin + "/api/guest/record", {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ id: id ? Number(id) : undefined, memberId }),
    }),
  );
}
