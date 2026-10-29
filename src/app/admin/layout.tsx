import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminShell from "./AdminShell";
import { DEFAULT_SETTINGS, getSessionAdmin, getSettings } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/login");
  let settings = { ...DEFAULT_SETTINGS };
  try {
    settings = await getSettings();
  } catch {
    /* defaults keep the shell usable if the register is unavailable */
  }
  return (
    <AdminShell
      admin={{ id: admin.id, name: admin.name, email: admin.email, role: admin.role }}
      org={{ name: settings.orgName, logoUrl: settings.logoUrl, shortName: settings.shortName }}
    >
      {children}
    </AdminShell>
  );
}
