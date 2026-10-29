import type { ReactNode } from "react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import MobileTabBar from "@/components/MobileTabBar";
import Watermark from "@/components/Watermark";
import { PUBLIC_NAV } from "@/components/nav-items";

export type ShellSettings = {
  orgName: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  supportEmail: string;
};

export default function PublicShell({
  settings,
  children,
  watermark = true,
}: {
  settings: ShellSettings;
  children: ReactNode;
  watermark?: boolean;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {watermark ? <Watermark logoUrl={settings.logoUrl} /> : null}
      <div className="relative z-10 flex min-h-screen flex-col">
        <PublicHeader orgName={settings.orgName} logoUrl={settings.logoUrl} />
        {/* bottom padding clears the mobile tab bar */}
        <main className="flex-1">{children}</main>
        <PublicFooter orgName={settings.orgName} logoUrl={settings.logoUrl} supportEmail={settings.supportEmail} />
        {/* spacer so the fixed bottom tab bar never covers footer content */}
        <div aria-hidden className="h-[72px] lg:hidden" />
      </div>
      <MobileTabBar items={PUBLIC_NAV} />
    </div>
  );
}
