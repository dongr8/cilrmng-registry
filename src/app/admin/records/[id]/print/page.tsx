import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSessionAdmin, getSettings } from "@/lib/auth";
import RecordSheet from "@/components/RecordSheet";
import PrintButton from "@/components/PrintButton";
import DownloadRecordButton from "@/components/DownloadRecordButton";

export const metadata: Metadata = { title: "Print membership record" };
export const dynamic = "force-dynamic";

export default async function AdminPrintRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) notFound();
  const { id } = await params;
  const rows = await db.select().from(members).where(eq(members.id, Number(id))).limit(1);
  const member = rows[0];
  if (!member) notFound();
  const settings = await getSettings();
  const org = {
    orgName: settings.orgName,
    shortName: settings.shortName,
    tagline: settings.tagline,
    logoUrl: settings.logoUrl,
    supportEmail: settings.supportEmail,
  };

  return (
    <div className="bg-[#fdfbf9]">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/records" className="btn-ghost px-2 text-xs">← Back to records</Link>
        <div className="flex flex-wrap gap-2">
          <DownloadRecordButton memberId={member.memberId} record={member.data} org={org} source={`Administrator copy · ${admin.name}`} />
          <PrintButton />
        </div>
      </div>
      <RecordSheet
        org={org}
        record={member.data}
        memberId={member.memberId}
        verifiedAt={new Date().toISOString()}
        source={`Administrator copy · ${admin.name}`}
      />
    </div>
  );
}
