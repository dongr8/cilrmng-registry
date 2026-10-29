import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import PreviewClient from "./PreviewClient";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/auth";

export const metadata: Metadata = { title: "Mobile preview" };
export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  let settings = { ...DEFAULT_SETTINGS };
  try {
    settings = await getSettings();
  } catch {
    /* defaults keep the page usable */
  }
  return (
    <PublicShell settings={settings} watermark={false}>
      <PreviewClient />
    </PublicShell>
  );
}
