import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: {
    default: "CILRMNG Membership Registry",
    template: "%s · CILRMNG Registry",
  },
  description:
    "Chartered Institute of Loan & Risk Management of Nigeria (CILRMNG) membership register — Excel/CSV import, guest record links, offline sync and vault backups.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/images/cilrm-logo.png", apple: "/images/cilrm-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#EA580C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fdfbf9] text-stone-900 antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
