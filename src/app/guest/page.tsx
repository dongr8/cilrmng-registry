import type { Metadata } from "next";
import PortalShell from "@/components/PortalShell";
import GuestPortal from "./GuestPortal";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/auth";
import { getRegisterStats } from "@/lib/members";

export const metadata: Metadata = { title: "Records" };
export const dynamic = "force-dynamic";

export default async function GuestPage() {
  let settings = { ...DEFAULT_SETTINGS };
  let totals = { total: 0, active: 0, states: 0, grades: 0 };
  try {
    settings = await getSettings();
    const stats = await getRegisterStats();
    totals = { total: stats.total, active: stats.active, states: stats.regions, grades: stats.byCategory.length };
  } catch {
    /* fall back to defaults so the portal still renders during setup */
  }
  return (
    <PortalShell settings={settings}>
      <div>
        <GuestPortal
          org={{
            orgName: settings.orgName,
            shortName: settings.shortName,
            tagline: settings.tagline,
            logoUrl: settings.logoUrl,
            supportEmail: settings.supportEmail,
            feedbackEmail: settings.feedbackEmail ?? "",
            feedbackWhatsapp: settings.feedbackWhatsapp ?? "",
          }}
          totals={totals}
        />
      </div>
    </PortalShell>
  );
}
