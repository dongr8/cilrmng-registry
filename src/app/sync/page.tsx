import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import SyncClient from "./SyncClient";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/auth";

export const metadata: Metadata = { title: "Sync / Upload" };
export const dynamic = "force-dynamic";

export default async function SyncPage() {
  let settings = { ...DEFAULT_SETTINGS };
  try {
    settings = await getSettings();
  } catch {
    /* defaults keep the page usable */
  }
  return (
    <PublicShell settings={settings}>
      <SyncClient orgName={settings.orgName} />
    </PublicShell>
  );
}
