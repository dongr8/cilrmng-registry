import type { Metadata } from "next";
import RecordsClient from "./RecordsClient";
import { getSessionAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Records" };
export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const admin = await getSessionAdmin();
  return <RecordsClient role={admin?.role ?? "admin"} adminName={admin?.name ?? "Administrator"} />;
}
