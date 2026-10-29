import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import GuestSettingsClient from "./SettingsClient";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function GuestSettingsPage() {
  let settings = { ...DEFAULT_SETTINGS };
  try {
    settings = await getSettings();
  } catch {
    /* defaults keep the page usable */
  }
  return (
    <PublicShell settings={settings}>
      <GuestSettingsClient orgName={settings.orgName} supportEmail={settings.supportEmail} tagline={settings.tagline} />
    </PublicShell>
  );
}
