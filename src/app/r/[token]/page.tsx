import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { guestLinks, members } from "@/db/schema";
import { getSettings } from "@/lib/auth";
import RecordSheet from "@/components/RecordSheet";
import PrintButton from "@/components/PrintButton";
import DownloadRecordButton from "@/components/DownloadRecordButton";

export const metadata: Metadata = { title: "Membership record link" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadLink(token: string) {
  try {
    const rows = await db.select().from(guestLinks).where(eq(guestLinks.token, token)).limit(1);
    const link = rows[0];
    if (!link) return { state: "missing" as const };
    const revoked = Boolean(link.revokedAt);
    const expired = new Date(link.expiresAt) < new Date();
    if (!revoked && !expired) {
      await db
        .update(guestLinks)
        .set({ viewCount: sql`${guestLinks.viewCount} + 1`, lastViewedAt: new Date() })
        .where(eq(guestLinks.id, link.id));
    }
    // General access link (no member attached) → open the searchable register.
    if (link.memberRecordId === 0) {
      return { state: revoked ? ("revoked" as const) : expired ? ("expired" as const) : ("general" as const), link };
    }
    const memberRows = await db.select().from(members).where(eq(members.id, link.memberRecordId)).limit(1);
    const member = memberRows[0];
    if (!member) return { state: "missing" as const };
    return { state: revoked ? ("revoked" as const) : expired ? ("expired" as const) : ("ok" as const), link, member };
  } catch {
    return { state: "missing" as const };
  }
}

export default async function GuestLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await getSettings();
  const org = {
    orgName: settings.orgName,
    shortName: settings.shortName,
    tagline: settings.tagline,
    logoUrl: settings.logoUrl,
    supportEmail: settings.supportEmail,
  };
  const result = await loadLink(token);
  if (result.state === "general") redirect("/guest");

  return (
    <div className="min-h-screen bg-[#fdfbf9]">
      <header className="no-print border-b border-[#f1e7df] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={org.logoUrl} alt={`${org.orgName} crest`} className="h-10 w-10 rounded-full border border-brand-100 bg-white object-contain" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold leading-tight text-stone-900">{org.shortName}</span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">Guest record link</span>
            </span>
          </Link>
          <Link href="/guest" className="text-xs font-semibold text-brand-700 hover:underline">Search the register instead →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        {result.state === "ok" && "member" in result && result.member ? (
          <>
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Secured guest link</p>
                <h1 className="text-lg font-bold text-stone-900">Your membership record</h1>
                <p className="text-xs text-stone-500">
                  Read-only · issued by {result.link.createdByName}
                  {new Date(result.link.expiresAt).getFullYear() - new Date(result.link.createdAt).getFullYear() > 50
                    ? " · permanent link"
                    : ` · expires ${new Date(result.link.expiresAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DownloadRecordButton memberId={result.link.memberId} record={result.member.data} org={org} source={`Guest link · issued by ${result.link.createdByName}`} />
                <PrintButton />
              </div>
            </div>
            {result.link.note ? (
              <p className="no-print mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs text-brand-900">
                <span className="font-semibold">Note from the registry:</span> {result.link.note}
              </p>
            ) : null}
            <RecordSheet
              org={org}
              record={result.member.data}
              memberId={result.link.memberId}
              verifiedAt={new Date().toISOString()}
              source={`Guest link · issued by ${result.link.createdByName}`}
            />
          </>
        ) : (
          <div className="mx-auto max-w-lg rounded-2xl border border-[#f1e7df] bg-white p-6 text-center shadow-sm">
            <p className="text-4xl">🔒</p>
            <h1 className="mt-3 text-xl font-bold text-stone-900">
              {result.state === "revoked" ? "This link has been revoked" : result.state === "expired" ? "This link has expired" : "This link is not valid"}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Ask the registry office for a fresh guest link, or search the register directly to view, print or download your record.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href="/guest" className="btn-primary">Search the register</Link>
              <a href={`mailto:${org.supportEmail}`} className="btn-secondary">Contact the registry</a>
            </div>
          </div>
        )}
      </main>
      <footer className="no-print border-t border-[#f1e7df] bg-white px-4 py-4 text-center text-[11px] text-stone-400">
        {org.orgName} · {org.tagline}
      </footer>
    </div>
  );
}
