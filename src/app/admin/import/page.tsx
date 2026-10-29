import type { Metadata } from "next";
import ImportClient from "./ImportClient";
import { getSessionAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Import data" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const admin = await getSessionAdmin();
  return <ImportClient adminName={admin?.name ?? "Administrator"} />;
}
