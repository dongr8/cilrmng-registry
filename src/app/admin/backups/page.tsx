import type { Metadata } from "next";
import BackupsClient from "./BackupsClient";
import { getSessionAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Vault & backups" };
export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  const admin = await getSessionAdmin();
  return <BackupsClient role={admin?.role ?? "admin"} />;
}
